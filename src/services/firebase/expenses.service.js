import {
  collection,
  deleteField,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/firebase/firebase'
import { getExpenseCategory } from '@/config/expense-categories'
import {
  annualMonthlyExpenseValue,
  annualExpenseValue,
  generateMonthlyExpenseAmounts,
  normalizeExpenseAttributes,
  normalizeExpenseEstimate,
  normalizeMonthlyExpenseAmounts,
} from '@/domain/financial/expense-calculations'
import { cloneOwnership, isValidOwnership } from '@/domain/financial/ownership'
import {
  canonicalCategories,
  hydrateModelConfigWithBaselines,
} from '@/domain/financial/model-categories'
import {
  MODEL_BASELINE_KIND,
  isModelBaseline,
  modelBaselineId,
} from '@/domain/financial/model-baseline'
import { ensureModelConfig, modelConfigRef } from '@/services/firebase/model-config.service'

function configRef(workspaceId) {
  return modelConfigRef(workspaceId, 'expenses')
}

function modelExpensesRef(workspaceId) {
  return collection(db, 'workspaces', workspaceId, 'modelExpenses')
}

export async function getExpensesConfig(workspaceId) {
  const [config, baselineSnapshot] = await Promise.all([
    ensureModelConfig(workspaceId, 'expenses'),
    getDocs(query(modelExpensesRef(workspaceId), where('kind', '==', MODEL_BASELINE_KIND))),
  ])
  const baselines = baselineSnapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }))
  const hydratedConfig = hydrateModelConfigWithBaselines(config, baselines, (baseline) => ({
    manualEstimate: baseline.estimate,
    monthlyAmounts: baseline.monthlyAmounts,
    manualValue: expenseAnnualValue(baseline),
    ownership: baseline.ownership,
    necessity: baseline.necessity ?? null,
  }))
  return { config: hydratedConfig, expenses: [] }
}

export async function getCategoryExpenses(workspaceId, categoryId) {
  const snapshot = await getDocs(
    query(modelExpensesRef(workspaceId), where('category', '==', categoryId)),
  )
  return snapshot.docs
    .map((expenseDocument) => ({ id: expenseDocument.id, ...expenseDocument.data() }))
    .filter((expense) => !isModelBaseline(expense))
}

export async function saveExpensesSetup(workspaceId, categories, userId) {
  const batch = writeBatch(db)
  batch.set(
    configRef(workspaceId),
    {
      schemaVersion: 1,
      setupCompleted: true,
      categories: stampCategories(canonicalExpenseCategories(categories), userId),
      createdAt: serverTimestamp(),
      createdBy: userId,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    },
    { merge: true },
  )
  setExpenseBaselines(batch, workspaceId, categories, userId)
  await batch.commit()
}

export async function updateExpensesCategories(workspaceId, categories, userId) {
  const batch = writeBatch(db)
  batch.set(
    configRef(workspaceId),
    {
      setupCompleted: true,
      categories: stampCategories(canonicalExpenseCategories(categories), userId),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    },
    { merge: true },
  )
  await batch.commit()
}

export async function updateSimpleExpenseEstimate(workspaceId, categoryId, estimate, userId) {
  await ensureModelConfig(workspaceId, 'expenses')
  const normalizedEstimate = normalizeExpenseEstimate(estimate)
  if (!normalizedEstimate) throw new Error('A valid non-negative expense estimate is required')
  const manualValue = annualExpenseValue(normalizedEstimate)
  const documentRef = configRef(workspaceId)
  const baselineRef = doc(modelExpensesRef(workspaceId), modelBaselineId(categoryId))

  return runTransaction(db, async (transaction) => {
    const [snapshot, baselineSnapshot] = await Promise.all([
      transaction.get(documentRef),
      transaction.get(baselineRef),
    ])
    const category = snapshot.data()?.categories?.[categoryId]
    if (!category?.enabled || !baselineSnapshot.exists()) {
      throw new Error('Only simple expense categories can be edited directly')
    }
    transaction.update(baselineRef, {
      estimate: normalizedEstimate,
      monthlyAmounts: generateMonthlyExpenseAmounts(normalizedEstimate),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    })
    return {
      manualEstimate: normalizedEstimate,
      manualValue,
      ownership: baselineSnapshot.data().ownership,
      necessity: baselineSnapshot.data().necessity ?? null,
    }
  })
}

