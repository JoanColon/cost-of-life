import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { expenseCategoryIds } from '@/config/expense-categories'
import {
  createExpense as createExpenseDocument,
  getCategoryExpenses,
  getExpensesConfig,
  deleteExpense as deleteExpenseDocument,
  deleteExpenseCategory as deleteExpenseCategoryDocuments,
  saveExpensesSetup,
  updateExpense as updateExpenseDocument,
  updateExpensesCategories,
  updateSimpleExpenseEstimate as updateSimpleExpenseEstimateDocument,
  updateSimpleExpenseOwnership as updateSimpleExpenseOwnershipDocument,
} from '@/services/firebase/expenses.service'
import { buildExpenseModelCategories } from '@/domain/financial/expense-model-categories'

export const useExpensesStore = defineStore('expenses', () => {
  const config = ref(null)
  const expensesByCategory = ref({})
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
    expensesByCategory.value = {}
    loadedCategoryIds.value = new Set()
    categoryRequestId += 1
    const requestId = ++configRequestId
    try {
      const state = await getExpensesConfig(workspaceId)
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
      const items = await getCategoryExpenses(workspaceId, categoryId)
      if (requestId !== categoryRequestId) return
      expensesByCategory.value = { ...expensesByCategory.value, [categoryId]: items }
      loadedCategoryIds.value = new Set(loadedCategoryIds.value).add(categoryId)
    } catch (loadError) {
      if (requestId !== categoryRequestId) return
      error.value = loadError
    } finally {
      if (requestId === categoryRequestId) categoryLoading.value = false
    }
  }

  async function completeSetup(workspaceId, selectedCategoryIds, memberIds) {
    const categories = buildExpenseModelCategories(
      expenseCategoryIds,
      selectedCategoryIds,
      {},
      memberIds,
    )
    await saveExpensesSetup(workspaceId, categories)
    config.value = { setupCompleted: true, categories }
    loadedWorkspaceId.value = workspaceId
  }

  async function saveCategorySelection(workspaceId, selectedCategoryIds, memberIds) {
    const categories = buildExpenseModelCategories(
      expenseCategoryIds,
      selectedCategoryIds,
      config.value?.categories || {},
      memberIds,
    )
    await updateExpensesCategories(workspaceId, categories)
    config.value = { ...(config.value || {}), setupCompleted: true, categories }
  }

  async function updateSimpleCategoryEstimate(workspaceId, categoryId, estimate) {
    replaceCategory(
      categoryId,
      await updateSimpleExpenseEstimateDocument(workspaceId, categoryId, estimate),
    )
  }

  async function updateSimpleCategoryOwnership(workspaceId, categoryId, ownership, memberIds) {
    replaceCategory(
      categoryId,
      await updateSimpleExpenseOwnershipDocument(workspaceId, categoryId, ownership, memberIds),
    )
  }

  async function addExpense(workspaceId, expense, memberIds) {
    const result = await createExpenseDocument(workspaceId, expense, memberIds)
    expensesByCategory.value = {
      ...expensesByCategory.value,
      [expense.category]: [...itemsForCategory(expense.category), result.expense],
    }
    loadedCategoryIds.value = new Set(loadedCategoryIds.value).add(expense.category)
    return result.expense
  }

  async function editExpense(workspaceId, expenseId, changes, memberIds) {
    const expense = findLoadedExpense(expenseId)
    if (!expense) throw new Error('Expense not found')
    const result = await updateExpenseDocument(workspaceId, expenseId, changes, memberIds)
    expensesByCategory.value = {
      ...expensesByCategory.value,
      [expense.category]: itemsForCategory(expense.category).map((candidate) =>
        candidate.id === expenseId ? result.expense : candidate,
      ),
    }
  }

  async function deleteExpense(workspaceId, expenseId) {
    if (!findLoadedExpense(expenseId)) throw new Error('Expense not found')
    const result = await deleteExpenseDocument(workspaceId, expenseId)
    expensesByCategory.value = {
      ...expensesByCategory.value,
      [result.categoryId]: itemsForCategory(result.categoryId).filter(
        (candidate) => candidate.id !== expenseId,
      ),
    }
  }

  async function deleteCategory(workspaceId, categoryId) {
    await deleteExpenseCategoryDocuments(workspaceId, categoryId)
    const categories = { ...(config.value?.categories || {}) }
    delete categories[categoryId]
    config.value = { ...config.value, categories }
    const nextItems = { ...expensesByCategory.value }
    delete nextItems[categoryId]
    expensesByCategory.value = nextItems
    const nextLoadedIds = new Set(loadedCategoryIds.value)
    nextLoadedIds.delete(categoryId)
    loadedCategoryIds.value = nextLoadedIds
  }

  function itemsForCategory(categoryId) {
    return expensesByCategory.value[categoryId] || []
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

  function findLoadedExpense(expenseId) {
    return Object.values(expensesByCategory.value)
      .flat()
      .find((expense) => expense.id === expenseId)
  }

  function reset() {
    configRequestId += 1
    categoryRequestId += 1
    config.value = null
    expensesByCategory.value = {}
    loadedCategoryIds.value = new Set()
    loading.value = false
    categoryLoading.value = false
    error.value = null
    loadedWorkspaceId.value = null
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
    updateSimpleCategoryEstimate,
    updateSimpleCategoryOwnership,
    addExpense,
    editExpense,
    deleteExpense,
    deleteCategory,
    itemsForCategory,
    reset,
  }
})
