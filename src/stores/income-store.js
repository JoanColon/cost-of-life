import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { incomeCategoryIds } from '@/config/income-categories'
import {
  createIncome as createIncomeDocument,
  getCategoryIncome,
  getIncomeSummary,
  removeIncome as removeIncomeDocument,
  removeIncomeCategory as removeIncomeCategoryDocuments,
  saveIncomeSetup,
  updateIncome as updateIncomeDocument,
  updateIncomeCategories,
  updateSimpleIncomeOwnership as updateSimpleIncomeOwnershipDocument,
  updateSimpleIncomeValue as updateSimpleIncomeValueDocument,
} from '@/services/firebase/income.service'
import {
  buildSummaryCategories,
  categoryEffectiveValue,
  isItemizedCategory,
  totalCategories,
} from '@/domain/financial/category-summary'

export const useIncomeStore = defineStore('income', () => {
  const summary = ref(null)
  const incomeByCategory = ref({})
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
    incomeByCategory.value = {}
    loadedCategoryIds.value = new Set()
    const requestId = ++summaryRequestId
    try {
      const state = await getIncomeSummary(workspaceId)
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
      incomeByCategory.value = { ...incomeByCategory.value, [categoryId]: [] }
      loadedCategoryIds.value = new Set(loadedCategoryIds.value).add(categoryId)
      return
    }

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

  async function completeSetup(workspaceId, selectedCategoryIds, userId, memberIds) {
    const categories = buildSummaryCategories(incomeCategoryIds, selectedCategoryIds, {}, memberIds)
    await saveIncomeSetup(workspaceId, categories, userId)
    summary.value = { setupCompleted: true, categories }
    loadedWorkspaceId.value = workspaceId
  }

  async function saveCategorySelection(workspaceId, selectedCategoryIds, userId, memberIds) {
    const categories = buildSummaryCategories(
      incomeCategoryIds,
      selectedCategoryIds,
      summary.value?.categories || {},
      memberIds,
    )
    await updateIncomeCategories(workspaceId, categories, userId)
    summary.value = { ...(summary.value || {}), setupCompleted: true, categories }
  }

  async function updateSimpleCategoryValue(workspaceId, categoryId, value, userId) {
    replaceCategory(
      categoryId,
      await updateSimpleIncomeValueDocument(workspaceId, categoryId, value, userId),
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
      await updateSimpleIncomeOwnershipDocument(
        workspaceId,
        categoryId,
        ownership,
        userId,
        memberIds,
      ),
    )
  }

  async function addIncome(workspaceId, income, userId, memberIds) {
    const result = await createIncomeDocument(workspaceId, income, userId, memberIds)
    incomeByCategory.value = {
      ...incomeByCategory.value,
      [income.category]: [...itemsForCategory(income.category), result.income],
    }
    loadedCategoryIds.value = new Set(loadedCategoryIds.value).add(income.category)
    replaceCategory(income.category, result.category)
    return result.income
  }

  async function editIncome(workspaceId, incomeId, changes, userId, memberIds) {
    const income = findLoadedIncome(incomeId)
    if (!income) throw new Error('Income source not found')
    const result = await updateIncomeDocument(workspaceId, incomeId, changes, userId, memberIds)
    incomeByCategory.value = {
      ...incomeByCategory.value,
      [income.category]: itemsForCategory(income.category).map((candidate) =>
        candidate.id === incomeId ? result.income : candidate,
      ),
    }
    replaceCategory(income.category, result.category)
  }

  async function deleteIncome(workspaceId, incomeId, userId, memberIds) {
    if (!findLoadedIncome(incomeId)) throw new Error('Income source not found')
    const result = await removeIncomeDocument(workspaceId, incomeId, userId, memberIds)
    incomeByCategory.value = {
      ...incomeByCategory.value,
      [result.categoryId]: itemsForCategory(result.categoryId).filter(
        (candidate) => candidate.id !== incomeId,
      ),
    }
    replaceCategory(result.categoryId, result.category)
  }

  async function deleteCategory(workspaceId, categoryId, userId) {
    await removeIncomeCategoryDocuments(workspaceId, categoryId, userId)
    const categories = { ...(summary.value?.categories || {}) }
    delete categories[categoryId]
    summary.value = { ...summary.value, categories }
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

  function totalForCategory(categoryId, memberId = 'all') {
    return categoryEffectiveValue(summary.value?.categories?.[categoryId], memberId)
  }

  function total(memberId = 'all') {
    return totalCategories(summary.value, memberId)
  }

  const totalEmploymentIncome = (memberId = 'all') => totalForCategory('employment', memberId)
  const totalBusinessIncome = (memberId = 'all') => totalForCategory('business', memberId)
  const totalRentalIncome = (memberId = 'all') => totalForCategory('rental', memberId)
  const totalInvestmentIncome = (memberId = 'all') => totalForCategory('investments', memberId)
  const totalPensionsBenefitsIncome = (memberId = 'all') =>
    totalForCategory('pensions_benefits', memberId)
  const totalOtherIncome = (memberId = 'all') => totalForCategory('other', memberId)

  function replaceCategory(categoryId, category) {
    summary.value = {
      ...(summary.value || {}),
      categories: { ...(summary.value?.categories || {}), [categoryId]: category },
    }
  }

  function findLoadedIncome(incomeId) {
    return Object.values(incomeByCategory.value)
      .flat()
      .find((income) => income.id === incomeId)
  }

  function reset() {
    summaryRequestId += 1
    categoryRequestId += 1
    summary.value = null
    incomeByCategory.value = {}
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
    addIncome,
    editIncome,
    deleteIncome,
    deleteCategory,
    itemsForCategory,
    totalForCategory,
    total,
    totalEmploymentIncome,
    totalBusinessIncome,
    totalRentalIncome,
    totalInvestmentIncome,
    totalPensionsBenefitsIncome,
    totalOtherIncome,
    reset,
  }
})
