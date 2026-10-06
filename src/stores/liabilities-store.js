import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { liabilityCategoryIds } from '@/config/liability-categories'
import {
  createLiability as createLiabilityDocument,
  getCategoryLiabilities,
  getLiabilitiesSummary,
  removeLiability as removeLiabilityDocument,
  removeLiabilityCategory as removeLiabilityCategoryDocuments,
  saveLiabilitiesSetup,
  updateLiability as updateLiabilityDocument,
  updateLiabilityCategories,
  updateSimpleLiabilityOwnership as updateSimpleLiabilityOwnershipDocument,
  updateSimpleLiabilityValue as updateSimpleLiabilityValueDocument,
} from '@/services/firebase/liabilities.service'
import {
  allocateValueByOwnership,
  categoryEffectiveValue,
  cloneOwnership,
  createEqualOwnership,
  isItemizedCategory,
} from '@/utils/asset-calculations'

export const useLiabilitiesStore = defineStore('liabilities', () => {
  const summary = ref(null)
  const liabilitiesByCategory = ref({})
  const loading = ref(false)
  const categoryLoading = ref(false)
  const error = ref(null)
  const loadedWorkspaceId = ref(null)
  const loadedCategoryIds = ref(new Set())
  let summaryRequestId = 0
  let categoryRequestId = 0

  const setupCompleted = computed(() => Boolean(summary.value?.setupCompleted))
  const enabledCategories = computed(() =>
    Object.entries(summary.value?.categories || {})
      .filter(([, category]) => category.enabled)
      .map(([categoryId]) => categoryId),
  )

  async function loadSummary(workspaceId, force = false) {
    if (!workspaceId || (!force && loadedWorkspaceId.value === workspaceId)) return
    loading.value = true
    error.value = null
    summary.value = null
    liabilitiesByCategory.value = {}
    loadedCategoryIds.value = new Set()
    const requestId = ++summaryRequestId
    try {
      const state = await getLiabilitiesSummary(workspaceId)
      if (requestId !== summaryRequestId) return
      summary.value = state
      loadedWorkspaceId.value = workspaceId
    } catch (loadError) {
      if (requestId !== summaryRequestId) return
      error.value = loadError
      loadedWorkspaceId.value = workspaceId
    } finally {
      if (requestId === summaryRequestId) loading.value = false
    }
  }

  async function loadCategory(workspaceId, categoryId, force = false) {
    await loadSummary(workspaceId, force)
    if (error.value || !summary.value?.categories?.[categoryId]) return
    if (!force && loadedCategoryIds.value.has(categoryId)) return

    const category = summary.value.categories[categoryId]
    if (!isItemizedCategory(category)) {
      liabilitiesByCategory.value = { ...liabilitiesByCategory.value, [categoryId]: [] }
      loadedCategoryIds.value = new Set(loadedCategoryIds.value).add(categoryId)
      return
    }

    categoryLoading.value = true
    const requestId = ++categoryRequestId
    try {
      const liabilities = await getCategoryLiabilities(workspaceId, categoryId)
      if (requestId !== categoryRequestId) return
      liabilitiesByCategory.value = {
        ...liabilitiesByCategory.value,
        [categoryId]: liabilities,
      }
      loadedCategoryIds.value = new Set(loadedCategoryIds.value).add(categoryId)
    } catch (loadError) {
      if (requestId !== categoryRequestId) return
      error.value = loadError
    } finally {
      if (requestId === categoryRequestId) categoryLoading.value = false
    }
  }

  async function completeSetup(workspaceId, selectedCategoryIds, userId, memberIds) {
    const categories = buildCategories(selectedCategoryIds, {}, memberIds)
    await saveLiabilitiesSetup(workspaceId, categories, userId)
    summary.value = { setupCompleted: true, categories }
    loadedWorkspaceId.value = workspaceId
  }

  async function saveCategorySelection(workspaceId, selectedCategoryIds, userId, memberIds) {
    const categories = buildCategories(
      selectedCategoryIds,
      summary.value?.categories || {},
      memberIds,
    )
    await updateLiabilityCategories(workspaceId, categories, userId)
    summary.value = { ...(summary.value || {}), setupCompleted: true, categories }
  }

  async function updateSimpleCategoryValue(workspaceId, categoryId, value, userId) {
    replaceCategory(
      categoryId,
      await updateSimpleLiabilityValueDocument(workspaceId, categoryId, value, userId),
    )
  }

  async function updateSimpleCategoryOwnership(workspaceId, categoryId, ownership, userId) {
    replaceCategory(
      categoryId,
      await updateSimpleLiabilityOwnershipDocument(workspaceId, categoryId, ownership, userId),
    )
  }

  async function addLiability(workspaceId, liability, userId) {
    const result = await createLiabilityDocument(workspaceId, liability, userId)
    liabilitiesByCategory.value = {
      ...liabilitiesByCategory.value,
      [liability.category]: [...itemsForCategory(liability.category), result.liability],
    }
    loadedCategoryIds.value = new Set(loadedCategoryIds.value).add(liability.category)
    replaceCategory(liability.category, result.category)
    return result.liability
  }

  async function editLiability(workspaceId, liabilityId, changes, userId) {
    const liability = findLoadedLiability(liabilityId)
    if (!liability) throw new Error('Liability not found')
    const result = await updateLiabilityDocument(workspaceId, liabilityId, changes, userId)
    liabilitiesByCategory.value = {
      ...liabilitiesByCategory.value,
      [liability.category]: itemsForCategory(liability.category).map((candidate) =>
        candidate.id === liabilityId ? result.liability : candidate,
      ),
    }
    replaceCategory(liability.category, result.category)
  }

  async function deleteLiability(workspaceId, liabilityId, userId, memberIds) {
    if (!findLoadedLiability(liabilityId)) throw new Error('Liability not found')
    const result = await removeLiabilityDocument(workspaceId, liabilityId, userId, memberIds)
    liabilitiesByCategory.value = {
      ...liabilitiesByCategory.value,
      [result.categoryId]: itemsForCategory(result.categoryId).filter(
        (candidate) => candidate.id !== liabilityId,
      ),
    }
    replaceCategory(result.categoryId, result.category)
  }

  async function deleteCategory(workspaceId, categoryId, userId) {
    await removeLiabilityCategoryDocuments(workspaceId, categoryId, userId)
    const categories = { ...(summary.value?.categories || {}) }
    delete categories[categoryId]
    summary.value = { ...summary.value, categories }
    const nextItems = { ...liabilitiesByCategory.value }
    delete nextItems[categoryId]
    liabilitiesByCategory.value = nextItems
  }

  function itemsForCategory(categoryId) {
    return liabilitiesByCategory.value[categoryId] || []
  }

  function totalForCategory(categoryId, memberId = 'all') {
    return categoryEffectiveValue(summary.value?.categories?.[categoryId], memberId)
  }

  function total(memberId = 'all') {
    return (
      Math.round(
        Object.values(summary.value?.categories || {}).reduce(
          (sum, category) => sum + categoryEffectiveValue(category, memberId),
          0,
        ) * 100,
      ) / 100
    )
  }

  function replaceCategory(categoryId, category) {
    summary.value = {
      ...(summary.value || {}),
      categories: { ...(summary.value?.categories || {}), [categoryId]: category },
    }
  }

  function findLoadedLiability(liabilityId) {
    return Object.values(liabilitiesByCategory.value)
      .flat()
      .find((liability) => liability.id === liabilityId)
  }

  function reset() {
    summaryRequestId += 1
    categoryRequestId += 1
    summary.value = null
    liabilitiesByCategory.value = {}
    loading.value = false
    categoryLoading.value = false
    error.value = null
    loadedWorkspaceId.value = null
    loadedCategoryIds.value = new Set()
  }

  return {
    summary,
    loading,
    categoryLoading,
    error,
    setupCompleted,
    enabledCategories,
    loadSummary,
    loadCategory,
    completeSetup,
    saveCategorySelection,
    updateSimpleCategoryValue,
    updateSimpleCategoryOwnership,
    addLiability,
    editLiability,
    deleteLiability,
    deleteCategory,
    itemsForCategory,
    totalForCategory,
    total,
    reset,
  }
})

function buildCategories(selectedCategoryIds, existingCategories, memberIds) {
  const selected = new Set(selectedCategoryIds)
  return Object.fromEntries(
    liabilityCategoryIds.map((categoryId) => {
      const previous = existingCategories[categoryId]
      if (previous) return [categoryId, { ...previous, enabled: selected.has(categoryId) }]
      const ownership = createEqualOwnership(memberIds)
      return [
        categoryId,
        {
          enabled: selected.has(categoryId),
          manualValue: 0,
          ownership: cloneOwnership(ownership),
          itemCount: 0,
          itemizedValue: 0,
          memberValues: allocateValueByOwnership(0, ownership, memberIds),
        },
      ]
    }),
  )
}
