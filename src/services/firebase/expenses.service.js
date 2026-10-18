import { collection, getDocs, query, serverTimestamp, where, writeBatch } from 'firebase/firestore'
import { db } from '@/firebase/firebase'
import { getExpenseCategory, getExpenseSubcategory } from '@/config/expense-categories'
import {
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
    query(modelExpensesRef(workspaceId), where('categoryId', '==', categoryId)),
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
      schemaVersion: 1,
      setupCompleted: true,
      categories: canonicalExpenseCategories(categories),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    },
    { merge: true },
  )
  await batch.commit()
}

export async function createExpense(workspaceId, expense, memberIds) {
  assertValidOwnership(expense.ownership, memberIds)
  return createFinancialModelItem(workspaceId, 'expenses', normalizeExpenseItem(expense))
}

export async function updateExpense(workspaceId, expenseId, changes, memberIds) {
  assertValidOwnership(changes.ownership, memberIds)
  return updateFinancialModelItem(workspaceId, 'expenses', expenseId, normalizeExpenseItem(changes))
}

export async function deleteExpense(workspaceId, expenseId) {
  return deleteFinancialModelItem(workspaceId, 'expenses', expenseId)
}

export async function deleteExpenseCategory(workspaceId, categoryId) {
  await deleteFinancialModelCategory(workspaceId, 'expenses', categoryId)
}

function normalizeExpenseItem(expense) {
  const category = getExpenseCategory(expense.categoryId)
  if (!category) throw new Error('A valid expense category is required')
  const subcategoryId = String(expense.subcategoryId || '').trim()
  const subcategory = getExpenseSubcategory(subcategoryId)
  if (!subcategory || subcategory.categoryId !== category.id) {
    throw new Error('A valid expense subcategory is required')
  }
  const itemName = String(expense.itemName || '').trim()
  if (!itemName) throw new Error('An item name is required')

  const estimate = normalizeExpenseEstimate(expense.estimate)
  if (!estimate) throw new Error('A valid expense estimate is required')
  const monthlyAmounts =
    normalizeMonthlyExpenseAmounts(expense.monthlyAmounts) ||
    generateMonthlyExpenseAmounts(estimate)
  const attributes = normalizeExpenseAttributes(expense)
  if (!attributes) throw new Error('Valid expense behavior is required')

  return {
    categoryId: category.id,
    subcategoryId,
    itemName,
    notes: String(expense.notes || '').trim(),
    estimate,
    monthlyAmounts,
    ...attributes,
    ownership: cloneOwnership(expense.ownership),
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
