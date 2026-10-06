import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/firebase/firebase'
import {
  addItemToCategory,
  allocateValueByOwnership,
  cloneOwnership,
  createEqualOwnership,
  normalizeMoney,
  removeItemFromCategory,
  updateItemInCategory,
} from '@/utils/asset-calculations'

function summaryRef(workspaceId) {
  return doc(db, 'workspaces', workspaceId, 'financialPosition', 'liabilitiesSummary')
}

function liabilitiesRef(workspaceId) {
  return collection(db, 'workspaces', workspaceId, 'liabilities')
}

export async function getLiabilitiesSummary(workspaceId) {
  const snapshot = await getDoc(summaryRef(workspaceId))
  return snapshot.exists() ? snapshot.data() : null
}

export async function getCategoryLiabilities(workspaceId, categoryId) {
  const snapshot = await getDocs(
    query(liabilitiesRef(workspaceId), where('category', '==', categoryId)),
  )
  return snapshot.docs.map((liabilityDocument) => ({
    id: liabilityDocument.id,
    ...liabilityDocument.data(),
  }))
}

export async function saveLiabilitiesSetup(workspaceId, categories, userId) {
  await setDoc(summaryRef(workspaceId), {
    setupCompleted: true,
    categories: stampCategories(categories, userId),
    createdAt: serverTimestamp(),
    createdBy: userId,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  })
}

export async function updateLiabilityCategories(workspaceId, categories, userId) {
  await setDoc(
    summaryRef(workspaceId),
    {
      setupCompleted: true,
      categories: stampCategories(categories, userId),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    },
    { merge: true },
  )
}

export async function updateSimpleLiabilityValue(workspaceId, categoryId, value, userId) {
  const documentRef = summaryRef(workspaceId)
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(documentRef)
    const category = snapshot.data()?.categories?.[categoryId]
    if (!category || Number(category.itemCount || 0) !== 0) {
      throw new Error('Only simple liability categories can be edited directly')
    }

    const manualValue = normalizeMoney(value)
    if (manualValue === null) throw new Error('A non-negative numeric value is required')

    const updatedCategory = {
      ...category,
      manualValue,
      memberValues: allocateValueByOwnership(manualValue, category.ownership),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    }
    transaction.update(documentRef, {
      [`categories.${categoryId}`]: updatedCategory,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    })
    return { ...updatedCategory, updatedAt: null }
  })
}

export async function updateSimpleLiabilityOwnership(workspaceId, categoryId, ownership, userId) {
  const documentRef = summaryRef(workspaceId)
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(documentRef)
    const category = snapshot.data()?.categories?.[categoryId]
    if (!category || Number(category.itemCount || 0) !== 0) {
      throw new Error('Only simple liability category ownership can be edited')
    }

    const updatedCategory = {
      ...category,
      ownership: cloneOwnership(ownership),
      memberValues: allocateValueByOwnership(category.manualValue, ownership),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    }
    transaction.update(documentRef, {
      [`categories.${categoryId}`]: updatedCategory,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    })
    return { ...updatedCategory, updatedAt: null }
  })
}

export async function createLiability(workspaceId, liability, userId) {
  const liabilityRef = doc(liabilitiesRef(workspaceId))
  const documentRef = summaryRef(workspaceId)
  return runTransaction(db, async (transaction) => {
    const summarySnapshot = await transaction.get(documentRef)
    const category = summarySnapshot.data()?.categories?.[liability.category]
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
    const updatedCategory = {
      ...addItemToCategory(category, balance, liabilityData.ownership),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    }

    transaction.set(liabilityRef, liabilityData)
    transaction.update(documentRef, {
      [`categories.${liability.category}`]: updatedCategory,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    })
    return {
      liability: { ...liabilityData, id: liabilityRef.id, createdAt: null, updatedAt: null },
      category: { ...updatedCategory, updatedAt: null },
    }
  })
}

export async function updateLiability(workspaceId, liabilityId, changes, userId) {
  const liabilityRef = doc(liabilitiesRef(workspaceId), liabilityId)
  const documentRef = summaryRef(workspaceId)
  return runTransaction(db, async (transaction) => {
    const [liabilitySnapshot, summarySnapshot] = await Promise.all([
      transaction.get(liabilityRef),
      transaction.get(documentRef),
    ])
    if (!liabilitySnapshot.exists()) throw new Error('Liability not found')

    const previousLiability = liabilitySnapshot.data()
    const categoryId = previousLiability.category
    const category = summarySnapshot.data()?.categories?.[categoryId]
    if (!category || Number(category.itemCount || 0) === 0) {
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
    const updatedCategory = {
      ...updateItemInCategory(
        category,
        previousLiability.balance,
        previousLiability.ownership,
        balance,
        updatedLiability.ownership,
      ),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    }

    transaction.update(liabilityRef, updatedLiability)
    transaction.update(documentRef, {
      [`categories.${categoryId}`]: updatedCategory,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    })
    return {
      liability: { id: liabilityId, ...updatedLiability, updatedAt: null },
      category: { ...updatedCategory, updatedAt: null },
    }
  })
}

export async function removeLiability(workspaceId, liabilityId, userId, memberIds) {
  const liabilityRef = doc(liabilitiesRef(workspaceId), liabilityId)
  const documentRef = summaryRef(workspaceId)
  return runTransaction(db, async (transaction) => {
    const [liabilitySnapshot, summarySnapshot] = await Promise.all([
      transaction.get(liabilityRef),
      transaction.get(documentRef),
    ])
    if (!liabilitySnapshot.exists()) throw new Error('Liability not found')

    const liability = liabilitySnapshot.data()
    const category = summarySnapshot.data()?.categories?.[liability.category]
    if (!category) throw new Error('Liability category not found')

    const updatedCategory = {
      ...removeItemFromCategory(
        category,
        liability.balance,
        liability.ownership,
        createEqualOwnership(memberIds),
        memberIds,
      ),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    }

    transaction.delete(liabilityRef)
    transaction.update(documentRef, {
      [`categories.${liability.category}`]: updatedCategory,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    })
    return {
      categoryId: liability.category,
      category: { ...updatedCategory, updatedAt: null },
    }
  })
}

export async function removeLiabilityCategory(workspaceId, categoryId, userId) {
  const categorySnapshot = await getDocs(
    query(liabilitiesRef(workspaceId), where('category', '==', categoryId)),
  )
  if (categorySnapshot.size > 498) {
    throw new Error('Liability categories with more than 498 items cannot be deleted at once')
  }

  const batch = writeBatch(db)
  categorySnapshot.docs.forEach((liabilityDocument) => batch.delete(liabilityDocument.ref))
  batch.update(summaryRef(workspaceId), {
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
