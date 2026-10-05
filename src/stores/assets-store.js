import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  createAsset as createAssetDocument,
  getAssetsState,
  removeAsset as removeAssetDocument,
  saveAssetsSetup,
  updateAsset as updateAssetDocument,
  updateAssetCategory,
  updateAssetsCategories,
} from '@/services/firebase/assets.service'
import {
  categoryAssets,
  categoryTotal,
  normalizeMoney,
  totalAssets,
} from '@/utils/asset-calculations'

export const useAssetsStore = defineStore('assets', () => {
  const config = ref(null)
  const assets = ref([])
  const loading = ref(false)
  const error = ref(null)
  const loadedWorkspaceId = ref(null)
  let loadRequestId = 0

  const setupCompleted = computed(() => Boolean(config.value?.setupCompleted))
  const enabledCategories = computed(() =>
    Object.entries(config.value?.categories || {})
      .filter(([, category]) => category.enabled)
      .map(([categoryId]) => categoryId),
  )

  async function load(workspaceId, force = false) {
    if (!workspaceId || (!force && loadedWorkspaceId.value === workspaceId)) return

    loading.value = true
    error.value = null
    config.value = null
    assets.value = []
    const requestId = ++loadRequestId

    try {
      const state = await getAssetsState(workspaceId)
      if (requestId !== loadRequestId) return
      config.value = state.config
      assets.value = state.assets
      loadedWorkspaceId.value = workspaceId
    } catch (loadError) {
      if (requestId !== loadRequestId) return
      error.value = loadError
      loadedWorkspaceId.value = workspaceId
    } finally {
      if (requestId === loadRequestId) loading.value = false
    }
  }

  async function completeSetup(workspaceId, categories, userId) {
    await saveAssetsSetup(workspaceId, categories, userId)
    config.value = { setupCompleted: true, categories }
    loadedWorkspaceId.value = workspaceId
  }

  async function saveCategories(workspaceId, categories, userId) {
    await updateAssetsCategories(workspaceId, categories, userId)
    config.value = { ...(config.value || {}), setupCompleted: true, categories }
  }

  async function saveCategory(workspaceId, categoryId, category, userId) {
    await updateAssetCategory(workspaceId, categoryId, category, userId)
    config.value = {
      ...(config.value || {}),
      categories: {
        ...(config.value?.categories || {}),
        [categoryId]: category,
      },
    }
  }

  async function updateSimpleCategoryValue(workspaceId, categoryId, value, userId) {
    const category = config.value?.categories?.[categoryId]
    const manualValue = normalizeMoney(value)

    if (!category || category.mode !== 'simple' || manualValue === null) {
      throw new Error('A simple asset category and a non-negative numeric value are required')
    }

    const updatedCategory = { ...category, manualValue }
    const previousCategory = category

    // Update totals immediately. Firestore remains the source of truth and the
    // previous category is restored if persistence fails.
    config.value = {
      ...config.value,
      categories: {
        ...config.value.categories,
        [categoryId]: updatedCategory,
      },
    }

    try {
      await updateAssetCategory(workspaceId, categoryId, updatedCategory, userId)
    } catch (error) {
      config.value = {
        ...config.value,
        categories: {
          ...config.value.categories,
          [categoryId]: previousCategory,
        },
      }
      throw error
    }
  }

  async function addAsset(workspaceId, asset, userId) {
    const createdAsset = await createAssetDocument(workspaceId, asset, userId)
    assets.value.push(createdAsset)
    return createdAsset
  }

  async function editAsset(workspaceId, assetId, changes, userId) {
    await updateAssetDocument(workspaceId, assetId, changes, userId)
    const index = assets.value.findIndex((asset) => asset.id === assetId)
    if (index >= 0) assets.value[index] = { ...assets.value[index], ...changes, updatedBy: userId }
  }

  async function deleteAsset(workspaceId, assetId) {
    await removeAssetDocument(workspaceId, assetId)
    assets.value = assets.value.filter((asset) => asset.id !== assetId)
  }

  function itemsForCategory(categoryId) {
    return categoryAssets(assets.value, categoryId)
  }

  function totalForCategory(categoryId, memberId = 'all') {
    return categoryTotal(categoryId, config.value, assets.value, memberId)
  }

  function total(memberId = 'all') {
    return totalAssets(config.value, assets.value, memberId)
  }

  function reset() {
    loadRequestId += 1
    config.value = null
    assets.value = []
    loading.value = false
    error.value = null
    loadedWorkspaceId.value = null
  }

  return {
    config,
    assets,
    loading,
    error,
    loadedWorkspaceId,
    setupCompleted,
    enabledCategories,
    load,
    completeSetup,
    saveCategories,
    saveCategory,
    updateSimpleCategoryValue,
    addAsset,
    editAsset,
    deleteAsset,
    itemsForCategory,
    totalForCategory,
    total,
    reset,
  }
})
