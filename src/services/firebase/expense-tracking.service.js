import {
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/firebase/firebase'
import { expenseTrackingCategoryIds } from '@/config/expense-tracking-categories'
import {
  addTrackedItem,
  deleteTrackedItem,
  emptyExpenseTrackingMonth,
  normalizeTrackingMonth,
  setTrackingDecision,
  setTrackingDecisions,
  updateTrackedItem,
} from '@/domain/financial/expense-tracking'
import { normalizeNonNegativeMoney } from '@/domain/financial/money'
import { cloneOwnership, isValidOwnership } from '@/domain/financial/ownership'
import { currentUserId } from '@/services/firebase/current-user'
import { getModelConfig, modelConfigRef } from '@/services/firebase/model-config.service'

function trackingRef(workspaceId, period) {
  return doc(db, 'workspaces', workspaceId, 'expenseTracking', period)
}

export async function getExpenseTrackingMonth(workspaceId, period) {
  assertPeriod(period)
  const snapshot = await getDoc(trackingRef(workspaceId, period))
  return snapshot.exists()
    ? normalizeTrackingMonth(snapshot.data(), period)
    : emptyExpenseTrackingMonth(period)
}

export async function getExpenseTrackingPreferences(workspaceId) {
  const config = await getModelConfig(workspaceId, 'expenseTracking')
  const saved = config?.enabledSubcategories
  return {
    enabledSubcategories: normalizeEnabledCategories(Array.isArray(saved) ? saved : []),
  }
}

export async function saveExpenseTrackingPreferences(workspaceId, categoryIds) {
  const enabledSubcategories = normalizeEnabledCategories(categoryIds)
  const userId = currentUserId()
  await setDoc(
    modelConfigRef(workspaceId, 'expenseTracking'),
    {
      schemaVersion: 2,
      enabledSubcategories,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    },
    { merge: true },
  )
  return enabledSubcategories
}

export async function createTrackedExpense(
  workspaceId,
  period,
  subcategoryId,
  input,
  memberIds,
  expenseItems = [],
) {
  const userId = currentUserId()
  assertSubcategory(subcategoryId)
  const item = normalizeItem(
    { ...input, id: doc(collection(db, 'workspaces', workspaceId, 'expenseTracking')).id },
    memberIds,
    period,
    subcategoryId,
    expenseItems,
  )
  return mutateMonth(workspaceId, period, userId, (month) =>
    addTrackedItem(month, subcategoryId, item),
  )
}

export async function updateTrackedExpense(
  workspaceId,
  period,
  subcategoryId,
  itemId,
  input,
  memberIds,
  expenseItems = [],
) {
  const userId = currentUserId()
  assertSubcategory(subcategoryId)
  const changes = normalizeItem(
    { ...input, id: itemId },
    memberIds,
    period,
    subcategoryId,
    expenseItems,
  )
  return mutateMonth(workspaceId, period, userId, (month) =>
    updateTrackedItem(month, subcategoryId, itemId, changes),
  )
}

export async function removeTrackedExpense(workspaceId, period, subcategoryId, itemId) {
  const userId = currentUserId()
  assertSubcategory(subcategoryId)
  return mutateMonth(workspaceId, period, userId, (month) =>
    deleteTrackedItem(month, subcategoryId, itemId),
  )
}

export async function saveTrackingReconciliation(workspaceId, period, subcategoryId, decision) {
  const userId = currentUserId()
  assertSubcategory(subcategoryId)
  return mutateMonth(workspaceId, period, userId, (month) =>
    setTrackingDecision(month, subcategoryId, decision),
  )
}

export async function saveTrackingReconciliations(workspaceId, period, subcategoryIds, decision) {
  const userId = currentUserId()
  subcategoryIds.forEach(assertSubcategory)
  return mutateMonth(workspaceId, period, userId, (month) =>
    setTrackingDecisions(month, subcategoryIds, decision),
  )
}

async function mutateMonth(workspaceId, period, userId, mutation) {
  assertPeriod(period)
  const documentRef = trackingRef(workspaceId, period)
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(documentRef)
    const current = snapshot.exists()
      ? normalizeTrackingMonth(snapshot.data(), period)
      : emptyExpenseTrackingMonth(period)
    const next = mutation(current)
    transaction.set(documentRef, { ...next, updatedAt: serverTimestamp(), updatedBy: userId })
    return next
  })
}

function normalizeItem(input, memberIds, period, subcategoryId, expenseItems) {
  const amount = normalizeNonNegativeMoney(input.amount)
  if (amount === null || amount <= 0) throw new Error('A positive amount is required')
  if (!isValidOwnership(input.ownership, memberIds)) {
    throw new Error('Ownership must reference workspace members and add up to 100%')
  }
  const subcategoryItems = expenseItems.filter((item) => item.subcategoryId === subcategoryId)
  const itemId = String(input.itemId || '')
  if (!subcategoryItems.some((item) => item.id === itemId)) {
    throw new Error('A valid item from the selected subcategory is required')
  }
  return {
    id: input.id,
    itemId,
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

function normalizeEnabledCategories(categoryIds) {
  const selected = new Set(categoryIds)
  return expenseTrackingCategoryIds.filter((id) => selected.has(id))
}

function assertSubcategory(subcategoryId) {
  if (!expenseTrackingCategoryIds.includes(subcategoryId)) {
    throw new Error('A valid tracking subcategory is required')
  }
}

function assertPeriod(period) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('A valid period is required')
}
