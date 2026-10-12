import { ref } from 'vue'
import { defineStore } from 'pinia'
import {
  createTrackedExpense,
  getExpenseTrackingMonth,
  getExpenseTrackingPreferences,
  getExpenseTrackingYear,
  removeTrackedExpense,
  saveExpenseTrackingPreferences,
  saveTrackingReconciliation,
  saveTrackingReconciliations,
  updateTrackedExpense,
} from '@/services/firebase/expense-tracking.service'

export const useExpenseTrackingStore = defineStore('expense-tracking', () => {
  const month = ref(null)
  const enabledSubcategories = ref([])
  const yearMonths = ref({})
  const loading = ref(false)
  const saving = ref(false)
  const error = ref(null)
  const loadedKey = ref(null)
  const loadedYearKey = ref(null)
  let requestId = 0
  let yearRequestId = 0

  async function load(workspaceId, period, force = false) {
    const key = `${workspaceId}:${period}`
    if (!force && loadedKey.value === key) return
    const currentRequest = ++requestId
    loading.value = true
    error.value = null
    try {
      const [trackingMonth, preferences] = await Promise.all([
        getExpenseTrackingMonth(workspaceId, period),
        getExpenseTrackingPreferences(workspaceId),
      ])
      if (currentRequest !== requestId) return
      month.value = trackingMonth
      enabledSubcategories.value = preferences
      loadedKey.value = key
    } catch (loadError) {
      if (currentRequest !== requestId) return
      error.value = loadError
    } finally {
      if (currentRequest === requestId) loading.value = false
    }
  }

  async function savePreferences(workspaceId, categoryIds, userId) {
    saving.value = true
    try {
      enabledSubcategories.value = await saveExpenseTrackingPreferences(
        workspaceId,
        categoryIds,
        userId,
      )
    } finally {
      saving.value = false
    }
  }

  async function loadYear(workspaceId, year, force = false) {
    const key = `${workspaceId}:${year}`
    if (!force && loadedYearKey.value === key) return
    const currentRequest = ++yearRequestId
    loading.value = true
    error.value = null
    try {
      const [months, preferences] = await Promise.all([
        getExpenseTrackingYear(workspaceId, year),
        getExpenseTrackingPreferences(workspaceId),
      ])
      if (currentRequest !== yearRequestId) return
      yearMonths.value = months
      enabledSubcategories.value = preferences
      loadedYearKey.value = key
    } catch (loadError) {
      if (currentRequest !== yearRequestId) return
      error.value = loadError
      throw loadError
    } finally {
      if (currentRequest === yearRequestId) loading.value = false
    }
  }

  async function add(workspaceId, period, subcategoryId, input, userId, memberIds) {
    await mutate(() =>
      createTrackedExpense(workspaceId, period, subcategoryId, input, userId, memberIds),
    )
  }

  async function edit(workspaceId, period, subcategoryId, itemId, input, userId, memberIds) {
    await mutate(() =>
      updateTrackedExpense(workspaceId, period, subcategoryId, itemId, input, userId, memberIds),
    )
  }

  async function remove(workspaceId, period, subcategoryId, itemId, userId) {
    await mutate(() => removeTrackedExpense(workspaceId, period, subcategoryId, itemId, userId))
  }

  async function saveReconciliation(workspaceId, period, subcategoryId, decision, userId) {
    await mutate(() =>
      saveTrackingReconciliation(workspaceId, period, subcategoryId, decision, userId),
    )
  }

  async function saveReconciliations(workspaceId, period, subcategoryIds, decision, userId) {
    await mutate(() =>
      saveTrackingReconciliations(workspaceId, period, subcategoryIds, decision, userId),
    )
  }

  function itemsFor(subcategoryId) {
    return month.value?.categories?.[subcategoryId]?.items || []
  }

  function totalFor(subcategoryId) {
    return month.value?.categories?.[subcategoryId]?.total || 0
  }

  async function mutate(operation) {
    saving.value = true
    try {
      const updatedMonth = await operation()
      month.value = updatedMonth
      const period = `${updatedMonth.year}-${String(updatedMonth.month).padStart(2, '0')}`
      if (loadedYearKey.value?.endsWith(`:${updatedMonth.year}`)) {
        yearMonths.value = { ...yearMonths.value, [period]: updatedMonth }
      }
    } finally {
      saving.value = false
    }
  }

  function reset() {
    requestId += 1
    yearRequestId += 1
    month.value = null
    yearMonths.value = {}
    enabledSubcategories.value = []
    loading.value = false
    saving.value = false
    error.value = null
    loadedKey.value = null
    loadedYearKey.value = null
  }

  return {
    month,
    yearMonths,
    enabledSubcategories,
    loading,
    saving,
    error,
    load,
    loadYear,
    savePreferences,
    add,
    edit,
    remove,
    saveReconciliation,
    saveReconciliations,
    itemsFor,
    totalFor,
    reset,
  }
})
