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
  annualExpenseValue,
  generateMonthlyExpenseAmounts,
  normalizeExpenseAttributes,
  normalizeExpenseEstimate,
  normalizeMonthlyExpenseAmounts,
} from '@/domain/financial/expense-calculations'
import { cloneOwnership, isValidOwnership } from '@/domain/financial/ownership'
import { canonicalCategories } from '@/domain/financial/model-categories'
import { currentUserId } from '@/services/firebase/current-user'
import { getModelConfig, modelConfigRef } from '@/services/firebase/model-config.service'

function configRef(workspaceId) {
  return modelConfigRef(workspaceId, 'expenses')
}

function modelExpensesRef(workspaceId) {
  return collection(db, 'workspaces', workspaceId, 'modelExpenses')
}

export async function getExpensesConfig(workspaceId) {
  return getModelConfig(workspaceId, 'expenses')
}

export async function getCategoryExpenses(workspaceId, categoryId) {
  const snapshot = await getDocs(
    query(modelExpensesRef(workspaceId), where('category', '==', categoryId)),
  )
  return snapshot.docs.map((expenseDocument) => ({
    id: expenseDocument.id,
    ...expenseDocument.data(),
  }))
}

export async function saveExpensesSetup(workspaceId, categories) {
  const userId = currentUserId()
  const batch = writeBatch(db)
  batch.set(
    configRef(workspaceId),
    {
      schemaVersion: 1,
      setupCompleted: true,
      categories: canonicalExpenseCategories(categories),
      createdAt: serverTimestamp(),
      createdBy: userId,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    },
    { merge: true },
  )
  await batch.commit()
}

export async function updateExpensesCategories(workspaceId, categories) {
  const userId = currentUserId()
  const batch = writeBatch(db)
  batch.set(
    configRef(workspaceId),
    {
      setupCompleted: true,
      categories: canonicalExpenseCategories(categories),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    },
    { merge: true },
  )
  await batch.commit()
}

export async function updateSimpleExpenseEstimate(workspaceId, categoryId, estimate) {
  const userId = currentUserId()
  const normalizedEstimate = normalizeExpenseEstimate(estimate)
  if (!normalizedEstimate) throw new Error('A valid non-negative expense estimate is required')
  const manualValue = annualExpenseValue(normalizedEstimate)
  const documentRef = configRef(workspaceId)

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(documentRef)
    const category = snapshot.data()?.categories?.[categoryId]
    if (!category?.enabled) {
      throw new Error('Only simple expense categories can be edited directly')
    }
    const updatedCategory = {
      ...category,
      manualEstimate: normalizedEstimate,
      manualValue,
      monthlyAmounts: generateMonthlyExpenseAmounts(normalizedEstimate),
    }
    transaction.update(documentRef, {
      [`categories.${categoryId}`]: updatedCategory,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    })
    return updatedCategory
  })
}

export async function updateSimpleExpenseOwnership(workspaceId, categoryId, ownership, memberIds) {
  const userId = currentUserId()
  assertValidOwnership(ownership, memberIds)
  const documentRef = configRef(workspaceId)
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(documentRef)
    const category = snapshot.data()?.categories?.[categoryId]
    if (!category?.enabled) {
      throw new Error('Only simple expense category ownership can be edited')
    }
    const updatedCategory = { ...category, ownership: cloneOwnership(ownership) }
    transaction.update(documentRef, {
      [`categories.${categoryId}`]: updatedCategory,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    })
    return updatedCategory
  })
}

export async function createExpense(workspaceId, expense, memberIds) {
  const userId = currentUserId()
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

export async function updateExpense(workspaceId, expenseId, changes, memberIds) {
  const userId = currentUserId()
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

export async function deleteExpense(workspaceId, expenseId) {
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

export async function deleteExpenseCategory(workspaceId, categoryId) {
  const userId = currentUserId()
  const snapshot = await getDocs(
    query(modelExpensesRef(workspaceId), where('category', '==', categoryId)),
  )
  if (snapshot.size > 498) {
    throw new Error('Expense categories with more than 498 items cannot be deleted at once')
  }
  const batch = writeBatch(db)
  snapshot.docs.forEach((expenseDocument) => batch.delete(expenseDocument.ref))
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

function canonicalExpenseCategories(categories) {
  return Object.fromEntries(
    Object.entries(canonicalCategories(categories)).map(([categoryId, category]) => {
      const canonical = { ...category }
      delete canonical.manualValue
      return [categoryId, canonical]
    }),
  )
}

function assertValidOwnership(ownership, memberIds) {
  if (!isValidOwnership(ownership, memberIds)) {
    throw new Error('Ownership must reference workspace members and add up to 100%')
  }
}
