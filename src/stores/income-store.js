import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { incomeCategoryIds } from '@/config/income-categories'
import {
  createIncome as createIncomeDocument,
  getCategoryIncome,
  getIncomeConfig,
  deleteIncome as deleteIncomeDocument,
  deleteIncomeCategory as deleteIncomeCategoryDocuments,
  saveIncomeSetup,
  updateIncome as updateIncomeDocument,
  updateIncomeCategories,
  updateSimpleIncomeOwnership as updateSimpleIncomeOwnershipDocument,
  updateSimpleIncomeValue as updateSimpleIncomeValueDocument,
} from '@/services/firebase/income.service'
import { buildModelCategories } from '@/domain/financial/model-categories'

export const useIncomeStore = defineStore('income', () => {
  const config = ref(null)
  const incomeByCategory = ref({})
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
    incomeByCategory.value = {}
    loadedCategoryIds.value = new Set()
    categoryRequestId += 1
    const requestId = ++configRequestId
    try {
      const state = await getIncomeConfig(workspaceId)
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
      const items = await getCategoryIncome(workspaceId, categoryId)
      if (requestId !== categoryRequestId) return
      incomeByCategory.value = { ...incomeByCategory.value, [categoryId]: items }
      loadedCategoryIds.value = new Set(loadedCategoryIds.value).add(categoryId)
    } catch (loadError) {
      if (requestId !== categoryRequestId) return
      error.value = loadError
    } finally {
      if (requestId === categoryRequestId) categoryLoading.value = false
    }
  }

  async function completeSetup(workspaceId, selectedCategoryIds, memberIds) {
    const categories = buildModelCategories(incomeCategoryIds, selectedCategoryIds, {}, memberIds)
    await saveIncomeSetup(workspaceId, categories)
    config.value = { setupCompleted: true, categories }
    loadedWorkspaceId.value = workspaceId
  }

  async function saveCategorySelection(workspaceId, selectedCategoryIds, memberIds) {
    const categories = buildModelCategories(
      incomeCategoryIds,
      selectedCategoryIds,
      config.value?.categories || {},
      memberIds,
    )
    await updateIncomeCategories(workspaceId, categories)
    config.value = { ...(config.value || {}), setupCompleted: true, categories }
  }

  async function updateSimpleCategoryValue(workspaceId, categoryId, value) {
    replaceCategory(
      categoryId,
      await updateSimpleIncomeValueDocument(workspaceId, categoryId, value),
    )
  }

  async function updateSimpleCategoryOwnership(workspaceId, categoryId, ownership, memberIds) {
    replaceCategory(
      categoryId,
      await updateSimpleIncomeOwnershipDocument(workspaceId, categoryId, ownership, memberIds),
    )
  }

  async function addIncome(workspaceId, income, memberIds) {
    const result = await createIncomeDocument(workspaceId, income, memberIds)
    incomeByCategory.value = {
      ...incomeByCategory.value,
      [income.category]: [...itemsForCategory(income.category), result.income],
    }
    loadedCategoryIds.value = new Set(loadedCategoryIds.value).add(income.category)
    return result.income
  }

  async function editIncome(workspaceId, incomeId, changes, memberIds) {
    const income = findLoadedIncome(incomeId)
    if (!income) throw new Error('Income source not found')
    const result = await updateIncomeDocument(workspaceId, incomeId, changes, memberIds)
    incomeByCategory.value = {
      ...incomeByCategory.value,
      [income.category]: itemsForCategory(income.category).map((candidate) =>
        candidate.id === incomeId ? result.income : candidate,
      ),
    }
  }

  async function deleteIncome(workspaceId, incomeId) {
    if (!findLoadedIncome(incomeId)) throw new Error('Income source not found')
    const result = await deleteIncomeDocument(workspaceId, incomeId)
    incomeByCategory.value = {
      ...incomeByCategory.value,
      [result.categoryId]: itemsForCategory(result.categoryId).filter(
        (candidate) => candidate.id !== incomeId,
      ),
    }
  }

  async function deleteCategory(workspaceId, categoryId) {
    await deleteIncomeCategoryDocuments(workspaceId, categoryId)
    const categories = { ...(config.value?.categories || {}) }
    delete categories[categoryId]
    config.value = { ...config.value, categories }
    const nextItems = { ...incomeByCategory.value }
    delete nextItems[categoryId]
    incomeByCategory.value = nextItems
    const nextLoadedIds = new Set(loadedCategoryIds.value)
    nextLoadedIds.delete(categoryId)
    loadedCategoryIds.value = nextLoadedIds
  }

  function itemsForCategory(categoryId) {
    return incomeByCategory.value[categoryId] || []
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

  function findLoadedIncome(incomeId) {
    return Object.values(incomeByCategory.value)
      .flat()
      .find((income) => income.id === incomeId)
  }

  function reset() {
    configRequestId += 1
    categoryRequestId += 1
    config.value = null
    incomeByCategory.value = {}
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
    addIncome,
    editIncome,
    deleteIncome,
    deleteCategory,
    itemsForCategory,
    reset,
  }
})
