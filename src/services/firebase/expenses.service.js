import {
  collection,
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
import {
  createFinancialModelItem,
  deleteFinancialModelCategory,
  deleteFinancialModelItem,
  updateFinancialModelItem,
} from '@/services/firebase/financial-model-mutations.service'
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
  assertValidOwnership(expense.ownership, memberIds)
  return createFinancialModelItem(workspaceId, 'expenses', normalizeExpenseItem(expense))
}

export async function updateExpense(workspaceId, expenseId, changes, memberIds) {
  assertValidOwnership(changes.ownership, memberIds)
  return updateFinancialModelItem(workspaceId, 'expenses', expenseId, changes)
}

export async function deleteExpense(workspaceId, expenseId) {
  return deleteFinancialModelItem(workspaceId, 'expenses', expenseId)
}

export async function deleteExpenseCategory(workspaceId, categoryId) {
  await deleteFinancialModelCategory(workspaceId, 'expenses', categoryId)
}

function normalizeExpenseItem(expense) {
  const category = getExpenseCategory(expense.category)
  if (!category) throw new Error('A valid expense category is required')
  const type = String(expense.type || '').trim()
  if (type !== 'other' && !category.suggestions.some((suggestion) => suggestion.id === type)) {
    throw new Error('A valid expense type is required')
  }
  const name = String(expense.name || '').trim()

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
