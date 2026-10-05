import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { createFinancialWorkspace, getUserWorkspaces } from '@/services/firebase/workspace.service'

export const useWorkspaceStore = defineStore('workspace', () => {
  const workspaces = ref([])
  const currentWorkspaceId = ref(null)
  const loading = ref(false)
  const initializedForUserId = ref(null)

  const currentWorkspace = computed(
    () => workspaces.value.find((workspace) => workspace.id === currentWorkspaceId.value) || null,
  )
  const hasWorkspaces = computed(() => workspaces.value.length > 0)

  async function load(user) {
    if (!user?.uid || initializedForUserId.value === user.uid) return

    loading.value = true

    try {
      workspaces.value = await getUserWorkspaces(user)
      initializedForUserId.value = user.uid

      const storedWorkspaceId = localStorage.getItem(storageKey(user.uid))
      const storedWorkspaceExists = workspaces.value.some(
        (workspace) => workspace.id === storedWorkspaceId,
      )

      select(storedWorkspaceExists ? storedWorkspaceId : workspaces.value[0]?.id || null, user.uid)
    } finally {
      loading.value = false
    }
  }

  async function create(payload) {
    const workspace = await createFinancialWorkspace(payload)
    workspaces.value.push(workspace)
    initializedForUserId.value = payload.user.uid
    select(workspace.id, payload.user.uid)
    return workspace
  }

  function select(workspaceId, userId = initializedForUserId.value) {
    currentWorkspaceId.value = workspaceId

    if (!userId) return

    if (workspaceId) {
      localStorage.setItem(storageKey(userId), workspaceId)
    } else {
      localStorage.removeItem(storageKey(userId))
    }
  }

  function reset() {
    workspaces.value = []
    currentWorkspaceId.value = null
    initializedForUserId.value = null
  }

  function storageKey(userId) {
    return `cost-of-life:workspace:${userId}`
  }

  return {
    workspaces,
    currentWorkspaceId,
    currentWorkspace,
    hasWorkspaces,
    loading,
    load,
    create,
    select,
    reset,
  }
})
