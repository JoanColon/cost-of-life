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
  return modelConfigRef(workspaceId, 'assets')
}

function modelAssetsRef(workspaceId) {
  return collection(db, 'workspaces', workspaceId, 'modelAssets')
}

export async function getAssetsConfig(workspaceId) {
  return getModelConfig(workspaceId, 'assets')
}

export async function getCategoryAssets(workspaceId, categoryId) {
  const snapshot = await getDocs(
    query(modelAssetsRef(workspaceId), where('category', '==', categoryId)),
  )

  return snapshot.docs.map((assetDocument) => ({ id: assetDocument.id, ...assetDocument.data() }))
}

export async function saveAssetsSetup(workspaceId, categories) {
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

export async function updateAssetsCategories(workspaceId, categories) {
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

export async function updateSimpleCategoryValue(workspaceId, categoryId, value) {
  const userId = currentUserId()
  const documentRef = configRef(workspaceId)

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(documentRef)
    const category = snapshot.data()?.categories?.[categoryId]
    if (!category?.enabled) {
      throw new Error('Only simple asset categories can be edited directly')
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

export async function updateSimpleCategoryOwnership(workspaceId, categoryId, ownership, memberIds) {
  const userId = currentUserId()
  assertValidOwnership(ownership, memberIds)
  const documentRef = configRef(workspaceId)

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(documentRef)
    const category = snapshot.data()?.categories?.[categoryId]
    if (!category?.enabled) {
      throw new Error('Only simple asset category ownership can be edited')
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

export async function createAsset(workspaceId, asset, memberIds) {
  assertValidOwnership(asset.ownership, memberIds)
  return createFinancialModelItem(workspaceId, 'assets', asset)
}

export async function updateAsset(workspaceId, assetId, changes, memberIds) {
  assertValidOwnership(changes.ownership, memberIds)
  return updateFinancialModelItem(workspaceId, 'assets', assetId, changes)
}

export async function deleteAsset(workspaceId, assetId) {
  return deleteFinancialModelItem(workspaceId, 'assets', assetId)
}

export async function deleteAssetCategory(workspaceId, categoryId) {
  await deleteFinancialModelCategory(workspaceId, 'assets', categoryId)
}

function assertValidOwnership(ownership, memberIds) {
  if (!isValidOwnership(ownership, memberIds)) {
    throw new Error('Ownership must reference workspace members and add up to 100%')
  }
}
