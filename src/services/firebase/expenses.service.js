import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
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
import {
  allocateValueByOwnership,
  cloneOwnership,
  createEqualOwnership,
  isValidOwnership,
} from '@/domain/financial/ownership'
import { rebuildExpenseCategorySummary } from '@/domain/financial/expense-summary'

function summaryRef(workspaceId) {
  return doc(db, 'workspaces', workspaceId, 'cashFlow', 'expensesSummary')
}

function expensesRef(workspaceId) {
  return collection(db, 'workspaces', workspaceId, 'expenses')
}

export async function getExpensesSummary(workspaceId) {
  const documentRef = summaryRef(workspaceId)
  const [snapshot, expensesSnapshot] = await Promise.all([
    getDoc(documentRef),
    getDocs(expensesRef(workspaceId)),
  ])
  if (!snapshot.exists()) return null

  const summary = snapshot.data()
  const expenses = expensesSnapshot.docs.map((expenseDocument) => ({
    id: expenseDocument.id,
    ...expenseDocument.data(),
  }))
  const categories = rebuildExpenseCategories(summary.categories, expenses)
  if (expenseCategoryTotalsChanged(summary.categories, categories)) {
    await setDoc(documentRef, { categories, updatedAt: serverTimestamp() }, { merge: true })
  }
  return { ...summary, categories }
}

export async function getCategoryExpenses(workspaceId, categoryId) {
  const snapshot = await getDocs(
    query(expensesRef(workspaceId), where('category', '==', categoryId)),
  )
  return snapshot.docs.map((expenseDocument) => ({
    id: expenseDocument.id,
    ...expenseDocument.data(),
  }))
}

export async function saveExpensesSetup(workspaceId, categories, userId) {
  await setDoc(summaryRef(workspaceId), {
    setupCompleted: true,
    categories: stampCategories(categories, userId),
    createdAt: serverTimestamp(),
    createdBy: userId,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  })
}

export async function updateExpensesCategories(workspaceId, categories, userId) {
  await setDoc(
    summaryRef(workspaceId),
    {
      setupCompleted: true,
      categories: stampCategories(categories, userId),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    },
    { merge: true },
  )
}

export async function updateSimpleExpenseEstimate(workspaceId, categoryId, estimate, userId) {
  const normalizedEstimate = normalizeExpenseEstimate(estimate)
  if (!normalizedEstimate) throw new Error('A valid non-negative expense estimate is required')
  const manualValue = annualExpenseValue(normalizedEstimate)
  const documentRef = summaryRef(workspaceId)

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(documentRef)
    const category = snapshot.data()?.categories?.[categoryId]
    if (!category || Number(category.itemCount || 0) !== 0) {
      throw new Error('Only simple expense categories can be edited directly')
    }

    const updatedCategory = {
      ...category,
      manualEstimate: normalizedEstimate,
      manualValue,
      memberValues: allocateValueByOwnership(manualValue, category.ownership),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    }
    transaction.update(documentRef, {
      [`categories.${categoryId}`]: updatedCategory,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    })
    return { ...updatedCategory, updatedAt: null }
  })
}

export async function updateSimpleExpenseOwnership(
  workspaceId,
  categoryId,
  ownership,
  userId,
  memberIds,
) {
  assertValidOwnership(ownership, memberIds)
  const documentRef = summaryRef(workspaceId)
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(documentRef)
    const category = snapshot.data()?.categories?.[categoryId]
    if (!category || Number(category.itemCount || 0) !== 0) {
      throw new Error('Only simple expense category ownership can be edited')
    }
    const updatedCategory = {
      ...category,
      ownership: cloneOwnership(ownership),
      memberValues: allocateValueByOwnership(category.manualValue, ownership),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    }
    transaction.update(documentRef, {
      [`categories.${categoryId}`]: updatedCategory,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    })
    return { ...updatedCategory, updatedAt: null }
  })
}

export async function createExpense(workspaceId, expense, userId, memberIds) {
  assertValidOwnership(expense.ownership, memberIds)
  const normalized = normalizeExpenseItem(expense)
  const itemRef = doc(expensesRef(workspaceId))
  const documentRef = summaryRef(workspaceId)
  const existingExpenses = await getCategoryExpenses(workspaceId, normalized.category)

  return runTransaction(db, async (transaction) => {
    const summarySnapshot = await transaction.get(documentRef)
    const category = summarySnapshot.data()?.categories?.[normalized.category]
    if (!category?.enabled) throw new Error('Expense category is not enabled')

    const itemData = {
      ...normalized,
      ownership: cloneOwnership(expense.ownership),
      createdAt: serverTimestamp(),
      createdBy: userId,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    }
    const updatedCategory = {
      ...rebuildExpenseCategorySummary(category, [...existingExpenses, itemData]),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    }
    transaction.set(itemRef, itemData)
    transaction.update(documentRef, {
      [`categories.${normalized.category}`]: updatedCategory,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    })
    return {
      expense: { ...itemData, id: itemRef.id, createdAt: null, updatedAt: null },
      category: { ...updatedCategory, updatedAt: null },
    }
  })
}

