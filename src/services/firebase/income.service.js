import { collection, getDocs, query, serverTimestamp, where, writeBatch } from 'firebase/firestore'
import { db } from '@/firebase/firebase'
import { getIncomeCategory, getIncomeSubcategory } from '@/config/income-categories'
import {
  normalizeDisposablePercentage,
  normalizeIncomeCalculation,
} from '@/domain/financial/income-calculations'
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
    query(modelIncomeRef(workspaceId), where('categoryId', '==', categoryId)),
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
      schemaVersion: 1,
      setupCompleted: true,
      categories: canonicalCategories(categories),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    },
    { merge: true },
  )
  await batch.commit()
}

export async function createIncome(workspaceId, income, memberIds) {
  assertValidOwnership(income.ownership, memberIds)
  const normalized = normalizeIncomeItem(income)
  return createFinancialModelItem(workspaceId, 'income', {
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
  const category = getIncomeCategory(income.categoryId)
  if (!category) throw new Error('A valid income category is required')
  const subcategory = getIncomeSubcategory(income.subcategoryId)
  if (!subcategory || subcategory.categoryId !== category.id) {
    throw new Error('A valid income subcategory is required')
  }
  const itemName = String(income.itemName || '').trim()
  if (!itemName) throw new Error('An income item name is required')
  const calculation = normalizeIncomeCalculation(income.calculation)
  if (!calculation || !category.calculationModes.includes(calculation.mode)) {
    throw new Error('A valid income calculation is required')
  }
  const isDividendIncome = category.id === 'investments' && subcategory.id === 'dividends'
  const disposablePercentage = isDividendIncome
    ? normalizeDisposablePercentage(income.disposablePercentage, 100)
    : 100
  if (disposablePercentage === null) {
    throw new Error('A valid available-income percentage is required')
  }
  const normalized = {
    categoryId: category.id,
    subcategoryId: subcategory.id,
    itemName,
    notes: String(income.notes || '').trim(),
    calculation,
    disposablePercentage,
    portfolioAssetId: isDividendIncome ? normalizeOptionalId(income.portfolioAssetId) : null,
  }
  if (income.entryMode === 'simple' || income.entryMode === 'detailed') {
    normalized.entryMode = income.entryMode
  }
  return normalized
}

function normalizeOptionalId(value) {
  const normalized = String(value || '').trim()
  return normalized || null
}

function assertValidOwnership(ownership, memberIds) {
  if (!isValidOwnership(ownership, memberIds)) {
    throw new Error('Ownership must reference workspace members and add up to 100%')
  }
}
