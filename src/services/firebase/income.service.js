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
import { getIncomeCategory } from '@/config/income-categories'
import { normalizeIncomeCalculation } from '@/domain/financial/income-calculations'
import { normalizeNonNegativeMoney } from '@/domain/financial/money'
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
  return modelConfigRef(workspaceId, 'income')
}

function modelIncomeRef(workspaceId) {
  return collection(db, 'workspaces', workspaceId, 'modelIncome')
}

export async function getIncomeConfig(workspaceId) {
  return getModelConfig(workspaceId, 'income')
}

export async function getCategoryIncome(workspaceId, categoryId) {
  const snapshot = await getDocs(
    query(modelIncomeRef(workspaceId), where('category', '==', categoryId)),
  )
  return snapshot.docs.map((incomeDocument) => ({
    id: incomeDocument.id,
    ...incomeDocument.data(),
  }))
}

export async function saveIncomeSetup(workspaceId, categories) {
  const userId = currentUserId()
  const batch = writeBatch(db)
  batch.set(
    configRef(workspaceId),
    {
      schemaVersion: 1,
      setupCompleted: true,
      categories: canonicalCategories(categories),
      createdAt: serverTimestamp(),
      createdBy: userId,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    },
    { merge: true },
  )
  await batch.commit()
}

export async function updateIncomeCategories(workspaceId, categories) {
  const userId = currentUserId()
  const batch = writeBatch(db)
  batch.set(
    configRef(workspaceId),
    {
      setupCompleted: true,
      categories: canonicalCategories(categories),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    },
    { merge: true },
  )
  await batch.commit()
}

export async function updateSimpleIncomeValue(workspaceId, categoryId, value) {
  const userId = currentUserId()
  const documentRef = configRef(workspaceId)
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(documentRef)
    const category = snapshot.data()?.categories?.[categoryId]
    if (!category?.enabled) {
      throw new Error('Only simple income categories can be edited directly')
    }

    const manualValue = normalizeNonNegativeMoney(value)
    if (manualValue === null) throw new Error('A non-negative annual income is required')
    const updatedCategory = { ...category, manualValue }
    transaction.update(documentRef, {
      [`categories.${categoryId}`]: updatedCategory,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    })
    return updatedCategory
  })
}

export async function updateSimpleIncomeOwnership(workspaceId, categoryId, ownership, memberIds) {
  const userId = currentUserId()
  assertValidOwnership(ownership, memberIds)
  const documentRef = configRef(workspaceId)
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(documentRef)
    const category = snapshot.data()?.categories?.[categoryId]
    if (!category?.enabled) {
      throw new Error('Only simple income category ownership can be edited')
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

export async function createIncome(workspaceId, income, memberIds) {
  assertValidOwnership(income.ownership, memberIds)
  const normalized = normalizeIncomeItem(income)
  return createFinancialModelItem(workspaceId, 'income', {
    ...income,
    ...normalized,
    ownership: cloneOwnership(income.ownership),
  })
}

export async function updateIncome(workspaceId, incomeId, changes, memberIds) {
  assertValidOwnership(changes.ownership, memberIds)
  return updateFinancialModelItem(workspaceId, 'income', incomeId, {
    ...normalizeIncomeItem(changes),
    ownership: cloneOwnership(changes.ownership),
  })
}

export async function deleteIncome(workspaceId, incomeId) {
  return deleteFinancialModelItem(workspaceId, 'income', incomeId)
}

export async function deleteIncomeCategory(workspaceId, categoryId) {
  await deleteFinancialModelCategory(workspaceId, 'income', categoryId)
}

function normalizeIncomeItem(income) {
  const category = getIncomeCategory(income.category)
  if (!category) throw new Error('A valid income category is required')
  if (!category.subtypes.includes(income.subtype))
    throw new Error('A valid income type is required')
  const calculation = normalizeIncomeCalculation(income.calculation)
  if (!calculation || !category.calculationModes.includes(calculation.mode)) {
    throw new Error('A valid income calculation is required')
  }
  return {
    category: category.id,
    subtype: income.subtype,
    name: String(income.name || '').trim(),
    calculation,
  }
}

function assertValidOwnership(ownership, memberIds) {
  if (!isValidOwnership(ownership, memberIds)) {
    throw new Error('Ownership must reference workspace members and add up to 100%')
  }
}
