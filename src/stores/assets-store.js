import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { assetCategoryIds } from '@/config/asset-categories'
import {
  createAsset as createAssetDocument,
  getAssetsSummary,
  getCategoryAssets,
  removeAsset as removeAssetDocument,
  removeAssetCategory as removeAssetCategoryDocuments,
  saveAssetsSetup,
  updateAsset as updateAssetDocument,
  updateAssetsCategories,
  updateSimpleCategoryOwnership as updateSimpleCategoryOwnershipDocument,
  updateSimpleCategoryValue as updateSimpleCategoryValueDocument,
} from '@/services/firebase/assets.service'
import {
  buildSummaryCategories,
  categoryEffectiveValue,
  isItemizedCategory,
  totalCategories,
} from '@/domain/financial/category-summary'

export const useAssetsStore = defineStore('assets', () => {
  const summary = ref(null)
  const assetsByCategory = ref({})
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
    assetsByCategory.value = {}
    loadedCategoryIds.value = new Set()
    const requestId = ++summaryRequestId

    try {
      const state = await getAssetsSummary(workspaceId)
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
      assetsByCategory.value = { ...assetsByCategory.value, [categoryId]: [] }
      loadedCategoryIds.value = new Set(loadedCategoryIds.value).add(categoryId)
      return
    }

    categoryLoading.value = true
    const requestId = ++categoryRequestId

    try {
      const assets = await getCategoryAssets(workspaceId, categoryId)
      if (requestId !== categoryRequestId) return
      assetsByCategory.value = { ...assetsByCategory.value, [categoryId]: assets }
      loadedCategoryIds.value = new Set(loadedCategoryIds.value).add(categoryId)
    } catch (loadError) {
      if (requestId !== categoryRequestId) return
      error.value = loadError
    } finally {
      if (requestId === categoryRequestId) categoryLoading.value = false
    }
  }

  async function completeSetup(workspaceId, selectedCategoryIds, userId, memberIds) {
    const categories = buildSummaryCategories(assetCategoryIds, selectedCategoryIds, {}, memberIds)
    await saveAssetsSetup(workspaceId, categories, userId)
    summary.value = { setupCompleted: true, categories }
    loadedWorkspaceId.value = workspaceId
  }

  async function saveCategorySelection(workspaceId, selectedCategoryIds, userId, memberIds) {
    const categories = buildSummaryCategories(
      assetCategoryIds,
      selectedCategoryIds,
      summary.value?.categories || {},
      memberIds,
    )
    await updateAssetsCategories(workspaceId, categories, userId)
    summary.value = { ...(summary.value || {}), setupCompleted: true, categories }
  }

  async function updateSimpleCategoryValue(workspaceId, categoryId, value, userId) {
    const category = await updateSimpleCategoryValueDocument(workspaceId, categoryId, value, userId)
    replaceCategory(categoryId, category)
  }

  async function updateSimpleCategoryOwnership(
    workspaceId,
    categoryId,
    ownership,
    userId,
    memberIds,
  ) {
    const category = await updateSimpleCategoryOwnershipDocument(
      workspaceId,
      categoryId,
      ownership,
      userId,
      memberIds,
    )
    replaceCategory(categoryId, category)
  }

  async function addAsset(workspaceId, asset, userId, memberIds) {
    const result = await createAssetDocument(workspaceId, asset, userId, memberIds)
    const categoryAssets = itemsForCategory(asset.category)
    assetsByCategory.value = {
      ...assetsByCategory.value,
      [asset.category]: [...categoryAssets, result.asset],
    }
    loadedCategoryIds.value = new Set(loadedCategoryIds.value).add(asset.category)
    replaceCategory(asset.category, result.category)
    return result.asset
  }

  async function editAsset(workspaceId, assetId, changes, userId, memberIds) {
    const asset = findLoadedAsset(assetId)
    if (!asset) throw new Error('Asset not found')

    const result = await updateAssetDocument(workspaceId, assetId, changes, userId, memberIds)
    assetsByCategory.value = {
      ...assetsByCategory.value,
      [asset.category]: itemsForCategory(asset.category).map((candidate) =>
        candidate.id === assetId ? result.asset : candidate,
      ),
    }
    replaceCategory(asset.category, result.category)
  }

  async function deleteAsset(workspaceId, assetId, userId, memberIds) {
    const asset = findLoadedAsset(assetId)
    if (!asset) throw new Error('Asset not found')

    const result = await removeAssetDocument(workspaceId, assetId, userId, memberIds)
    assetsByCategory.value = {
      ...assetsByCategory.value,
      [result.categoryId]: itemsForCategory(result.categoryId).filter(
        (candidate) => candidate.id !== assetId,
      ),
    }
    replaceCategory(result.categoryId, result.category)
  }

  async function deleteCategory(workspaceId, categoryId, userId) {
    await removeAssetCategoryDocuments(workspaceId, categoryId, userId)

    const categories = { ...(summary.value?.categories || {}) }
    delete categories[categoryId]
    summary.value = { ...summary.value, categories }

    const nextAssetsByCategory = { ...assetsByCategory.value }
    delete nextAssetsByCategory[categoryId]
    assetsByCategory.value = nextAssetsByCategory
    const nextLoadedIds = new Set(loadedCategoryIds.value)
    nextLoadedIds.delete(categoryId)
    loadedCategoryIds.value = nextLoadedIds
  }

  function itemsForCategory(categoryId) {
    return assetsByCategory.value[categoryId] || []
  }

  function totalForCategory(categoryId, memberId = 'all') {
    return categoryEffectiveValue(summary.value?.categories?.[categoryId], memberId)
  }

  function total(memberId = 'all') {
    return totalCategories(summary.value, memberId)
  }

  function replaceCategory(categoryId, category) {
    summary.value = {
      ...(summary.value || {}),
      categories: {
        ...(summary.value?.categories || {}),
        [categoryId]: category,
      },
    }
  }

  function findLoadedAsset(assetId) {
    return Object.values(assetsByCategory.value)
      .flat()
      .find((asset) => asset.id === assetId)
  }

  function reset() {
    summaryRequestId += 1
    categoryRequestId += 1
    summary.value = null
    assetsByCategory.value = {}
    loading.value = false
    categoryLoading.value = false
    error.value = null
    loadedWorkspaceId.value = null
    loadedCategoryIds.value = new Set()
  }

  return {
    summary,
    assetsByCategory,
    loading,
    categoryLoading,
    error,
    loadedWorkspaceId,
    setupCompleted,
    enabledCategories,
    loadSummary,
    loadCategory,
    completeSetup,
    saveCategorySelection,
    updateSimpleCategoryValue,
    updateSimpleCategoryOwnership,
    addAsset,
    editAsset,
    deleteAsset,
    deleteCategory,
    itemsForCategory,
    totalForCategory,
    total,
    reset,
  }
})
