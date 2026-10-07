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
import { getIncomeCategory } from '@/config/income-categories'
import {
  annualIncomeValue,
  normalizeIncomeCalculation,
} from '@/domain/financial/income-calculations'
import { normalizeMoney } from '@/domain/financial/money'
import {
  allocateValueByOwnership,
  cloneOwnership,
  createEqualOwnership,
  isValidOwnership,
} from '@/domain/financial/ownership'
import {
  addItemToCategory,
  removeItemFromCategory,
  updateItemInCategory,
} from '@/domain/financial/category-summary'

function summaryRef(workspaceId) {
  return doc(db, 'workspaces', workspaceId, 'cashFlow', 'incomeSummary')
}

function incomeRef(workspaceId) {
  return collection(db, 'workspaces', workspaceId, 'income')
}

export async function getIncomeSummary(workspaceId) {
  const snapshot = await getDoc(summaryRef(workspaceId))
  return snapshot.exists() ? snapshot.data() : null
}

export async function getCategoryIncome(workspaceId, categoryId) {
  const snapshot = await getDocs(query(incomeRef(workspaceId), where('category', '==', categoryId)))
  return snapshot.docs.map((incomeDocument) => ({
    id: incomeDocument.id,
    ...incomeDocument.data(),
  }))
}

export async function saveIncomeSetup(workspaceId, categories, userId) {
  await setDoc(summaryRef(workspaceId), {
    setupCompleted: true,
    categories: stampCategories(categories, userId),
    createdAt: serverTimestamp(),
    createdBy: userId,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  })
}

export async function updateIncomeCategories(workspaceId, categories, userId) {
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

export async function updateSimpleIncomeValue(workspaceId, categoryId, value, userId) {
  const documentRef = summaryRef(workspaceId)
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(documentRef)
    const category = snapshot.data()?.categories?.[categoryId]
    if (!category || Number(category.itemCount || 0) !== 0) {
      throw new Error('Only simple income categories can be edited directly')
    }

    const manualValue = normalizeMoney(value)
    if (manualValue === null) throw new Error('A non-negative annual income is required')
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

export async function updateSimpleIncomeOwnership(
  workspaceId,
  categoryId,
  ownership,
  userId,
  memberIds,
) {
  assertValidOwnership(ownership, memberIds)
  const documentRef = summaryRef(workspaceId)
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(documentRef)
    const category = snapshot.data()?.categories?.[categoryId]
    if (!category || Number(category.itemCount || 0) !== 0) {
      throw new Error('Only simple income category ownership can be edited')
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

export async function createIncome(workspaceId, income, userId, memberIds) {
  assertValidOwnership(income.ownership, memberIds)
  const normalized = normalizeIncomeItem(income)
  const itemRef = doc(incomeRef(workspaceId))
  const documentRef = summaryRef(workspaceId)

  return runTransaction(db, async (transaction) => {
    const summarySnapshot = await transaction.get(documentRef)
    const category = summarySnapshot.data()?.categories?.[normalized.category]
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
    const annualValue = annualIncomeValue(itemData.calculation)
    const updatedCategory = {
      ...addItemToCategory(category, annualValue, itemData.ownership),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    }
    transaction.set(itemRef, itemData)
    transaction.update(documentRef, {
      [`categories.${normalized.category}`]: updatedCategory,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    })
    return {
      income: { ...itemData, id: itemRef.id, createdAt: null, updatedAt: null },
      category: { ...updatedCategory, updatedAt: null },
    }
  })
}

export async function updateIncome(workspaceId, incomeId, changes, userId, memberIds) {
  const itemRef = doc(incomeRef(workspaceId), incomeId)
  const documentRef = summaryRef(workspaceId)
  return runTransaction(db, async (transaction) => {
    const [itemSnapshot, summarySnapshot] = await Promise.all([
      transaction.get(itemRef),
      transaction.get(documentRef),
    ])
    if (!itemSnapshot.exists()) throw new Error('Income source not found')

    const previousIncome = itemSnapshot.data()
    const categoryId = previousIncome.category
    const category = summarySnapshot.data()?.categories?.[categoryId]
    if (!category || Number(category.itemCount || 0) === 0) {
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
    const updatedCategory = {
      ...updateItemInCategory(
        category,
        annualIncomeValue(previousIncome.calculation),
        previousIncome.ownership,
        annualIncomeValue(updatedIncome.calculation),
        updatedIncome.ownership,
      ),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    }
    transaction.update(itemRef, updatedIncome)
    transaction.update(documentRef, {
      [`categories.${categoryId}`]: updatedCategory,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    })
    return {
      income: { id: incomeId, ...updatedIncome, updatedAt: null },
      category: { ...updatedCategory, updatedAt: null },
    }
  })
}

export async function removeIncome(workspaceId, incomeId, userId, memberIds) {
  const itemRef = doc(incomeRef(workspaceId), incomeId)
  const documentRef = summaryRef(workspaceId)
  return runTransaction(db, async (transaction) => {
    const [itemSnapshot, summarySnapshot] = await Promise.all([
      transaction.get(itemRef),
      transaction.get(documentRef),
    ])
    if (!itemSnapshot.exists()) throw new Error('Income source not found')

    const income = itemSnapshot.data()
    const category = summarySnapshot.data()?.categories?.[income.category]
    if (!category) throw new Error('Income category not found')
    const updatedCategory = {
      ...removeItemFromCategory(
        category,
        annualIncomeValue(income.calculation),
        income.ownership,
        createEqualOwnership(memberIds),
        memberIds,
      ),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    }
    transaction.delete(itemRef)
    transaction.update(documentRef, {
      [`categories.${income.category}`]: updatedCategory,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    })
    return {
      categoryId: income.category,
      category: { ...updatedCategory, updatedAt: null },
    }
  })
}

export async function removeIncomeCategory(workspaceId, categoryId, userId) {
  const snapshot = await getDocs(query(incomeRef(workspaceId), where('category', '==', categoryId)))
  if (snapshot.size > 498) {
    throw new Error('Income categories with more than 498 sources cannot be deleted at once')
  }
  const batch = writeBatch(db)
  snapshot.docs.forEach((incomeDocument) => batch.delete(incomeDocument.ref))
  batch.update(summaryRef(workspaceId), {
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

function stampCategories(categories, userId) {
  return Object.fromEntries(
    Object.entries(categories).map(([categoryId, category]) => [
      categoryId,
      { ...category, updatedAt: serverTimestamp(), updatedBy: userId },
    ]),
  )
}

function assertValidOwnership(ownership, memberIds) {
  if (!isValidOwnership(ownership, memberIds)) {
    throw new Error('Ownership must reference workspace members and add up to 100%')
  }
}
