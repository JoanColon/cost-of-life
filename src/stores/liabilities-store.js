import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { liabilityCategoryIds } from '@/config/liability-categories'
import {
  createLiability as createLiabilityDocument,
  getCategoryLiabilities,
  getLiabilitiesConfig,
  removeLiability as removeLiabilityDocument,
  removeLiabilityCategory as removeLiabilityCategoryDocuments,
  saveLiabilitiesSetup,
  updateLiability as updateLiabilityDocument,
  updateLiabilityCategories,
  updateSimpleLiabilityOwnership as updateSimpleLiabilityOwnershipDocument,
  updateSimpleLiabilityValue as updateSimpleLiabilityValueDocument,
} from '@/services/firebase/liabilities.service'
import { buildModelCategories } from '@/domain/financial/model-categories'

export const useLiabilitiesStore = defineStore('liabilities', () => {
  const config = ref(null)
  const liabilitiesByCategory = ref({})
  const loading = ref(false)
  const categoryLoading = ref(false)
  const error = ref(null)
  const loadedWorkspaceId = ref(null)
  const loadedCategoryIds = ref(new Set())
  let configRequestId = 0
  let categoryRequestId = 0

  const setupCompleted = computed(() => Boolean(config.value?.setupCompleted))
  const enabledCategories = computed(() =>
    Object.entries(config.value?.categories || {})
      .filter(([, category]) => category.enabled)
      .map(([categoryId]) => categoryId),
  )

  async function loadConfig(workspaceId, force = false) {
    if (!workspaceId || (!force && loadedWorkspaceId.value === workspaceId)) return
    loading.value = true
    error.value = null
    config.value = null
    liabilitiesByCategory.value = {}
    loadedCategoryIds.value = new Set()
    const requestId = ++configRequestId
    try {
      const state = await getLiabilitiesConfig(workspaceId)
      if (requestId !== configRequestId) return
      config.value = state
      loadedWorkspaceId.value = workspaceId
    } catch (loadError) {
      if (requestId !== configRequestId) return
      error.value = loadError
      loadedWorkspaceId.value = workspaceId
    } finally {
      if (requestId === configRequestId) loading.value = false
    }
  }

  async function loadCategory(workspaceId, categoryId, force = false) {
    await loadConfig(workspaceId, force)
    if (error.value || !config.value?.categories?.[categoryId]) return
    if (!force && loadedCategoryIds.value.has(categoryId)) return

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
    const categories = buildModelCategories(
      liabilityCategoryIds,
      selectedCategoryIds,
      {},
      memberIds,
    )
    await saveLiabilitiesSetup(workspaceId, categories, userId)
    config.value = { setupCompleted: true, categories }
    loadedWorkspaceId.value = workspaceId
  }

  async function saveCategorySelection(workspaceId, selectedCategoryIds, userId, memberIds) {
    const categories = buildModelCategories(
      liabilityCategoryIds,
      selectedCategoryIds,
      config.value?.categories || {},
      memberIds,
    )
    await updateLiabilityCategories(workspaceId, categories, userId)
    config.value = { ...(config.value || {}), setupCompleted: true, categories }
  }

  async function updateSimpleCategoryValue(workspaceId, categoryId, value, userId) {
    replaceCategory(
      categoryId,
      await updateSimpleLiabilityValueDocument(workspaceId, categoryId, value, userId),
    )
  }

  async function updateSimpleCategoryOwnership(
    workspaceId,
    categoryId,
    ownership,
    userId,
    memberIds,
  ) {
    replaceCategory(
      categoryId,
      await updateSimpleLiabilityOwnershipDocument(
        workspaceId,
        categoryId,
        ownership,
        userId,
        memberIds,
      ),
    )
  }

  async function addLiability(workspaceId, liability, userId, memberIds) {
    const result = await createLiabilityDocument(workspaceId, liability, userId, memberIds)
    liabilitiesByCategory.value = {
      ...liabilitiesByCategory.value,
      [liability.category]: [...itemsForCategory(liability.category), result.liability],
    }
    loadedCategoryIds.value = new Set(loadedCategoryIds.value).add(liability.category)
    return result.liability
  }

  async function editLiability(workspaceId, liabilityId, changes, userId, memberIds) {
    const liability = findLoadedLiability(liabilityId)
    if (!liability) throw new Error('Liability not found')
    const result = await updateLiabilityDocument(
      workspaceId,
      liabilityId,
      changes,
      userId,
      memberIds,
    )
    liabilitiesByCategory.value = {
      ...liabilitiesByCategory.value,
      [liability.category]: itemsForCategory(liability.category).map((candidate) =>
        candidate.id === liabilityId ? result.liability : candidate,
      ),
    }
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
  }

  async function deleteCategory(workspaceId, categoryId, userId) {
    await removeLiabilityCategoryDocuments(workspaceId, categoryId, userId)
    const categories = { ...(config.value?.categories || {}) }
    delete categories[categoryId]
    config.value = { ...config.value, categories }
    const nextItems = { ...liabilitiesByCategory.value }
    delete nextItems[categoryId]
    liabilitiesByCategory.value = nextItems
    const nextLoadedIds = new Set(loadedCategoryIds.value)
    nextLoadedIds.delete(categoryId)
    loadedCategoryIds.value = nextLoadedIds
  }

  function itemsForCategory(categoryId) {
    return liabilitiesByCategory.value[categoryId] || []
  }

  function replaceCategory(categoryId, category) {
    config.value = {
      ...(config.value || {}),
      categories: {
        ...(config.value?.categories || {}),
        [categoryId]: { ...(config.value?.categories?.[categoryId] || {}), ...category },
      },
    }
  }

  function findLoadedLiability(liabilityId) {
    return Object.values(liabilitiesByCategory.value)
      .flat()
      .find((liability) => liability.id === liabilityId)
  }

  function reset() {
    configRequestId += 1
    categoryRequestId += 1
    config.value = null
    liabilitiesByCategory.value = {}
    loading.value = false
    categoryLoading.value = false
    error.value = null
    loadedWorkspaceId.value = null
    loadedCategoryIds.value = new Set()
  }

  return {
    config,
    loading,
    categoryLoading,
    error,
    setupCompleted,
    enabledCategories,
    loadConfig,
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
    reset,
  }
})
