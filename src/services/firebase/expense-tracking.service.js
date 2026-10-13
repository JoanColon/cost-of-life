import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore'
import { db } from '@/firebase/firebase'
import {
  defaultExpenseTrackingCategoryIds,
  expenseTrackingCategories,
  expenseTrackingCategoryIds,
  trackingSubcategoryIdsForModelExpenses,
} from '@/config/expense-tracking-categories'
import {
  addTrackedItem,
  deleteTrackedItem,
  emptyExpenseTrackingMonth,
  normalizeTrackingMonth,
  setTrackingDecision,
  setTrackingDecisions,
  updateTrackedItem,
} from '@/domain/financial/expense-tracking'
import { normalizeMoney } from '@/domain/financial/money'
import { cloneOwnership, isValidOwnership } from '@/domain/financial/ownership'
import { ensureModelConfig, modelConfigRef } from '@/services/firebase/model-config.service'

const DEFAULT_TRACKING_CATEGORIES = [...defaultExpenseTrackingCategoryIds]

function trackingRef(workspaceId, period) {
  return doc(db, 'workspaces', workspaceId, 'expenseTracking', period)
}

function configRef(workspaceId) {
  return modelConfigRef(workspaceId, 'expenseTracking')
}

function modelExpensesRef(workspaceId) {
  return collection(db, 'workspaces', workspaceId, 'modelExpenses')
}

export async function getExpenseTrackingMonth(workspaceId, period) {
  assertPeriod(period)
  const snapshot = await getDoc(trackingRef(workspaceId, period))
  return snapshot.exists()
    ? normalizeTrackingMonth(snapshot.data(), period)
    : emptyExpenseTrackingMonth(period)
}

export async function getExpenseTrackingPreferences(workspaceId) {
  const [config, availableSubcategories] = await Promise.all([
    ensureModelConfig(workspaceId, 'expenseTracking'),
    getTrackingEligibleSubcategories(workspaceId),
  ])
  const saved = config?.enabledSubcategories
  return {
    availableSubcategories,
    enabledSubcategories: normalizeEnabledCategories(
      Array.isArray(saved) ? saved : DEFAULT_TRACKING_CATEGORIES,
      availableSubcategories,
    ),
  }
}

export async function saveExpenseTrackingPreferences(workspaceId, categoryIds, userId) {
  const availableSubcategories = await getTrackingEligibleSubcategories(workspaceId)
  const trackingEnabledSubcategories = normalizeEnabledCategories(
    categoryIds,
    availableSubcategories,
  )
  await setDoc(
    configRef(workspaceId),
    {
      schemaVersion: 1,
      enabledSubcategories: trackingEnabledSubcategories,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    },
    { merge: true },
  )
  return trackingEnabledSubcategories
}

export async function createTrackedExpense(
  workspaceId,
  period,
  subcategoryId,
  input,
  userId,
  memberIds,
) {
  assertSubcategory(subcategoryId)
  const item = normalizeItem(
    { ...input, id: doc(collection(db, 'workspaces', workspaceId, 'expenseTracking')).id },
    memberIds,
    period,
  )
  return mutateMonth(
    workspaceId,
    period,
    userId,
    (month) => addTrackedItem(month, subcategoryId, item),
    [subcategoryId],
  )
}

export async function updateTrackedExpense(
  workspaceId,
  period,
  subcategoryId,
  itemId,
  input,
  userId,
  memberIds,
) {
  assertSubcategory(subcategoryId)
  const changes = normalizeItem({ ...input, id: itemId }, memberIds, period)
  return mutateMonth(
    workspaceId,
    period,
    userId,
    (month) => updateTrackedItem(month, subcategoryId, itemId, changes),
    [subcategoryId],
  )
}

export async function removeTrackedExpense(workspaceId, period, subcategoryId, itemId, userId) {
  assertSubcategory(subcategoryId)
  return mutateMonth(workspaceId, period, userId, (month) =>
    deleteTrackedItem(month, subcategoryId, itemId),
  )
}

export async function saveTrackingReconciliation(
  workspaceId,
  period,
  subcategoryId,
  decision,
  userId,
) {
  assertSubcategory(subcategoryId)
  return mutateMonth(
    workspaceId,
    period,
    userId,
    (month) => setTrackingDecision(month, subcategoryId, decision),
    decision === 'tracked' ? [subcategoryId] : [],
  )
}

