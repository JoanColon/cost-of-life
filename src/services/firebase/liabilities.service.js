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
  return modelConfigRef(workspaceId, 'liabilities')
}

function modelLiabilitiesRef(workspaceId) {
  return collection(db, 'workspaces', workspaceId, 'modelLiabilities')
}

export async function getLiabilitiesConfig(workspaceId) {
  const [configSnapshot, baselineSnapshot] = await Promise.all([
    getDoc(configRef(workspaceId)),
    getDocs(query(modelLiabilitiesRef(workspaceId), where('kind', '==', MODEL_BASELINE_KIND))),
  ])
  if (!configSnapshot.exists()) return null
  const baselines = baselineSnapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }))
  return hydrateModelConfigWithBaselines(configSnapshot.data(), baselines, (baseline) => ({
    manualValue: baseline.balance,
    ownership: baseline.ownership,
  }))
}

export async function getCategoryLiabilities(workspaceId, categoryId) {
  const snapshot = await getDocs(
    query(modelLiabilitiesRef(workspaceId), where('category', '==', categoryId)),
  )
  return snapshot.docs
    .map((liabilityDocument) => ({ id: liabilityDocument.id, ...liabilityDocument.data() }))
    .filter((liability) => !isModelBaseline(liability))
}

export async function saveLiabilitiesSetup(workspaceId, categories, userId) {
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
  setLiabilityBaselines(batch, workspaceId, categories, userId)
  await batch.commit()
}

export async function updateLiabilityCategories(workspaceId, categories, userId) {
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

export async function updateSimpleLiabilityValue(workspaceId, categoryId, value, userId) {
  const documentRef = configRef(workspaceId)
  const baselineRef = doc(modelLiabilitiesRef(workspaceId), modelBaselineId(categoryId))
  return runTransaction(db, async (transaction) => {
    const [snapshot, baselineSnapshot] = await Promise.all([
      transaction.get(documentRef),
      transaction.get(baselineRef),
    ])
    const category = snapshot.data()?.categories?.[categoryId]
    if (!category?.enabled || !baselineSnapshot.exists()) {
      throw new Error('Only simple liability categories can be edited directly')
    }

    const manualValue = normalizeMoney(value)
    if (manualValue === null) throw new Error('A non-negative numeric value is required')

    transaction.update(baselineRef, {
      balance: manualValue,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    })
    return { manualValue, ownership: baselineSnapshot.data().ownership }
  })
}

export async function updateSimpleLiabilityOwnership(
  workspaceId,
  categoryId,
  ownership,
  userId,
  memberIds,
) {
  assertValidOwnership(ownership, memberIds)
  const documentRef = configRef(workspaceId)
  const baselineRef = doc(modelLiabilitiesRef(workspaceId), modelBaselineId(categoryId))
  return runTransaction(db, async (transaction) => {
    const [snapshot, baselineSnapshot] = await Promise.all([
      transaction.get(documentRef),
      transaction.get(baselineRef),
    ])
    const category = snapshot.data()?.categories?.[categoryId]
    if (!category?.enabled || !baselineSnapshot.exists()) {
      throw new Error('Only simple liability category ownership can be edited')
    }
    transaction.update(baselineRef, {
      ownership: cloneOwnership(ownership),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    })
    return {
      manualValue: baselineSnapshot.data().balance || 0,
      ownership: cloneOwnership(ownership),
    }
  })
}

export async function createLiability(workspaceId, liability, userId, memberIds) {
  assertValidOwnership(liability.ownership, memberIds)
  const liabilityRef = doc(modelLiabilitiesRef(workspaceId))
  const documentRef = configRef(workspaceId)
  return runTransaction(db, async (transaction) => {
    const configSnapshot = await transaction.get(documentRef)
    const category = configSnapshot.data()?.categories?.[liability.category]
    if (!category?.enabled) throw new Error('Liability category is not enabled')

    const balance = normalizeMoney(liability.balance)
    if (balance === null) throw new Error('A non-negative balance is required')

    const liabilityData = {
      ...liability,
      balance,
      ownership: cloneOwnership(liability.ownership),
      createdAt: serverTimestamp(),
      createdBy: userId,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    }
    transaction.set(liabilityRef, liabilityData)
    return {
      liability: { ...liabilityData, id: liabilityRef.id, createdAt: null, updatedAt: null },
    }
  })
}

export async function updateLiability(workspaceId, liabilityId, changes, userId, memberIds) {
  const liabilityRef = doc(modelLiabilitiesRef(workspaceId), liabilityId)
  const documentRef = configRef(workspaceId)
  return runTransaction(db, async (transaction) => {
    const [liabilitySnapshot, configSnapshot] = await Promise.all([
      transaction.get(liabilityRef),
      transaction.get(documentRef),
    ])
    if (!liabilitySnapshot.exists()) throw new Error('Liability not found')

    const previousLiability = liabilitySnapshot.data()
    const categoryId = previousLiability.category
    const category = configSnapshot.data()?.categories?.[categoryId]
    if (!category) {
      throw new Error('Itemized liability category not found')
    }

    const balance = normalizeMoney(changes.balance)
    if (balance === null) throw new Error('A non-negative balance is required')

    const updatedLiability = {
      ...previousLiability,
      ...changes,
      category: categoryId,
      balance,
      ownership: cloneOwnership(changes.ownership || previousLiability.ownership),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    }
    assertValidOwnership(updatedLiability.ownership, memberIds)
    transaction.update(liabilityRef, updatedLiability)
    return {
      liability: { id: liabilityId, ...updatedLiability, updatedAt: null },
    }
  })
}

export async function removeLiability(workspaceId, liabilityId) {
  const liabilityRef = doc(modelLiabilitiesRef(workspaceId), liabilityId)
  const documentRef = configRef(workspaceId)
  return runTransaction(db, async (transaction) => {
    const [liabilitySnapshot, configSnapshot] = await Promise.all([
      transaction.get(liabilityRef),
      transaction.get(documentRef),
    ])
    if (!liabilitySnapshot.exists()) throw new Error('Liability not found')

    const liability = liabilitySnapshot.data()
    const category = configSnapshot.data()?.categories?.[liability.category]
    if (!category) throw new Error('Liability category not found')

    transaction.delete(liabilityRef)
    return {
      categoryId: liability.category,
    }
  })
}

export async function removeLiabilityCategory(workspaceId, categoryId, userId) {
  const categorySnapshot = await getDocs(
    query(modelLiabilitiesRef(workspaceId), where('category', '==', categoryId)),
  )
  if (categorySnapshot.size > 498) {
    throw new Error('Liability categories with more than 498 items cannot be deleted at once')
  }

  const batch = writeBatch(db)
  categorySnapshot.docs.forEach((liabilityDocument) => {
    if (isModelBaseline(liabilityDocument.data())) {
      batch.update(liabilityDocument.ref, {
        balance: 0,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      })
    } else batch.delete(liabilityDocument.ref)
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
      { ...category, updatedAt: serverTimestamp(), updatedBy: userId },
    ]),
  )
}

function setLiabilityBaselines(batch, workspaceId, categories, userId) {
  for (const [categoryId, category] of Object.entries(categories)) {
    batch.set(
      doc(modelLiabilitiesRef(workspaceId), modelBaselineId(categoryId)),
      {
        kind: MODEL_BASELINE_KIND,
        category: categoryId,
        balance: normalizeMoney(category.manualValue) || 0,
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
