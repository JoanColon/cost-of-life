import { ref } from 'vue'
import { defineStore } from 'pinia'
import {
  getQuickLinks,
  saveQuickLinks as saveQuickLinksPreference,
} from '@/services/firebase/user-preferences.service'

export const useQuickLinksStore = defineStore('quick-links', () => {
  const linksByWorkspace = ref({})
  const loadedWorkspaceIds = ref(new Set())
  const loading = ref(false)
  const saving = ref(false)
  const error = ref(null)
  let requestId = 0

  function linksFor(workspaceId) {
    return linksByWorkspace.value[workspaceId] || []
  }

  async function load(workspaceId, force = false) {
    if (!workspaceId || (!force && loadedWorkspaceIds.value.has(workspaceId))) return

    const currentRequest = ++requestId
    loading.value = true
    error.value = null

    try {
      const links = await getQuickLinks(workspaceId)
      if (currentRequest !== requestId) return
      linksByWorkspace.value = { ...linksByWorkspace.value, [workspaceId]: links }
      loadedWorkspaceIds.value = new Set(loadedWorkspaceIds.value).add(workspaceId)
    } catch (loadError) {
      if (currentRequest !== requestId) return
      error.value = loadError
    } finally {
      if (currentRequest === requestId) loading.value = false
    }
  }

  async function save(workspaceId, links) {
    if (!workspaceId || saving.value) return

    saving.value = true
    error.value = null
    try {
      const savedLinks = await saveQuickLinksPreference(workspaceId, links)
      linksByWorkspace.value = { ...linksByWorkspace.value, [workspaceId]: savedLinks }
      loadedWorkspaceIds.value = new Set(loadedWorkspaceIds.value).add(workspaceId)
      return savedLinks
    } catch (saveError) {
      error.value = saveError
      throw saveError
    } finally {
      saving.value = false
    }
  }

  function reset() {
    requestId += 1
    linksByWorkspace.value = {}
    loadedWorkspaceIds.value = new Set()
    loading.value = false
    saving.value = false
    error.value = null
  }

  return { loading, saving, error, linksFor, load, save, reset }
})
