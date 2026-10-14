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
import { currentUserId } from '@/services/firebase/current-user'
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
  const userId = currentUserId()
  assertValidOwnership(asset.ownership, memberIds)
  const assetRef = doc(modelAssetsRef(workspaceId))
  const documentRef = configRef(workspaceId)

  return runTransaction(db, async (transaction) => {
    const configSnapshot = await transaction.get(documentRef)
    const category = configSnapshot.data()?.categories?.[asset.category]
    if (!category?.enabled) throw new Error('Asset category is not enabled')

    const currentValue = normalizeMoney(asset.currentValue)
    if (currentValue === null) throw new Error('A non-negative numeric value is required')

    const assetData = {
      ...asset,
      currentValue,
      ownership: cloneOwnership(asset.ownership),
      detail: asset.detail || {},
      valueSource: 'manual',
      createdAt: serverTimestamp(),
      createdBy: userId,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    }
    transaction.set(assetRef, assetData)

    return {
      asset: { ...assetData, id: assetRef.id, createdAt: null, updatedAt: null },
    }
  })
}

export async function updateAsset(workspaceId, assetId, changes, memberIds) {
  const userId = currentUserId()
  const assetRef = doc(modelAssetsRef(workspaceId), assetId)
  const documentRef = configRef(workspaceId)
  return runTransaction(db, async (transaction) => {
    const [assetSnapshot, configSnapshot] = await Promise.all([
      transaction.get(assetRef),
      transaction.get(documentRef),
    ])
    if (!assetSnapshot.exists()) throw new Error('Asset not found')

    const previousAsset = assetSnapshot.data()
    const categoryId = previousAsset.category
    const category = configSnapshot.data()?.categories?.[categoryId]
    if (!category) {
      throw new Error('Itemized asset category not found')
    }

    const currentValue = normalizeMoney(changes.currentValue)
    if (currentValue === null) throw new Error('A non-negative numeric value is required')

    const updatedAsset = {
      ...previousAsset,
      ...changes,
      category: categoryId,
      currentValue,
      ownership: cloneOwnership(changes.ownership || previousAsset.ownership),
      detail: changes.detail || previousAsset.detail || {},
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    }
    assertValidOwnership(updatedAsset.ownership, memberIds)
    transaction.update(assetRef, updatedAsset)

    return {
      asset: { id: assetId, ...updatedAsset, updatedAt: null },
    }
  })
}

export async function deleteAsset(workspaceId, assetId) {
  const assetRef = doc(modelAssetsRef(workspaceId), assetId)
  const documentRef = configRef(workspaceId)
  return runTransaction(db, async (transaction) => {
    const [assetSnapshot, configSnapshot] = await Promise.all([
      transaction.get(assetRef),
      transaction.get(documentRef),
    ])
    if (!assetSnapshot.exists()) throw new Error('Asset not found')

    const asset = assetSnapshot.data()
    const category = configSnapshot.data()?.categories?.[asset.category]
    if (!category) throw new Error('Asset category not found')

    transaction.delete(assetRef)

    return {
      categoryId: asset.category,
    }
  })
}

export async function deleteAssetCategory(workspaceId, categoryId) {
  const userId = currentUserId()
  const categoryAssetsSnapshot = await getDocs(
    query(modelAssetsRef(workspaceId), where('category', '==', categoryId)),
  )

  if (categoryAssetsSnapshot.size > 498) {
    throw new Error('Asset categories with more than 498 items cannot be deleted in one operation')
  }

  const batch = writeBatch(db)
  categoryAssetsSnapshot.docs.forEach((assetDocument) => batch.delete(assetDocument.ref))
  batch.update(configRef(workspaceId), {
    [`categories.${categoryId}`]: deleteField(),
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  })
  await batch.commit()
}

function assertValidOwnership(ownership, memberIds) {
  if (!isValidOwnership(ownership, memberIds)) {
    throw new Error('Ownership must reference workspace members and add up to 100%')
  }
}