export async function saveTrackingReconciliations(
  workspaceId,
  period,
  subcategoryIds,
  decision,
  userId,
) {
  subcategoryIds.forEach(assertSubcategory)
  return mutateMonth(
    workspaceId,
    period,
    userId,
    (month) => setTrackingDecisions(month, subcategoryIds, decision),
    decision === 'tracked' ? subcategoryIds : [],
  )
}

async function mutateMonth(workspaceId, period, userId, mutation, requiredSubcategoryIds = []) {
  assertPeriod(period)
  const documentRef = trackingRef(workspaceId, period)
  return runTransaction(db, async (transaction) => {
    const [snapshot, ...modelSnapshots] = await Promise.all([
      transaction.get(documentRef),
      ...requiredSubcategoryIds.map((subcategoryId) =>
        transaction.get(modelExpenseRef(workspaceId, subcategoryId)),
      ),
    ])
    modelSnapshots.forEach((modelSnapshot, index) => {
      assertTrackingEligibleModel(modelSnapshot, requiredSubcategoryIds[index])
    })
    const current = snapshot.exists()
      ? normalizeTrackingMonth(snapshot.data(), period)
      : emptyExpenseTrackingMonth(period)
    const next = mutation(current)
    transaction.set(documentRef, { ...next, updatedAt: serverTimestamp(), updatedBy: userId })
    return next
  })
}

function normalizeItem(input, memberIds, period) {
  const amount = normalizeMoney(input.amount)
  if (amount === null || amount <= 0) throw new Error('A positive amount is required')
  if (!isValidOwnership(input.ownership, memberIds)) {
    throw new Error('Ownership must reference workspace members and add up to 100%')
  }
  return {
    id: input.id,
    amount,
    date: dateTimestamp(input.date, period),
    notes: String(input.notes || '').trim(),
    ownership: cloneOwnership(input.ownership),
  }
}

function dateTimestamp(value, period) {
  if (value instanceof Timestamp) {
    const date = value.toDate()
    const timestampPeriod = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    if (timestampPeriod !== period) {
      throw new Error('A valid date inside the selected month is required')
    }
    return value
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''))
  if (!match) throw new Error('A valid date is required')
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)
  const normalized = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
  if (Number.isNaN(date.getTime()) || normalized !== value || !normalized.startsWith(period)) {
    throw new Error('A valid date inside the selected month is required')
  }
  return Timestamp.fromDate(date)
}

async function getTrackingEligibleSubcategories(workspaceId) {
  const snapshot = await getDocs(
    query(modelExpensesRef(workspaceId), where('trackingEligible', '==', true)),
  )
  return trackingSubcategoryIdsForModelExpenses(snapshot.docs.map((document) => document.data()))
}

function normalizeEnabledCategories(
  categoryIds,
  availableSubcategories = expenseTrackingCategoryIds,
) {
  const selected = new Set(categoryIds)
  const available = new Set(availableSubcategories)
  return expenseTrackingCategoryIds.filter((id) => selected.has(id) && available.has(id))
}

function modelExpenseRef(workspaceId, subcategoryId) {
  const category = trackingCategory(subcategoryId)
  return doc(modelExpensesRef(workspaceId), `${category.categoryId}--${subcategoryId}`)
}

function trackingCategory(subcategoryId) {
  return expenseTrackingCategories.find(({ id }) => id === subcategoryId) || null
}

function assertTrackingEligibleModel(snapshot, subcategoryId) {
  const expected = trackingCategory(subcategoryId)
  const expense = snapshot.data()
  if (
    !snapshot.exists() ||
    expense?.trackingEligible !== true ||
    expense?.type !== subcategoryId ||
    expense?.category !== expected?.categoryId
  ) {
    throw new Error('Tracking requires an eligible model expense')
  }
}

function assertSubcategory(subcategoryId) {
  if (!expenseTrackingCategoryIds.includes(subcategoryId)) {
    throw new Error('A valid tracking subcategory is required')
  }
}

function assertPeriod(period) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('A valid period is required')
}