export async function updateSimpleExpenseOwnership(
  workspaceId,
  categoryId,
  ownership,
  userId,
  memberIds,
) {
  await ensureModelConfig(workspaceId, 'expenses')
  assertValidOwnership(ownership, memberIds)
  const documentRef = configRef(workspaceId)
  const baselineRef = doc(modelExpensesRef(workspaceId), modelBaselineId(categoryId))
  return runTransaction(db, async (transaction) => {
    const [snapshot, baselineSnapshot] = await Promise.all([
      transaction.get(documentRef),
      transaction.get(baselineRef),
    ])
    const category = snapshot.data()?.categories?.[categoryId]
    if (!category?.enabled || !baselineSnapshot.exists()) {
      throw new Error('Only simple expense category ownership can be edited')
    }
    transaction.update(baselineRef, {
      ownership: cloneOwnership(ownership),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    })
    return {
      manualEstimate: baselineSnapshot.data().estimate,
      manualValue: expenseAnnualValue(baselineSnapshot.data()),
      ownership: cloneOwnership(ownership),
      necessity: baselineSnapshot.data().necessity ?? null,
    }
  })
}

export async function createExpense(workspaceId, expense, userId, memberIds) {
  await ensureModelConfig(workspaceId, 'expenses')
  assertValidOwnership(expense.ownership, memberIds)
  const normalized = normalizeExpenseItem(expense)
  const itemRef =
    normalized.type === 'other'
      ? doc(modelExpensesRef(workspaceId))
      : doc(modelExpensesRef(workspaceId), standardExpenseDocumentId(normalized))
  const documentRef = configRef(workspaceId)

  return runTransaction(db, async (transaction) => {
    const [configSnapshot, existingItemSnapshot] = await Promise.all([
      transaction.get(documentRef),
      normalized.type === 'other' ? Promise.resolve(null) : transaction.get(itemRef),
    ])
    const category = configSnapshot.data()?.categories?.[normalized.category]
    if (!category?.enabled) throw new Error('Expense category is not enabled')
    if (existingItemSnapshot?.exists()) {
      throw new Error('Only one expense is allowed for each standard subcategory')
    }

    const itemData = {
      ...normalized,
      ownership: cloneOwnership(expense.ownership),
      createdAt: serverTimestamp(),
      createdBy: userId,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    }
    transaction.set(itemRef, itemData)
    return {
      expense: { ...itemData, id: itemRef.id, createdAt: null, updatedAt: null },
    }
  })
}

export async function updateExpense(workspaceId, expenseId, changes, userId, memberIds) {
  await ensureModelConfig(workspaceId, 'expenses')
  const itemRef = doc(modelExpensesRef(workspaceId), expenseId)
  const documentRef = configRef(workspaceId)
  return runTransaction(db, async (transaction) => {
    const [itemSnapshot, configSnapshot] = await Promise.all([
      transaction.get(itemRef),
      transaction.get(documentRef),
    ])
    if (!itemSnapshot.exists()) throw new Error('Expense not found')

    const previousExpense = itemSnapshot.data()
    if (changes.type && changes.type !== previousExpense.type) {
      throw new Error('An expense subcategory cannot be changed after creation')
    }
    const categoryId = previousExpense.category
    const category = configSnapshot.data()?.categories?.[categoryId]
    if (!category) {
      throw new Error('Itemized expense category not found')
    }

    const normalized = normalizeExpenseItem({
      ...previousExpense,
      ...changes,
      category: categoryId,
    })
    const updatedExpense = {
      ...previousExpense,
      ...normalized,
      ownership: cloneOwnership(changes.ownership || previousExpense.ownership),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    }
    assertValidOwnership(updatedExpense.ownership, memberIds)
    transaction.update(itemRef, updatedExpense)
    return {
      expense: { id: expenseId, ...updatedExpense, updatedAt: null },
    }
  })
}

