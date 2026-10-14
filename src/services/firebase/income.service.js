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
import { getIncomeCategory } from '@/config/income-categories'
import { normalizeIncomeCalculation } from '@/domain/financial/income-calculations'
import { normalizeMoney } from '@/domain/financial/money'
import { cloneOwnership, isValidOwnership } from '@/domain/financial/ownership'
import { canonicalCategories } from '@/domain/financial/model-categories'
import { currentUserId } from '@/services/firebase/current-user'
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

    const manualValue = normalizeMoney(value)
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
  const userId = currentUserId()
  assertValidOwnership(income.ownership, memberIds)
  const normalized = normalizeIncomeItem(income)
  const itemRef = doc(modelIncomeRef(workspaceId))
  const documentRef = configRef(workspaceId)

  return runTransaction(db, async (transaction) => {
    const configSnapshot = await transaction.get(documentRef)
    const category = configSnapshot.data()?.categories?.[normalized.category]
    if (!category?.enabled) throw new Error('Income category is not enabled')

    const itemData = {
      ...income,
      ...normalized,
      ownership: cloneOwnership(income.ownership),
      createdAt: serverTimestamp(),
      createdBy: userId,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    }
    transaction.set(itemRef, itemData)
    return {
      income: { ...itemData, id: itemRef.id, createdAt: null, updatedAt: null },
    }
  })
}

export async function updateIncome(workspaceId, incomeId, changes, memberIds) {
  const userId = currentUserId()
  const itemRef = doc(modelIncomeRef(workspaceId), incomeId)
  const documentRef = configRef(workspaceId)
  return runTransaction(db, async (transaction) => {
    const [itemSnapshot, configSnapshot] = await Promise.all([
      transaction.get(itemRef),
      transaction.get(documentRef),
    ])
    if (!itemSnapshot.exists()) throw new Error('Income source not found')

    const previousIncome = itemSnapshot.data()
    const categoryId = previousIncome.category
    const category = configSnapshot.data()?.categories?.[categoryId]
    if (!category) {
      throw new Error('Itemized income category not found')
    }

    const normalized = normalizeIncomeItem({ ...previousIncome, ...changes, category: categoryId })
    const updatedIncome = {
      ...previousIncome,
      ...changes,
      ...normalized,
      category: categoryId,
      ownership: cloneOwnership(changes.ownership || previousIncome.ownership),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    }
    assertValidOwnership(updatedIncome.ownership, memberIds)
    transaction.update(itemRef, updatedIncome)
    return {
      income: { id: incomeId, ...updatedIncome, updatedAt: null },
    }
  })
}

export async function deleteIncome(workspaceId, incomeId) {
  const itemRef = doc(modelIncomeRef(workspaceId), incomeId)
  const documentRef = configRef(workspaceId)
  return runTransaction(db, async (transaction) => {
    const [itemSnapshot, configSnapshot] = await Promise.all([
      transaction.get(itemRef),
      transaction.get(documentRef),
    ])
    if (!itemSnapshot.exists()) throw new Error('Income source not found')

    const income = itemSnapshot.data()
    const category = configSnapshot.data()?.categories?.[income.category]
    if (!category) throw new Error('Income category not found')
    transaction.delete(itemRef)
    return {
      categoryId: income.category,
    }
  })
}

export async function deleteIncomeCategory(workspaceId, categoryId) {
  const userId = currentUserId()
  const snapshot = await getDocs(
    query(modelIncomeRef(workspaceId), where('category', '==', categoryId)),
  )
  if (snapshot.size > 498) {
    throw new Error('Income categories with more than 498 sources cannot be deleted at once')
  }
  const batch = writeBatch(db)
  snapshot.docs.forEach((incomeDocument) => batch.delete(incomeDocument.ref))
  batch.update(configRef(workspaceId), {
    [`categories.${categoryId}`]: deleteField(),
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  })
  await batch.commit()
}

function normalizeIncomeItem(income) {
  const category = getIncomeCategory(income.category)
  if (!category) throw new Error('A valid income category is required')
  if (!category.subtypes.includes(income.subtype))
    throw new Error('A valid income type is required')
  if (!String(income.name || '').trim()) throw new Error('An income source name is required')

  const calculation = normalizeIncomeCalculation(income.calculation)
  if (!calculation || !category.calculationModes.includes(calculation.mode)) {
    throw new Error('A valid income calculation is required')
  }
  return { category: category.id, subtype: income.subtype, name: income.name.trim(), calculation }
}

function assertValidOwnership(ownership, memberIds) {
  if (!isValidOwnership(ownership, memberIds)) {
    throw new Error('Ownership must reference workspace members and add up to 100%')
  }
}
