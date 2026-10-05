import Dexie from 'dexie'
import { toRaw } from 'vue'
import { getCategory } from '@/config/crimeCategories'
import { sortEventsNewestFirst } from '@/utils/eventDates'
import { relabelEventCurrency, relabelSettingsCurrency } from '@/utils/globalCurrency'
import { normalizeAmount, normalizeOptionalAmount, normalizeRequiredAmount } from '@/utils/amounts'
import { endOfDay, recurrenceOptions } from '@/utils/recurringEvents'

const SETTINGS_ID = 'settings'
const databaseName = 'financialCrimes'
const databaseSchema = {
  settings: '&id',
  events: '&id, eventType, occurredAt, categoryId, status, recurrence, recurrenceEndAt',
  achievementUnlocks: '&achievementId, unlockedMonth, unlockedAt',
  achievementMonthEvaluations: '&month, evaluatedAt',
}

// IndexedDB model
// tables:
// - settings: one row keyed by id="settings"; stores currency, court strictness, current
//   allowance, editable allowance history, selected categories, onboarding state, and timestamps.
// - events: shared timeline for committed and prevented financial events.
// - achievementUnlocks: permanent badge unlock records keyed by achievement id.
// - achievementMonthEvaluations: completed months already processed by the achievement engine.
//
// event fields:
// - id: "crime_*" or "prevented_*".
// - eventType: "crime" for committed spending, "prevented" for almost-committed spending.
// - categoryId/categoryLabel/title: display and grouping metadata.
// - amount/currency/amountEstimated/status: financial value and completion state.
// - occurredAt/createdAt/updatedAt: ISO timestamps used for filtering and sorting.
// - notes: user-entered context.
// - recurrence/recurrenceEndAt: only used by subscription crimes; prevented events stay null.
// - metadata: optional structured extras, such as subscription provider id.

const db = new Dexie(databaseName)

// Version 1 is the clean public-MVP baseline. Pre-launch databases are intentionally unsupported;
// testers must clear the app data or reinstall before using this schema.
db.version(1).stores(databaseSchema)

