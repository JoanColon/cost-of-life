import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { assetCategoryIds } from '@/config/asset-categories'
import {
  createAsset as createAssetDocument,
  getAssetsConfig,
  getCategoryAssets,
  deleteAsset as deleteAssetDocument,
  deleteAssetCategory as deleteAssetCategoryDocuments,
  saveAssetsSetup,
  updateAsset as updateAssetDocument,
  updateAssetsCategories,
  updateSimpleCategoryOwnership as updateSimpleCategoryOwnershipDocument,
  updateSimpleCategoryValue as updateSimpleCategoryValueDocument,
} from '@/services/firebase/assets.service'
import { buildModelCategories } from '@/domain/financial/model-categories'
import {
  disconnectInvestmentPortfolio as disconnectInvestmentPortfolioDocument,
  saveInvestmentPortfolio as saveInvestmentPortfolioDocument,
} from '@/services/firebase/investment-portfolios.service'

export const useAssetsStore = defineStore('assets', () => {
  const config = ref(null)
  const assetsByCategory = ref({})
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
    assetsByCategory.value = {}
    loadedCategoryIds.value = new Set()
    categoryRequestId += 1
    const requestId = ++configRequestId

    try {
      const state = await getAssetsConfig(workspaceId)
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

  async function completeSetup(workspaceId, selectedCategoryIds, memberIds) {
    const categories = buildModelCategories(assetCategoryIds, selectedCategoryIds, {}, memberIds)
    await saveAssetsSetup(workspaceId, categories)
    config.value = { setupCompleted: true, categories }
    loadedWorkspaceId.value = workspaceId
  }

  async function saveCategorySelection(workspaceId, selectedCategoryIds, memberIds) {
    const categories = buildModelCategories(
      assetCategoryIds,
      selectedCategoryIds,
      config.value?.categories || {},
      memberIds,
    )
    await updateAssetsCategories(workspaceId, categories)
    config.value = { ...(config.value || {}), setupCompleted: true, categories }
  }

  async function updateSimpleCategoryValue(workspaceId, categoryId, value) {
    const category = await updateSimpleCategoryValueDocument(workspaceId, categoryId, value)
    replaceCategory(categoryId, category)
  }

  async function updateSimpleCategoryOwnership(workspaceId, categoryId, ownership, memberIds) {
    const category = await updateSimpleCategoryOwnershipDocument(
      workspaceId,
      categoryId,
      ownership,
      memberIds,
    )
    replaceCategory(categoryId, category)
  }

  async function addAsset(workspaceId, asset, memberIds) {
    const result = await createAssetDocument(workspaceId, asset, memberIds)
    const categoryAssets = itemsForCategory(asset.categoryId)
    assetsByCategory.value = {
      ...assetsByCategory.value,
      [asset.categoryId]: [...categoryAssets, result.asset],
    }
    loadedCategoryIds.value = new Set(loadedCategoryIds.value).add(asset.categoryId)
    return result.asset
  }

  async function editAsset(workspaceId, assetId, changes, memberIds) {
    const asset = findLoadedAsset(assetId)
    if (!asset) throw new Error('Asset not found')

    const result = await updateAssetDocument(workspaceId, assetId, changes, memberIds)
    assetsByCategory.value = {
      ...assetsByCategory.value,
      [asset.categoryId]: itemsForCategory(asset.categoryId).map((candidate) =>
        candidate.id === assetId ? result.asset : candidate,
      ),
    }
  }

  async function deleteAsset(workspaceId, assetId) {
    const asset = findLoadedAsset(assetId)
    if (!asset) throw new Error('Asset not found')

    const result = await deleteAssetDocument(workspaceId, assetId)
    assetsByCategory.value = {
      ...assetsByCategory.value,
      [result.categoryId]: itemsForCategory(result.categoryId).filter(
        (candidate) => candidate.id !== assetId,
      ),
    }
  }

  async function saveInvestmentPortfolio(workspaceId, assetId, spreadsheetUrl) {
    const asset = findLoadedAsset(assetId)
    if (!asset || asset.categoryId !== 'investment') throw new Error('Investment not found')

    const result = await saveInvestmentPortfolioDocument(workspaceId, assetId, spreadsheetUrl)
    replaceAsset(assetId, {
      ...asset,
      detail: { ...(asset.detail || {}), portfolio: result.portfolio },
    })
  }

  async function disconnectInvestmentPortfolio(workspaceId, assetId) {
    const asset = findLoadedAsset(assetId)
    if (!asset || asset.categoryId !== 'investment') throw new Error('Investment not found')

    await disconnectInvestmentPortfolioDocument(workspaceId, assetId)
    const detail = { ...(asset.detail || {}) }
    delete detail.portfolio
    replaceAsset(assetId, { ...asset, detail })
  }

  async function deleteCategory(workspaceId, categoryId) {
    await deleteAssetCategoryDocuments(workspaceId, categoryId)

    const categories = { ...(config.value?.categories || {}) }
    delete categories[categoryId]
    config.value = { ...config.value, categories }

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

  function replaceCategory(categoryId, category) {
    config.value = {
      ...(config.value || {}),
      categories: {
        ...(config.value?.categories || {}),
        [categoryId]: { ...(config.value?.categories?.[categoryId] || {}), ...category },
      },
    }
  }

  function findLoadedAsset(assetId) {
    return Object.values(assetsByCategory.value)
      .flat()
      .find((asset) => asset.id === assetId)
  }

  function replaceAsset(assetId, nextAsset) {
    assetsByCategory.value = Object.fromEntries(
      Object.entries(assetsByCategory.value).map(([categoryId, assets]) => [
        categoryId,
        assets.map((asset) => (asset.id === assetId ? nextAsset : asset)),
      ]),
    )
  }

  function reset() {
    configRequestId += 1
    categoryRequestId += 1
    config.value = null
    assetsByCategory.value = {}
    loading.value = false
    categoryLoading.value = false
    error.value = null
    loadedWorkspaceId.value = null
    loadedCategoryIds.value = new Set()
  }

  return {
    config,
    assetsByCategory,
    loading,
    categoryLoading,
    error,
    loadedWorkspaceId,
    setupCompleted,
    enabledCategories,
    loadConfig,
    loadCategory,
    completeSetup,
    saveCategorySelection,
    updateSimpleCategoryValue,
    updateSimpleCategoryOwnership,
    addAsset,
    editAsset,
    deleteAsset,
    saveInvestmentPortfolio,
    disconnectInvestmentPortfolio,
    deleteCategory,
    itemsForCategory,
    reset,
  }
})