export async function updateExpense(workspaceId, expenseId, changes, userId, memberIds) {
  const itemRef = doc(expensesRef(workspaceId), expenseId)
  const documentRef = summaryRef(workspaceId)
  const previousDocument = await getDoc(itemRef)
  if (!previousDocument.exists()) throw new Error('Expense not found')
  const categoryExpenses = await getCategoryExpenses(workspaceId, previousDocument.data().category)

  return runTransaction(db, async (transaction) => {
    const [itemSnapshot, summarySnapshot] = await Promise.all([
      transaction.get(itemRef),
      transaction.get(documentRef),
    ])
    if (!itemSnapshot.exists()) throw new Error('Expense not found')

    const previousExpense = itemSnapshot.data()
    const categoryId = previousExpense.category
    const category = summarySnapshot.data()?.categories?.[categoryId]
    if (!category || Number(category.itemCount || 0) === 0) {
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
    const updatedCategory = {
      ...rebuildExpenseCategorySummary(
        category,
        categoryExpenses.map((expense) =>
          expense.id === expenseId ? { ...updatedExpense, id: expenseId } : expense,
        ),
      ),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    }
    transaction.update(itemRef, updatedExpense)
    transaction.update(documentRef, {
      [`categories.${categoryId}`]: updatedCategory,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    })
    return {
      expense: { id: expenseId, ...updatedExpense, updatedAt: null },
      category: { ...updatedCategory, updatedAt: null },
    }
  })
}

export async function removeExpense(workspaceId, expenseId, userId, memberIds) {
  const itemRef = doc(expensesRef(workspaceId), expenseId)
  const documentRef = summaryRef(workspaceId)
  const previousDocument = await getDoc(itemRef)
  if (!previousDocument.exists()) throw new Error('Expense not found')
  const categoryExpenses = await getCategoryExpenses(workspaceId, previousDocument.data().category)

  return runTransaction(db, async (transaction) => {
    const [itemSnapshot, summarySnapshot] = await Promise.all([
      transaction.get(itemRef),
      transaction.get(documentRef),
    ])
    if (!itemSnapshot.exists()) throw new Error('Expense not found')

    const expense = itemSnapshot.data()
    const category = summarySnapshot.data()?.categories?.[expense.category]
    if (!category) throw new Error('Expense category not found')
    const updatedCategory = {
      ...rebuildExpenseCategorySummary(
        categoryExpenses.length === 1
          ? { ...category, ownership: createEqualOwnership(memberIds) }
          : category,
        categoryExpenses.filter((candidate) => candidate.id !== expenseId),
      ),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    }
    transaction.delete(itemRef)
    transaction.update(documentRef, {
      [`categories.${expense.category}`]: updatedCategory,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    })
    return {
      categoryId: expense.category,
      category: { ...updatedCategory, updatedAt: null },
    }
  })
}

export async function removeExpenseCategory(workspaceId, categoryId, userId) {
  const snapshot = await getDocs(
    query(expensesRef(workspaceId), where('category', '==', categoryId)),
  )
  if (snapshot.size > 498) {
    throw new Error('Expense categories with more than 498 items cannot be deleted at once')
  }
  const batch = writeBatch(db)
  snapshot.docs.forEach((expenseDocument) => batch.delete(expenseDocument.ref))
  batch.update(summaryRef(workspaceId), {
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

  return { category: category.id, type, name, estimate, monthlyAmounts, ...attributes }
}

function rebuildExpenseCategories(categories = {}, expenses = []) {
  const expensesByCategory = expenses.reduce((groups, expense) => {
    const categoryId = expense.category
    groups[categoryId] = [...(groups[categoryId] || []), expense]
    return groups
  }, {})
  return Object.fromEntries(
    Object.entries(categories).map(([categoryId, category]) => {
      const categoryExpenses = expensesByCategory[categoryId] || []
      if (!categoryExpenses.length && Number(category.itemCount || 0) === 0) {
        return [categoryId, category]
      }
      return [categoryId, rebuildExpenseCategorySummary(category, categoryExpenses)]
    }),
  )
}

function expenseCategoryTotalsChanged(previous = {}, next = {}) {
  return Object.keys(next).some((categoryId) => {
    const before = previous[categoryId]
    const after = next[categoryId]
    return (
      Number(before?.itemCount || 0) !== Number(after?.itemCount || 0) ||
      Number(before?.itemizedValue || 0) !== Number(after?.itemizedValue || 0) ||
      JSON.stringify(before?.memberValues || {}) !== JSON.stringify(after?.memberValues || {})
    )
  })
}

function stampCategories(categories, userId) {
  return Object.fromEntries(
    Object.entries(categories).map(([categoryId, category]) => [
      categoryId,
      { ...category, updatedAt: serverTimestamp(), updatedBy: userId },
    ]),
  )
}

function assertValidOwnership(ownership, memberIds) {
  if (!isValidOwnership(ownership, memberIds)) {
    throw new Error('Ownership must reference workspace members and add up to 100%')
  }
}

// Layers 1 and 2 model the expected cash required to sustain the user's life.
// Layer 3 may adjust the true economic Cost of Life when a payment partly
// represents a wealth transfer, such as principal reducing a liability.
export const EXPENSE_COST_MODEL = 'expected_cash_requirement'