function makeId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}_${globalThis.crypto.randomUUID()}`
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function toPlainObject(value) {
  return JSON.parse(JSON.stringify(toRaw(value)))
}

function getEventCurrency(data) {
  return data.currency || data.settingsCurrency || 'EUR'
}

function normalizeRecurrence(value) {
  return recurrenceOptions.includes(value) ? value : null
}

// Crime events cover regular spending and the single persisted source for recurring subscriptions.
function normalizeCrimeEvent(data) {
  const category = getCategory(data.categoryId)
  const createdAt = data.createdAt || new Date().toISOString()
  const occurredAt = data.occurredAt || createdAt
  const amount = normalizeAmount(data.amount)

  return {
    id: data.id,
    eventType: 'crime',
    categoryId: data.categoryId,
    categoryLabel: data.categoryLabel || category.label,
    title: data.title || data.crimeName || category.crimeName,
    amount,
    currency: getEventCurrency(data),
    amountEstimated: Boolean(data.amountEstimated),
    status: amount === null ? 'pendingAmount' : 'complete',
    occurredAt,
    createdAt,
    updatedAt: data.updatedAt || createdAt,
    notes: data.notes || '',
    recurrence: normalizeRecurrence(data.recurrence),
    recurrenceEndAt: data.recurrenceEndAt || null,
    metadata: data.metadata || {},
  }
}

// Prevented crimes share the event table but never participate in subscription recurrence.
function normalizePreventedEvent(data) {
  const category = getCategory(data.categoryId)
  const createdAt = data.createdAt || new Date().toISOString()
  const occurredAt = data.occurredAt || createdAt

  return {
    id: data.id,
    eventType: 'prevented',
    categoryId: data.categoryId,
    categoryLabel: data.categoryLabel || category.label,
    title: data.title || category.label,
    amount: normalizeRequiredAmount(data.amount),
    currency: getEventCurrency(data),
    amountEstimated: Boolean(data.amountEstimated),
    status: 'complete',
    occurredAt,
    createdAt,
    updatedAt: data.updatedAt || createdAt,
    notes: data.notes || '',
    recurrence: null,
    recurrenceEndAt: null,
    metadata: data.metadata || {},
  }
}

export async function getSettings() {
  return db.settings.get(SETTINGS_ID)
}

export async function saveSettings(settings) {
  const now = new Date().toISOString()
  const plainSettings = toPlainObject(settings)

  await db.settings.put({
    ...plainSettings,
    id: SETTINGS_ID,
    createdAt: plainSettings.createdAt || now,
    updatedAt: now,
  })

  return getSettings()
}

export async function changeGlobalCurrency(settings, currency) {
  const now = new Date().toISOString()
  const nextSettings = relabelSettingsCurrency(toPlainObject(settings), currency)
  const persistedSettings = {
    ...nextSettings,
    id: SETTINGS_ID,
    createdAt: nextSettings.createdAt || now,
    updatedAt: now,
  }

  await db.transaction('rw', db.settings, db.events, async () => {
    await db.settings.put(persistedSettings)
    await db.events.toCollection().modify((event) => {
      Object.assign(event, relabelEventCurrency(event, nextSettings.currency), { updatedAt: now })
    })
  })

  return persistedSettings
}

export async function listCrimes() {
  const crimes = await db.events.where('eventType').equals('crime').toArray()
  return sortEventsNewestFirst(crimes)
}

export async function createCrime(data) {
  const now = new Date().toISOString()
  const normalizedAmount =
    data.categoryId === 'subscriptions'
      ? normalizeRequiredAmount(data.amount)
      : normalizeOptionalAmount(data.amount)
  const plainData = toPlainObject(data)
  const settings = await getSettings()
  const crime = normalizeCrimeEvent({
    id: makeId('crime'),
    amountEstimated: false,
    notes: '',
    createdAt: now,
    occurredAt: now,
    settingsCurrency: settings?.currency,
    ...plainData,
    amount: normalizedAmount,
  })

  await db.events.add(crime)
  return crime
}

export async function updateCrime(id, changes) {
  const hasAmountChange = Object.hasOwn(changes, 'amount')
  const current = hasAmountChange ? await db.events.get(id) : null
  const requiresAmount =
    current?.categoryId === 'subscriptions' || changes.categoryId === 'subscriptions'
  const normalizedAmount = hasAmountChange
    ? requiresAmount
      ? normalizeRequiredAmount(changes.amount)
      : normalizeOptionalAmount(changes.amount)
    : undefined
  const nextChanges = toPlainObject(changes)

  // Amount updates also resolve or reopen the "pending amount" state.
  if (hasAmountChange) {
    nextChanges.amount = normalizedAmount
    nextChanges.status = nextChanges.amount == null ? 'pendingAmount' : 'complete'
  }

  if ('recurrence' in nextChanges) {
    nextChanges.recurrence = normalizeRecurrence(nextChanges.recurrence)
  }

  nextChanges.updatedAt = new Date().toISOString()

  await db.events.update(id, nextChanges)
  return db.events.get(id)
}

export async function cancelSubscription(id, cancelledAt = new Date().toISOString()) {
  return updateCrime(id, { recurrenceEndAt: endOfDay(cancelledAt).toISOString() })
}

function dayBefore(dateLike) {
  const date = new Date(dateLike)
  date.setDate(date.getDate() - 1)
  return endOfDay(date).toISOString()
}

export async function replaceActiveSubscriptionTerms(id, changes) {
  const hasAmountChange = Object.hasOwn(changes, 'amount')
  const normalizedAmount = hasAmountChange ? normalizeRequiredAmount(changes.amount) : undefined
  const nextChanges = toPlainObject(changes)
  let closedEvent
  let newEvent

  await db.transaction('rw', db.events, async () => {
    const current = await db.events.get(id)
    if (!current?.recurrence || current.recurrenceEndAt) {
      throw new Error('The subscription is no longer active.')
    }

    const now = new Date().toISOString()
    const effectiveAt = nextChanges.occurredAt || now
    const closedChanges = {
      recurrenceEndAt: dayBefore(effectiveAt),
      updatedAt: now,
    }
    newEvent = normalizeCrimeEvent({
      ...current,
      id: makeId('crime'),
      createdAt: now,
      updatedAt: now,
      occurredAt: effectiveAt,
      recurrenceEndAt: null,
      amount: hasAmountChange ? normalizedAmount : current.amount,
      recurrence: 'recurrence' in nextChanges ? nextChanges.recurrence : current.recurrence,
      notes: 'notes' in nextChanges ? nextChanges.notes : current.notes,
    })

    await db.events.update(id, closedChanges)
    await db.events.add(newEvent)
    closedEvent = { ...current, ...closedChanges }
  })

  return { closedEvent, newEvent }
}

export async function deleteCrime(id) {
  await db.events.delete(id)
}

export async function listPreventedCrimes() {
  const preventedCrimes = await db.events.where('eventType').equals('prevented').toArray()
  return sortEventsNewestFirst(preventedCrimes)
}

export async function createPreventedCrime(data) {
  const normalizedAmount = normalizeRequiredAmount(data.amount)
  const plainData = toPlainObject(data)
  const settings = await getSettings()
  const now = new Date().toISOString()
  const preventedCrime = normalizePreventedEvent({
    id: makeId('prevented'),
    notes: '',
    createdAt: now,
    occurredAt: now,
    settingsCurrency: settings?.currency,
    ...plainData,
    amount: normalizedAmount,
  })

  await db.events.add(preventedCrime)
  return preventedCrime
}

export async function updatePreventedCrime(id, changes) {
  const hasAmountChange = Object.hasOwn(changes, 'amount')
  const normalizedAmount = hasAmountChange ? normalizeRequiredAmount(changes.amount) : undefined
  const nextChanges = toPlainObject(changes)

  if (hasAmountChange) {
    nextChanges.amount = normalizedAmount
    nextChanges.status = 'complete'
  }

  if ('categoryId' in nextChanges) {
    const category = getCategory(nextChanges.categoryId)
    nextChanges.categoryLabel = category.label
    nextChanges.title = nextChanges.title || category.label
  }

  nextChanges.updatedAt = new Date().toISOString()

  await db.events.update(id, nextChanges)
  return db.events.get(id)
}

export async function deletePreventedCrime(id) {
  await db.events.delete(id)
}

export async function deleteAllData() {
  await db.transaction(
    'rw',
    db.settings,
    db.events,
    db.achievementUnlocks,
    db.achievementMonthEvaluations,
    async () => {
      await db.settings.clear()
      await db.events.clear()
      await db.achievementUnlocks.clear()
      await db.achievementMonthEvaluations.clear()
    },
  )
}

export { normalizeAmount }

export async function listAchievementUnlocks() {
  return db.achievementUnlocks.toArray()
}

export async function listAchievementMonthEvaluations() {
  return db.achievementMonthEvaluations.toArray()
}

export async function saveAchievementUnlocks(achievementIds, unlockedMonth) {
  if (!achievementIds.length) {
    return []
  }

  const now = new Date().toISOString()
  const unlocks = achievementIds.map((achievementId) => ({
    achievementId,
    unlockedAt: now,
    unlockedMonth,
  }))
  let newUnlocks = []

  await db.transaction('rw', db.achievementUnlocks, async () => {
    const existingUnlocks = await db.achievementUnlocks
      .where('achievementId')
      .anyOf(achievementIds)
      .toArray()
    const existingIds = new Set(existingUnlocks.map((unlock) => unlock.achievementId))

    newUnlocks = unlocks.filter((unlock) => !existingIds.has(unlock.achievementId))

    if (newUnlocks.length) {
      await db.achievementUnlocks.bulkAdd(newUnlocks)
    }
  })

  return newUnlocks
}

export async function saveAchievementEvaluation(month, matchedAchievementIds) {
  const evaluatedAt = new Date().toISOString()
  let newUnlocks = []

  await db.transaction('rw', db.achievementUnlocks, db.achievementMonthEvaluations, async () => {
    const existingUnlocks = matchedAchievementIds.length
      ? await db.achievementUnlocks.where('achievementId').anyOf(matchedAchievementIds).toArray()
      : []
    const existingIds = new Set(existingUnlocks.map((unlock) => unlock.achievementId))

    newUnlocks = matchedAchievementIds
      .filter((achievementId) => !existingIds.has(achievementId))
      .map((achievementId) => ({
        achievementId,
        unlockedAt: evaluatedAt,
        unlockedMonth: month,
      }))

    if (newUnlocks.length) {
      await db.achievementUnlocks.bulkAdd(newUnlocks)
    }

    await db.achievementMonthEvaluations.put({
      month,
      evaluatedAt,
    })
  })

  return newUnlocks
}
