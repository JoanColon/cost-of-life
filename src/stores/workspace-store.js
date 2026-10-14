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
  const initializedForUserId = ref(null)

  const hasWorkspaces = computed(() => workspaces.value.length > 0)

  async function load(user) {
    if (!user?.uid || initializedForUserId.value === user.uid) return

    loading.value = true

    try {
      workspaces.value = await getUserWorkspaces()
      initializedForUserId.value = user.uid
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

  function reset() {
    workspaces.value = []
    initializedForUserId.value = null
  }

  return {
    workspaces,
    hasWorkspaces,
    loading,
    load,
    create,
    deleteWorkspace,
    reset,
  }
})
