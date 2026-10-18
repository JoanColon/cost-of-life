import { ref } from 'vue'
import { defineStore } from 'pinia'
import { defaultWhatIfConfig, normalizeWhatIfConfig } from '@/domain/financial/what-if'
import {
  getWhatIfConfig,
  saveWhatIfConfig as saveWhatIfConfigDocument,
} from '@/services/firebase/what-if.service'

export const useWhatIfStore = defineStore('what-if', () => {
  const config = ref(normalizeWhatIfConfig(defaultWhatIfConfig))
  const loading = ref(false)
  const saving = ref(false)
  const error = ref(null)
  const loadedWorkspaceId = ref(null)
  let requestId = 0

  async function load(workspaceId, force = false) {
    if (!workspaceId || (!force && loadedWorkspaceId.value === workspaceId)) return config.value
    const currentRequest = ++requestId
    loading.value = true
    error.value = null
    try {
      const value = await getWhatIfConfig(workspaceId)
      if (currentRequest !== requestId) return null
      config.value = value
      loadedWorkspaceId.value = workspaceId
      return value
    } catch (loadError) {
      if (currentRequest === requestId) error.value = loadError
      throw loadError
    } finally {
      if (currentRequest === requestId) loading.value = false
    }
  }

  async function save(workspaceId, changes) {
    saving.value = true
    error.value = null
    try {
      const next = normalizeWhatIfConfig({ ...config.value, ...changes })
      config.value = await saveWhatIfConfigDocument(workspaceId, next)
      loadedWorkspaceId.value = workspaceId
      return config.value
    } catch (saveError) {
      error.value = saveError
      throw saveError
    } finally {
      saving.value = false
    }
  }

  function reset() {
    requestId += 1
    config.value = normalizeWhatIfConfig(defaultWhatIfConfig)
    loading.value = false
    saving.value = false
    error.value = null
    loadedWorkspaceId.value = null
  }

  return { config, loading, saving, error, load, save, reset }
})
