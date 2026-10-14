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
  const userId = currentUserId()
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

export async function updateLiability(workspaceId, liabilityId, changes, memberIds) {
  const userId = currentUserId()
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

export async function deleteLiability(workspaceId, liabilityId) {
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

export async function deleteLiabilityCategory(workspaceId, categoryId) {
  const userId = currentUserId()
  const categorySnapshot = await getDocs(
    query(modelLiabilitiesRef(workspaceId), where('category', '==', categoryId)),
  )
  if (categorySnapshot.size > 498) {
    throw new Error('Liability categories with more than 498 items cannot be deleted at once')
  }

  const batch = writeBatch(db)
  categorySnapshot.docs.forEach((liabilityDocument) => batch.delete(liabilityDocument.ref))
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
