import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/firebase/firebase'
import { modelConfigRef } from '@/services/firebase/model-config.service'
import { normalizeMoney } from '@/domain/financial/money'
import { cloneOwnership, isValidOwnership } from '@/domain/financial/ownership'
import {
  canonicalCategories,
  hydrateModelConfigWithBaselines,
} from '@/domain/financial/model-categories'
import {
  MODEL_BASELINE_KIND,
  isModelBaseline,
  modelBaselineId,
} from '@/domain/financial/model-baseline'

function configRef(workspaceId) {
  return modelConfigRef(workspaceId, 'assets')
}

function modelAssetsRef(workspaceId) {
  return collection(db, 'workspaces', workspaceId, 'modelAssets')
}

export async function getAssetsConfig(workspaceId) {
  const [configSnapshot, baselineSnapshot] = await Promise.all([
    getDoc(configRef(workspaceId)),
    getDocs(query(modelAssetsRef(workspaceId), where('kind', '==', MODEL_BASELINE_KIND))),
  ])
  if (!configSnapshot.exists()) return null
  const baselines = baselineSnapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }))
  return hydrateModelConfigWithBaselines(configSnapshot.data(), baselines, (baseline) => ({
    manualValue: baseline.currentValue,
    ownership: baseline.ownership,
  }))
}

export async function getCategoryAssets(workspaceId, categoryId) {
  const snapshot = await getDocs(
    query(modelAssetsRef(workspaceId), where('category', '==', categoryId)),
  )

  return snapshot.docs
    .map((assetDocument) => ({ id: assetDocument.id, ...assetDocument.data() }))
    .filter((asset) => !isModelBaseline(asset))
}

export async function saveAssetsSetup(workspaceId, categories, userId) {
  const batch = writeBatch(db)
  batch.set(configRef(workspaceId), {
    schemaVersion: 1,
    setupCompleted: true,
    categories: stampCategories(canonicalCategories(categories), userId),
    createdAt: serverTimestamp(),
    createdBy: userId,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  })
  setAssetBaselines(batch, workspaceId, categories, userId)
  await batch.commit()
}

export async function updateAssetsCategories(workspaceId, categories, userId) {
  const batch = writeBatch(db)
  batch.set(
    configRef(workspaceId),
    {
      setupCompleted: true,
      categories: stampCategories(canonicalCategories(categories), userId),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    },
    { merge: true },
  )
  await batch.commit()
}

export async function updateSimpleCategoryValue(workspaceId, categoryId, value, userId) {
  const documentRef = configRef(workspaceId)
  const baselineRef = doc(modelAssetsRef(workspaceId), modelBaselineId(categoryId))

  return runTransaction(db, async (transaction) => {
    const [snapshot, baselineSnapshot] = await Promise.all([
      transaction.get(documentRef),
      transaction.get(baselineRef),
    ])
    const category = snapshot.data()?.categories?.[categoryId]
    if (!category?.enabled || !baselineSnapshot.exists()) {
      throw new Error('Only simple asset categories can be edited directly')
    }

    const manualValue = normalizeMoney(value)
    if (manualValue === null) throw new Error('A non-negative numeric value is required')

    transaction.update(baselineRef, {
      currentValue: manualValue,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    })

    return { manualValue, ownership: baselineSnapshot.data().ownership }
  })
}

export async function updateSimpleCategoryOwnership(
  workspaceId,
  categoryId,
  ownership,
  userId,
  memberIds,
) {
  assertValidOwnership(ownership, memberIds)
  const documentRef = configRef(workspaceId)
  const baselineRef = doc(modelAssetsRef(workspaceId), modelBaselineId(categoryId))

  return runTransaction(db, async (transaction) => {
    const [snapshot, baselineSnapshot] = await Promise.all([
      transaction.get(documentRef),
      transaction.get(baselineRef),
    ])
    const category = snapshot.data()?.categories?.[categoryId]
    if (!category?.enabled || !baselineSnapshot.exists()) {
      throw new Error('Only simple asset category ownership can be edited')
    }
    transaction.update(baselineRef, {
      ownership: cloneOwnership(ownership),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    })

    return {
      manualValue: baselineSnapshot.data().currentValue || 0,
      ownership: cloneOwnership(ownership),
    }
  })
}

export async function createAsset(workspaceId, asset, userId, memberIds) {
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

export async function updateAsset(workspaceId, assetId, changes, userId, memberIds) {
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

export async function removeAsset(workspaceId, assetId) {
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

export async function removeAssetCategory(workspaceId, categoryId, userId) {
  const categoryAssetsSnapshot = await getDocs(
    query(modelAssetsRef(workspaceId), where('category', '==', categoryId)),
  )

  if (categoryAssetsSnapshot.size > 498) {
    throw new Error('Asset categories with more than 498 items cannot be deleted in one operation')
  }

  const batch = writeBatch(db)
  categoryAssetsSnapshot.docs.forEach((assetDocument) => {
    if (isModelBaseline(assetDocument.data())) {
      batch.update(assetDocument.ref, {
        currentValue: 0,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      })
    } else batch.delete(assetDocument.ref)
  })
  batch.update(configRef(workspaceId), {
    [`categories.${categoryId}`]: deleteField(),
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  })
  await batch.commit()
}

function stampCategories(categories, userId) {
  return Object.fromEntries(
    Object.entries(categories).map(([categoryId, category]) => [
      categoryId,
      {
        ...category,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      },
    ]),
  )
}

function setAssetBaselines(batch, workspaceId, categories, userId) {
  for (const [categoryId, category] of Object.entries(categories)) {
    batch.set(
      doc(modelAssetsRef(workspaceId), modelBaselineId(categoryId)),
      {
        kind: MODEL_BASELINE_KIND,
        category: categoryId,
        currentValue: normalizeMoney(category.manualValue) || 0,
        ownership: cloneOwnership(category.ownership),
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      },
      { merge: true },
    )
  }
}

function assertValidOwnership(ownership, memberIds) {
  if (!isValidOwnership(ownership, memberIds)) {
    throw new Error('Ownership must reference workspace members and add up to 100%')
  }
}
