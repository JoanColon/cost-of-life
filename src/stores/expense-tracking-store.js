import { ref } from 'vue'
import { defineStore } from 'pinia'
import {
  createTrackedExpense,
  getExpenseTrackingMonth,
  getExpenseTrackingPreferences,
  removeTrackedExpense,
  saveExpenseTrackingPreferences,
  saveTrackingReconciliation,
  saveTrackingReconciliations,
  updateTrackedExpense,
} from '@/services/firebase/expense-tracking.service'

export const useExpenseTrackingStore = defineStore('expense-tracking', () => {
  const month = ref(null)
  const enabledSubcategories = ref([])
  const availableSubcategories = ref([])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref(null)
  const loadedKey = ref(null)
  let requestId = 0

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
      enabledSubcategories.value = preferences.enabledSubcategories
      availableSubcategories.value = preferences.availableSubcategories
      loadedKey.value = key
    } catch (loadError) {
      if (currentRequest !== requestId) return
      error.value = loadError
    } finally {
      if (currentRequest === requestId) loading.value = false
    }
  }

  async function savePreferences(workspaceId, categoryIds) {
    saving.value = true
    try {
      enabledSubcategories.value = await saveExpenseTrackingPreferences(workspaceId, categoryIds)
    } finally {
      saving.value = false
    }
  }

  async function add(workspaceId, period, subcategoryId, input, memberIds) {
    await mutate(() => createTrackedExpense(workspaceId, period, subcategoryId, input, memberIds))
  }

  async function edit(workspaceId, period, subcategoryId, itemId, input, memberIds) {
    await mutate(() =>
      updateTrackedExpense(workspaceId, period, subcategoryId, itemId, input, memberIds),
    )
  }

  async function remove(workspaceId, period, subcategoryId, itemId) {
    await mutate(() => removeTrackedExpense(workspaceId, period, subcategoryId, itemId))
  }

  async function saveReconciliation(workspaceId, period, subcategoryId, decision) {
    await mutate(() => saveTrackingReconciliation(workspaceId, period, subcategoryId, decision))
  }

  async function saveReconciliations(workspaceId, period, subcategoryIds, decision) {
    await mutate(() => saveTrackingReconciliations(workspaceId, period, subcategoryIds, decision))
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
    } finally {
      saving.value = false
    }
  }

  function reset() {
    requestId += 1
    month.value = null
    enabledSubcategories.value = []
    availableSubcategories.value = []
    loading.value = false
    saving.value = false
    error.value = null
    loadedKey.value = null
  }

  return {
    month,
    enabledSubcategories,
    availableSubcategories,
    loading,
    saving,
    error,
    load,
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
