import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { currentFinancialMonth, currentFinancialYear } from '@/domain/financial/financial-year'
import { calculateMilestoneProgress } from '@/domain/milestones/calculations'
import {
  activateMilestoneTracking as activateMilestoneTrackingDocuments,
  getAchievements,
  syncMilestoneAchievements,
} from '@/services/firebase/achievements.service'
import { getFinancialHistory } from '@/services/firebase/history.service'
import { useFinancialYearsStore } from '@/stores/financial-years-store'
import { useWorkspaceStore } from '@/stores/workspace-store'

export const useMilestonesStore = defineStore('milestones', () => {
  const financialYearsStore = useFinancialYearsStore()
  const workspaceStore = useWorkspaceStore()
  const workspaceId = ref(null)
  const loadedKey = ref(null)
  const currentYear = ref(currentFinancialYear())
  const currentMonth = ref(currentFinancialMonth())
  const historyDocuments = ref([])
  const achievements = ref([])
  const historyLoading = ref(false)
  const achievementsLoading = ref(false)
  const historyError = ref(null)
  const achievementsError = ref(null)
  const achievementsReady = ref(false)
  const achievementSyncing = ref(false)
  const activationLoading = ref(false)
  let requestId = 0
  let achievementSyncPending = false

  const financialYear = computed(() =>
    workspaceId.value ? financialYearsStore.get(workspaceId.value, currentYear.value) : null,
  )
  const workspace = computed(
    () => workspaceStore.workspaces.find((candidate) => candidate.id === workspaceId.value) || null,
  )
  const trackingActive = computed(() => workspace.value?.milestoneTracking?.status === 'active')
  const progress = computed(() => {
    if (!financialYear.value || !achievementsReady.value) return []
    return calculateMilestoneProgress({
      financialYear: financialYear.value,
      financialHistory: historyDocuments.value,
      achievements: trackingActive.value ? achievements.value : [],
      month: currentMonth.value,
    })
  })
  const loading = computed(
    () => financialYearsStore.loading || historyLoading.value || achievementsLoading.value,
  )
  const error = computed(
    () =>
      (workspaceId.value && financialYearsStore.errorFor(workspaceId.value, currentYear.value)) ||
      historyError.value ||
      achievementsError.value,
  )

  watch([financialYear, trackingActive], () => syncAchievements(progress.value))

  async function load(id, force = false) {
    if (!id) return

    const year = currentFinancialYear()
    const month = currentFinancialMonth()
    const key = `${id}:${year}`
    workspaceId.value = id
    currentYear.value = year
    currentMonth.value = month

    if (!force && loadedKey.value === key) {
      await financialYearsStore.load(id, year)
      await syncAchievements(progress.value)
      return
    }

    const currentRequest = ++requestId
    historyDocuments.value = []
    achievements.value = []
    historyError.value = null
    achievementsError.value = null
    achievementsReady.value = false
    historyLoading.value = true
    achievementsLoading.value = true

    const [, historyResult, achievementsResult] = await Promise.allSettled([
      financialYearsStore.load(id, year, force),
      getFinancialHistory(id),
      getAchievements(id),
    ])
    if (currentRequest !== requestId) return

    if (historyResult.status === 'fulfilled') historyDocuments.value = historyResult.value
    else historyError.value = historyResult.reason
    if (achievementsResult.status === 'fulfilled') {
      achievements.value = achievementsResult.value
      achievementsReady.value = true
    } else achievementsError.value = achievementsResult.reason

    loadedKey.value = key
    historyLoading.value = false
    achievementsLoading.value = false
    await syncAchievements(progress.value)
  }

  async function syncAchievements(currentProgress) {
    if (!trackingActive.value || !currentProgress.length) return
    if (achievementSyncing.value) {
      achievementSyncPending = true
      return
    }

    const activeWorkspaceId = workspaceId.value
    achievementSyncing.value = true
    try {
      const resolved = await syncMilestoneAchievements(
        activeWorkspaceId,
        currentProgress,
        achievements.value,
      )
      if (workspaceId.value !== activeWorkspaceId) return
      achievements.value = resolved
    } catch (syncError) {
      achievementsError.value = syncError
    } finally {
      achievementSyncing.value = false
      if (achievementSyncPending) {
        achievementSyncPending = false
        syncAchievements(progress.value)
      }
    }
  }

  async function activateTracking() {
    if (!workspaceId.value || trackingActive.value || activationLoading.value) return

    const activeWorkspaceId = workspaceId.value
    activationLoading.value = true
    achievementsError.value = null
    try {
      const result = await activateMilestoneTrackingDocuments(
        activeWorkspaceId,
        progress.value,
        achievements.value,
      )
      if (workspaceId.value !== activeWorkspaceId) return
      achievements.value = result.achievements
      workspaceStore.setMilestoneTracking(activeWorkspaceId, result.milestoneTracking)
    } catch (activationError) {
      achievementsError.value = activationError
      throw activationError
    } finally {
      activationLoading.value = false
    }
  }

  function reset() {
    requestId += 1
    achievementSyncPending = false
    workspaceId.value = null
    loadedKey.value = null
    currentYear.value = currentFinancialYear()
    currentMonth.value = currentFinancialMonth()
    historyDocuments.value = []
    achievements.value = []
    historyLoading.value = false
    achievementsLoading.value = false
    historyError.value = null
    achievementsError.value = null
    achievementsReady.value = false
    achievementSyncing.value = false
    activationLoading.value = false
  }

  return {
    achievements,
    activateTracking,
    activationLoading,
    currentMonth,
    currentYear,
    error,
    financialYear,
    historyDocuments,
    historyError,
    historyLoading,
    load,
    loading,
    progress,
    reset,
    trackingActive,
  }
})
