import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  createWorkspace,
  deleteWorkspace as deleteWorkspaceDocument,
  getUserWorkspaces,
} from '@/services/firebase/workspace.service'

export const useWorkspaceStore = defineStore('workspace', () => {
  const workspaces = ref([])
  const loading = ref(false)
  const error = ref(null)
  const initializedForUserId = ref(null)

  const hasWorkspaces = computed(() => workspaces.value.length > 0)
  const ready = computed(() => initializedForUserId.value !== null)

  async function load(user, force = false) {
    if (!user?.uid || (!force && initializedForUserId.value === user.uid)) return

    loading.value = true
    error.value = null

    try {
      workspaces.value = await getUserWorkspaces()
      initializedForUserId.value = user.uid
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
    return workspace
  }

  async function deleteWorkspace(workspaceId) {
    await deleteWorkspaceDocument(workspaceId)
    workspaces.value = workspaces.value.filter((workspace) => workspace.id !== workspaceId)
  }

  function setMilestoneTracking(workspaceId, milestoneTracking) {
    const index = workspaces.value.findIndex((workspace) => workspace.id === workspaceId)
    if (index < 0) return
    workspaces.value[index] = { ...workspaces.value[index], milestoneTracking }
  }

  function reset() {
    workspaces.value = []
    error.value = null
    initializedForUserId.value = null
  }

  return {
    workspaces,
    hasWorkspaces,
    ready,
    loading,
    error,
    load,
    create,
    deleteWorkspace,
    setMilestoneTracking,
    reset,
  }
})
