import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  createWorkspace,
  deleteWorkspace as deleteWorkspaceDocument,
  getUserWorkspaces,
} from '@/services/firebase/workspace.service'
import {
  getActiveWorkspaceId,
  saveActiveWorkspaceId,
} from '@/services/firebase/user-preferences.service'

export const useWorkspaceStore = defineStore('workspace', () => {
  const workspaces = ref([])
  const activeWorkspaceId = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const initializedForUserId = ref(null)

  const hasWorkspaces = computed(() => workspaces.value.length > 0)
  const ready = computed(() => initializedForUserId.value !== null)
  const activeWorkspace = computed(
    () => workspaces.value.find((workspace) => workspace.id === activeWorkspaceId.value) || null,
  )

  async function load(user, force = false) {
    if (!user?.uid || (!force && initializedForUserId.value === user.uid)) return

    loading.value = true
    error.value = null

    try {
      const [loadedWorkspaces, storedWorkspaceId] = await Promise.all([
        getUserWorkspaces(),
        getActiveWorkspaceId(),
      ])
      workspaces.value = loadedWorkspaces
      initializedForUserId.value = user.uid
      await restoreActiveWorkspace(storedWorkspaceId)
    } catch (loadError) {
      error.value = loadError
      throw loadError
    } finally {
      loading.value = false
    }
  }

  async function create(payload) {
    const workspace = await createWorkspace(payload)
    workspaces.value.push(workspace)
    initializedForUserId.value = workspace.createdBy
    await setActiveWorkspace(workspace.id)
    return workspace
  }

  async function deleteWorkspace(workspaceId) {
    await deleteWorkspaceDocument(workspaceId)
    workspaces.value = workspaces.value.filter((workspace) => workspace.id !== workspaceId)
    if (activeWorkspaceId.value === workspaceId) {
      await clearActiveWorkspace()
      await selectOnlyWorkspace()
    }
  }

  async function setActiveWorkspace(workspaceId) {
    const id = String(workspaceId || '')
    if (!workspaces.value.some((workspace) => workspace.id === id)) return false
    if (activeWorkspaceId.value === id) return true

    const previousWorkspaceId = activeWorkspaceId.value
    activeWorkspaceId.value = id
    try {
      await saveActiveWorkspaceId(id)
    } catch (saveError) {
      activeWorkspaceId.value = previousWorkspaceId
      throw saveError
    }
    return true
  }

  async function clearActiveWorkspace() {
    const previousWorkspaceId = activeWorkspaceId.value
    activeWorkspaceId.value = null
    try {
      await saveActiveWorkspaceId(null)
    } catch (saveError) {
      activeWorkspaceId.value = previousWorkspaceId
      throw saveError
    }
  }

  function setMilestoneTracking(workspaceId, milestoneTracking) {
    const index = workspaces.value.findIndex((workspace) => workspace.id === workspaceId)
    if (index < 0) return
    workspaces.value[index] = { ...workspaces.value[index], milestoneTracking }
  }

  function reset() {
    workspaces.value = []
    activeWorkspaceId.value = null
    error.value = null
    initializedForUserId.value = null
  }

  async function restoreActiveWorkspace(storedWorkspaceId) {
    const storedWorkspaceExists = workspaces.value.some(
      (workspace) => workspace.id === storedWorkspaceId,
    )
    const nextWorkspaceId = storedWorkspaceExists
      ? storedWorkspaceId
      : workspaces.value.length === 1
        ? workspaces.value[0].id
        : null

    activeWorkspaceId.value = nextWorkspaceId
    if (storedWorkspaceId !== nextWorkspaceId) await saveActiveWorkspaceId(nextWorkspaceId)
  }

  async function selectOnlyWorkspace() {
    if (workspaces.value.length === 1) await setActiveWorkspace(workspaces.value[0].id)
  }

  return {
    workspaces,
    activeWorkspaceId,
    activeWorkspace,
    hasWorkspaces,
    ready,
    loading,
    error,
    load,
    create,
    deleteWorkspace,
    setActiveWorkspace,
    clearActiveWorkspace,
    setMilestoneTracking,
    reset,
  }
})