export async function removeExpense(workspaceId, expenseId) {
  await ensureModelConfig(workspaceId, 'expenses')
  const itemRef = doc(modelExpensesRef(workspaceId), expenseId)
  const documentRef = configRef(workspaceId)
  return runTransaction(db, async (transaction) => {
    const [itemSnapshot, configSnapshot] = await Promise.all([
      transaction.get(itemRef),
      transaction.get(documentRef),
    ])
    if (!itemSnapshot.exists()) throw new Error('Expense not found')

    const expense = itemSnapshot.data()
    const category = configSnapshot.data()?.categories?.[expense.category]
    if (!category) throw new Error('Expense category not found')
    transaction.delete(itemRef)
    return {
      categoryId: expense.category,
    }
  })
}

export async function removeExpenseCategory(workspaceId, categoryId, userId) {
  const snapshot = await getDocs(
    query(modelExpensesRef(workspaceId), where('category', '==', categoryId)),
  )
  if (snapshot.size > 498) {
    throw new Error('Expense categories with more than 498 items cannot be deleted at once')
  }
  const batch = writeBatch(db)
  snapshot.docs.forEach((expenseDocument) => {
    if (isModelBaseline(expenseDocument.data())) {
      const estimate = { amount: 0, frequency: 'monthly' }
      batch.update(expenseDocument.ref, {
        estimate,
        monthlyAmounts: generateMonthlyExpenseAmounts(estimate),
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      })
    } else batch.delete(expenseDocument.ref)
  })
  batch.update(configRef(workspaceId), {
    [`categories.${categoryId}`]: deleteField(),
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  })
  await batch.commit()
}

function normalizeExpenseItem(expense) {
  const category = getExpenseCategory(expense.category)
  if (!category) throw new Error('A valid expense category is required')
  const type = String(expense.type || '').trim()
  if (type !== 'other' && !category.suggestions.some((suggestion) => suggestion.id === type)) {
    throw new Error('A valid expense type is required')
  }
  const name = String(expense.name || '').trim()
  if (!name) throw new Error('An expense name is required')

  const estimate = normalizeExpenseEstimate(expense.estimate)
  if (!estimate) throw new Error('A valid expense estimate is required')
  const monthlyAmounts =
    normalizeMonthlyExpenseAmounts(expense.monthlyAmounts) ||
    generateMonthlyExpenseAmounts(estimate)
  const attributes = normalizeExpenseAttributes(expense)
  if (!attributes) throw new Error('Valid expense behavior is required')

  return {
    category: category.id,
    type,
    name,
    estimate,
    monthlyAmounts,
    trackingEligible: type !== 'other' && expense.trackingEligible !== false,
    ...attributes,
  }
}

function standardExpenseDocumentId(expense) {
  return `${expense.category}--${expense.type}`
}

function expenseAnnualValue(expense) {
  return annualMonthlyExpenseValue(expense.monthlyAmounts, expense.estimate)
}

function canonicalExpenseCategories(categories) {
  return Object.fromEntries(
    Object.entries(canonicalCategories(categories)).map(([categoryId, category]) => {
      const canonical = { ...category }
      delete canonical.manualValue
      return [categoryId, canonical]
    }),
  )
}

function stampCategories(categories, userId) {
  return Object.fromEntries(
    Object.entries(categories).map(([categoryId, category]) => [
      categoryId,
      { ...category, updatedAt: serverTimestamp(), updatedBy: userId },
    ]),
  )
}

function setExpenseBaselines(batch, workspaceId, categories, userId) {
  for (const [categoryId, category] of Object.entries(categories)) {
    const estimate = normalizeExpenseEstimate(category.manualEstimate) || {
      amount: 0,
      frequency: 'monthly',
    }
    batch.set(
      doc(modelExpensesRef(workspaceId), modelBaselineId(categoryId)),
      {
        kind: MODEL_BASELINE_KIND,
        category: categoryId,
        estimate,
        monthlyAmounts: generateMonthlyExpenseAmounts(estimate),
        ownership: cloneOwnership(category.ownership),
        necessity: category.necessity ?? null,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      },
      { merge: true },
    )
  }
}

function assertValidOwnership(ownership, memberIds) {
  if (!isValidOwnership(ownership, memberIds)) {
    throw new Error('Ownership must reference workspace members and add up to 100%')
  }
}
