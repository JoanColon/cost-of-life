import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useFinancialScopeStore = defineStore('financial-scope', () => {
  const selectedByWorkspace = ref({})

  function get(workspaceId, memberIds, preferredMemberId) {
    const selected = selectedByWorkspace.value[workspaceId]
    if (selected === 'all' || memberIds.includes(selected)) return selected
    return memberIds.includes(preferredMemberId) ? preferredMemberId : memberIds[0] || 'all'
  }

  function select(workspaceId, memberId) {
    selectedByWorkspace.value = {
      ...selectedByWorkspace.value,
      [workspaceId]: memberId,
    }
  }

  function reset() {
    selectedByWorkspace.value = {}
  }

  return { selectedByWorkspace, get, select, reset }
})
