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
import { currentUserId } from '@/services/firebase/current-user'
import {
  createFinancialModelItem,
  deleteFinancialModelCategory,
  deleteFinancialModelItem,
  updateFinancialModelItem,
} from '@/services/firebase/financial-model-mutations.service'
import { getModelConfig, modelConfigRef } from '@/services/firebase/model-config.service'
import { normalizeMoney } from '@/domain/financial/money'
import { cloneOwnership, isValidOwnership } from '@/domain/financial/ownership'
import { canonicalCategories } from '@/domain/financial/model-categories'

function configRef(workspaceId) {
  return modelConfigRef(workspaceId, 'liabilities')
}

function modelLiabilitiesRef(workspaceId) {
  return collection(db, 'workspaces', workspaceId, 'modelLiabilities')
}

export async function getLiabilitiesConfig(workspaceId) {
  return getModelConfig(workspaceId, 'liabilities')
}

export async function getCategoryLiabilities(workspaceId, categoryId) {
  const snapshot = await getDocs(
    query(modelLiabilitiesRef(workspaceId), where('category', '==', categoryId)),
  )
  return snapshot.docs.map((liabilityDocument) => ({
    id: liabilityDocument.id,
    ...liabilityDocument.data(),
  }))
}

export async function saveLiabilitiesSetup(workspaceId, categories) {
  const userId = currentUserId()
  const batch = writeBatch(db)
  batch.set(configRef(workspaceId), {
    schemaVersion: 1,
    setupCompleted: true,
    categories: canonicalCategories(categories),
    createdAt: serverTimestamp(),
    createdBy: userId,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  })
  await batch.commit()
}

export async function updateLiabilityCategories(workspaceId, categories) {
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

export async function updateSimpleLiabilityValue(workspaceId, categoryId, value) {
  const userId = currentUserId()
  const documentRef = configRef(workspaceId)
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(documentRef)
    const category = snapshot.data()?.categories?.[categoryId]
    if (!category?.enabled) {
      throw new Error('Only simple liability categories can be edited directly')
    }

    const manualValue = normalizeMoney(value)
    if (manualValue === null) throw new Error('A non-negative numeric value is required')

    const updatedCategory = { ...category, manualValue }
    transaction.update(documentRef, {
      [`categories.${categoryId}`]: updatedCategory,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    })
    return updatedCategory
  })
}

export async function updateSimpleLiabilityOwnership(
  workspaceId,
  categoryId,
  ownership,
  memberIds,
) {
  const userId = currentUserId()
  assertValidOwnership(ownership, memberIds)
  const documentRef = configRef(workspaceId)
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(documentRef)
    const category = snapshot.data()?.categories?.[categoryId]
    if (!category?.enabled) {
      throw new Error('Only simple liability category ownership can be edited')
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

export async function createLiability(workspaceId, liability, memberIds) {
  assertValidOwnership(liability.ownership, memberIds)
  return createFinancialModelItem(workspaceId, 'liabilities', liability)
}

export async function updateLiability(workspaceId, liabilityId, changes, memberIds) {
  assertValidOwnership(changes.ownership, memberIds)
  return updateFinancialModelItem(workspaceId, 'liabilities', liabilityId, changes)
}

export async function deleteLiability(workspaceId, liabilityId) {
  return deleteFinancialModelItem(workspaceId, 'liabilities', liabilityId)
}

export async function deleteLiabilityCategory(workspaceId, categoryId) {
  await deleteFinancialModelCategory(workspaceId, 'liabilities', categoryId)
}

function assertValidOwnership(ownership, memberIds) {
  if (!isValidOwnership(ownership, memberIds)) {
    throw new Error('Ownership must reference workspace members and add up to 100%')
  }
}
