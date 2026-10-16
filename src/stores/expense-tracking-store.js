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
  const loading = ref(false)
  const saving = ref(false)
  const error = ref(null)
  const loadedKey = ref(null)
  const loadedPreferencesWorkspaceId = ref(null)
  let requestId = 0
  let preferencesRequestId = 0
  let pendingPreferences = null

  async function load(workspaceId, period, force = false) {
    const key = `${workspaceId}:${period}`
    if (!force && loadedKey.value === key) return loadPreferences(workspaceId)
    const currentRequest = ++requestId
    loading.value = true
    error.value = null
    try {
      const [trackingMonth] = await Promise.all([
        getExpenseTrackingMonth(workspaceId, period),
        loadPreferences(workspaceId),
      ])
      if (currentRequest !== requestId) return
      month.value = trackingMonth
      loadedKey.value = key
    } catch (loadError) {
      if (currentRequest !== requestId) return
      error.value = loadError
    } finally {
      if (currentRequest === requestId) loading.value = false
    }
  }

  async function loadPreferences(workspaceId, force = false) {
    if (!force && loadedPreferencesWorkspaceId.value === workspaceId) return
    if (!force && pendingPreferences?.workspaceId === workspaceId) {
      return pendingPreferences.promise
    }

    const currentRequest = ++preferencesRequestId
    const promise = getExpenseTrackingPreferences(workspaceId)
    pendingPreferences = { workspaceId, promise }
    try {
      const preferences = await promise
      if (currentRequest !== preferencesRequestId) return
      enabledSubcategories.value = preferences.enabledSubcategories
      loadedPreferencesWorkspaceId.value = workspaceId
    } finally {
      if (currentRequest === preferencesRequestId) pendingPreferences = null
    }
  }

  function invalidatePreferences(workspaceId) {
    if (
      loadedPreferencesWorkspaceId.value !== workspaceId &&
      pendingPreferences?.workspaceId !== workspaceId
    ) {
      return
    }
    preferencesRequestId += 1
    pendingPreferences = null
    loadedPreferencesWorkspaceId.value = null
  }

  async function savePreferences(workspaceId, categoryIds) {
    saving.value = true
    try {
      enabledSubcategories.value = await saveExpenseTrackingPreferences(workspaceId, categoryIds)
      loadedPreferencesWorkspaceId.value = workspaceId
    } finally {
      saving.value = false
    }
  }

  async function add(workspaceId, period, subcategoryId, input, memberIds) {
    await mutate(workspaceId, period, () =>
      createTrackedExpense(workspaceId, period, subcategoryId, input, memberIds),
    )
  }

  async function edit(workspaceId, period, subcategoryId, itemId, input, memberIds) {
    await mutate(workspaceId, period, () =>
      updateTrackedExpense(workspaceId, period, subcategoryId, itemId, input, memberIds),
    )
  }

  async function remove(workspaceId, period, subcategoryId, itemId) {
    await mutate(workspaceId, period, () =>
      removeTrackedExpense(workspaceId, period, subcategoryId, itemId),
    )
  }

  async function saveReconciliation(workspaceId, period, subcategoryId, decision) {
    await mutate(workspaceId, period, () =>
      saveTrackingReconciliation(workspaceId, period, subcategoryId, decision),
    )
  }

  async function saveReconciliations(workspaceId, period, subcategoryIds, decision) {
    await mutate(workspaceId, period, () =>
      saveTrackingReconciliations(workspaceId, period, subcategoryIds, decision),
    )
  }

  function itemsFor(subcategoryId) {
    return month.value?.categories?.[subcategoryId]?.items || []
  }

  function totalFor(subcategoryId) {
    return month.value?.categories?.[subcategoryId]?.total || 0
  }

  async function mutate(workspaceId, period, operation) {
    const key = `${workspaceId}:${period}`
    saving.value = true
    try {
      const updatedMonth = await operation()
      if (loadedKey.value === key) month.value = updatedMonth
    } finally {
      saving.value = false
    }
  }

  function reset() {
    requestId += 1
    preferencesRequestId += 1
    pendingPreferences = null
    month.value = null
    enabledSubcategories.value = []
    loading.value = false
    saving.value = false
    error.value = null
    loadedKey.value = null
    loadedPreferencesWorkspaceId.value = null
  }

  return {
    month,
    enabledSubcategories,
    loading,
    saving,
    error,
    load,
    loadPreferences,
    invalidatePreferences,
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
