import { ref } from 'vue'
import { defineStore } from 'pinia'
import { currentFinancialYear } from '@/domain/financial/financial-year'
import {
  getFinancialYear,
  rebuildFinancialYearTracking,
  subscribeFinancialYear,
} from '@/services/firebase/financial-years.service'

export const useFinancialYearsStore = defineStore('financial-years', () => {
  const documents = ref({})
  const loading = ref(false)
  const error = ref(null)
  const requestIds = new Map()
  const loadingKeys = new Set()
  let activeSubscription = null

  async function load(workspaceId, year = currentFinancialYear(), force = false) {
    const key = `${workspaceId}:${year}`
    if (!force && Object.hasOwn(documents.value, key)) return documents.value[key]
    const currentRequest = (requestIds.get(key) || 0) + 1
    requestIds.set(key, currentRequest)
    loadingKeys.add(key)
    loading.value = true
    error.value = null
    try {
      const value = await getFinancialYear(workspaceId, year, {
        ensure: year === currentFinancialYear(),
      })
      if (currentRequest !== requestIds.get(key)) return null
      documents.value = { ...documents.value, [key]: value }
      if (year === currentFinancialYear()) watchCurrentYear(workspaceId, year)
      return value
    } catch (loadError) {
      if (currentRequest === requestIds.get(key)) error.value = loadError
      throw loadError
    } finally {
      if (currentRequest === requestIds.get(key)) {
        loadingKeys.delete(key)
        loading.value = loadingKeys.size > 0
      }
    }
  }

  function get(workspaceId, year = currentFinancialYear()) {
    return documents.value[`${workspaceId}:${year}`] || null
  }

  async function refreshTracking(workspaceId, period) {
    const value = await rebuildFinancialYearTracking(workspaceId, period)
    documents.value = {
      ...documents.value,
      [`${workspaceId}:${Number(period.slice(0, 4))}`]: value,
    }
    return value
  }

  function reset() {
    stopWatching()
    requestIds.clear()
    loadingKeys.clear()
    documents.value = {}
    loading.value = false
    error.value = null
  }

  function watchCurrentYear(workspaceId, year) {
    const key = `${workspaceId}:${year}`
    if (activeSubscription?.key === key) return
    stopWatching()
    activeSubscription = {
      key,
      unsubscribe: subscribeFinancialYear(
        workspaceId,
        year,
        (value) => {
          documents.value = { ...documents.value, [key]: value }
        },
        (subscriptionError) => {
          error.value = subscriptionError
        },
      ),
    }
  }

  function clearWorkspace(workspaceId) {
    const prefix = `${workspaceId}:`
    if (activeSubscription?.key.startsWith(prefix)) stopWatching()
    documents.value = Object.fromEntries(
      Object.entries(documents.value).filter(([key]) => !key.startsWith(prefix)),
    )
    for (const key of requestIds.keys()) {
      if (key.startsWith(prefix)) requestIds.delete(key)
    }
    for (const key of loadingKeys) {
      if (key.startsWith(prefix)) loadingKeys.delete(key)
    }
    loading.value = loadingKeys.size > 0
  }

  function stopWatching() {
    activeSubscription?.unsubscribe()
    activeSubscription = null
  }

  return {
    documents,
    loading,
    error,
    load,
    refreshTracking,
    get,
    clearWorkspace,
    stopWatching,
    reset,
  }
})
