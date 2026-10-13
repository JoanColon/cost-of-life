import { ref } from 'vue'
import { defineStore } from 'pinia'
import { currentFinancialYear } from '@/domain/financial/financial-year'
import {
  getFinancialYear,
  rebuildFinancialYear,
  rebuildFinancialYearTracking,
  subscribeFinancialYear,
} from '@/services/firebase/financial-years.service'

export const useFinancialYearsStore = defineStore('financial-years', () => {
  const documents = ref({})
  const loading = ref(false)
  const error = ref(null)
  const subscriptions = new Map()
  let requestId = 0

  async function load(workspaceId, year = currentFinancialYear(), force = false) {
    const key = `${workspaceId}:${year}`
    if (!force && documents.value[key]) return documents.value[key]
    const currentRequest = ++requestId
    loading.value = true
    error.value = null
    try {
      const value = await getFinancialYear(workspaceId, year, {
        ensure: year === currentFinancialYear(),
      })
      if (currentRequest !== requestId) return null
      documents.value = { ...documents.value, [key]: value }
      if (year === currentFinancialYear()) watchCurrentYear(workspaceId, year)
      return value
    } catch (loadError) {
      if (currentRequest === requestId) error.value = loadError
      throw loadError
    } finally {
      if (currentRequest === requestId) loading.value = false
    }
  }

  function get(workspaceId, year = currentFinancialYear()) {
    return documents.value[`${workspaceId}:${year}`] || null
  }

  async function refresh(workspaceId, year = currentFinancialYear()) {
    loading.value = true
    error.value = null
    try {
      const value = await rebuildFinancialYear(workspaceId, year)
      documents.value = { ...documents.value, [`${workspaceId}:${year}`]: value }
      return value
    } catch (refreshError) {
      error.value = refreshError
      throw refreshError
    } finally {
      loading.value = false
    }
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
    subscriptions.forEach((unsubscribe) => unsubscribe())
    subscriptions.clear()
    requestId += 1
    documents.value = {}
    loading.value = false
    error.value = null
  }

  function watchCurrentYear(workspaceId, year) {
    const key = `${workspaceId}:${year}`
    if (subscriptions.has(key)) return
    subscriptions.set(
      key,
      subscribeFinancialYear(
        workspaceId,
        year,
        (value) => {
          documents.value = { ...documents.value, [key]: value }
        },
        (subscriptionError) => {
          error.value = subscriptionError
        },
      ),
    )
  }

  return { documents, loading, error, load, refresh, refreshTracking, get, reset }
})
