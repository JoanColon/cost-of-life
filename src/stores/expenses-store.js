import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { expenseCategoryIds } from '@/config/expense-categories'
import {
  createExpense as createExpenseDocument,
  getCategoryExpenses,
  getExpensesSummary,
  removeExpense as removeExpenseDocument,
  removeExpenseCategory as removeExpenseCategoryDocuments,
  saveExpensesSetup,
  updateExpense as updateExpenseDocument,
  updateExpensesCategories,
  updateSimpleExpenseEstimate as updateSimpleExpenseEstimateDocument,
  updateSimpleExpenseOwnership as updateSimpleExpenseOwnershipDocument,
} from '@/services/firebase/expenses.service'
import { categoryEffectiveValue, isItemizedCategory } from '@/domain/financial/category-summary'
import { buildExpenseSummaryCategories, costOfLifeTotals } from '@/domain/financial/expense-summary'

export const useExpensesStore = defineStore('expenses', () => {
  const summary = ref(null)
  const expensesByCategory = ref({})
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
    expensesByCategory.value = {}
    loadedCategoryIds.value = new Set()
    const requestId = ++summaryRequestId
    try {
      const state = await getExpensesSummary(workspaceId)
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
      expensesByCategory.value = { ...expensesByCategory.value, [categoryId]: [] }
      loadedCategoryIds.value = new Set(loadedCategoryIds.value).add(categoryId)
      return
    }

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

  async function completeSetup(workspaceId, selectedCategoryIds, userId, memberIds) {
    const categories = buildExpenseSummaryCategories(
      expenseCategoryIds,
      selectedCategoryIds,
      {},
      memberIds,
    )
    await saveExpensesSetup(workspaceId, categories, userId)
    summary.value = { setupCompleted: true, categories }
    loadedWorkspaceId.value = workspaceId
  }

  async function saveCategorySelection(workspaceId, selectedCategoryIds, userId, memberIds) {
    const categories = buildExpenseSummaryCategories(
      expenseCategoryIds,
      selectedCategoryIds,
      summary.value?.categories || {},
      memberIds,
    )
    await updateExpensesCategories(workspaceId, categories, userId)
    summary.value = { ...(summary.value || {}), setupCompleted: true, categories }
  }

  async function updateSimpleCategoryEstimate(workspaceId, categoryId, estimate, userId) {
    replaceCategory(
      categoryId,
      await updateSimpleExpenseEstimateDocument(workspaceId, categoryId, estimate, userId),
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
      await updateSimpleExpenseOwnershipDocument(
        workspaceId,
        categoryId,
        ownership,
        userId,
        memberIds,
      ),
    )
  }

  async function addExpense(workspaceId, expense, userId, memberIds) {
    const result = await createExpenseDocument(workspaceId, expense, userId, memberIds)
    expensesByCategory.value = {
      ...expensesByCategory.value,
      [expense.category]: [...itemsForCategory(expense.category), result.expense],
    }
    loadedCategoryIds.value = new Set(loadedCategoryIds.value).add(expense.category)
    replaceCategory(expense.category, result.category)
    return result.expense
  }

  async function editExpense(workspaceId, expenseId, changes, userId, memberIds) {
    const expense = findLoadedExpense(expenseId)
    if (!expense) throw new Error('Expense not found')
    const result = await updateExpenseDocument(workspaceId, expenseId, changes, userId, memberIds)
    expensesByCategory.value = {
      ...expensesByCategory.value,
      [expense.category]: itemsForCategory(expense.category).map((candidate) =>
        candidate.id === expenseId ? result.expense : candidate,
      ),
    }
    replaceCategory(expense.category, result.category)
  }

  async function deleteExpense(workspaceId, expenseId, userId, memberIds) {
    if (!findLoadedExpense(expenseId)) throw new Error('Expense not found')
    const result = await removeExpenseDocument(workspaceId, expenseId, userId, memberIds)
    expensesByCategory.value = {
      ...expensesByCategory.value,
      [result.categoryId]: itemsForCategory(result.categoryId).filter(
        (candidate) => candidate.id !== expenseId,
      ),
    }
    replaceCategory(result.categoryId, result.category)
  }

  async function deleteCategory(workspaceId, categoryId, userId) {
    await removeExpenseCategoryDocuments(workspaceId, categoryId, userId)
    const categories = { ...(summary.value?.categories || {}) }
    delete categories[categoryId]
    summary.value = { ...summary.value, categories }
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

  function totalForCategory(categoryId, memberId = 'all') {
    return categoryEffectiveValue(summary.value?.categories?.[categoryId], memberId)
  }

  function totals(memberId = 'all') {
    return costOfLifeTotals(summary.value, memberId)
  }

  function replaceCategory(categoryId, category) {
    summary.value = {
      ...(summary.value || {}),
      categories: { ...(summary.value?.categories || {}), [categoryId]: category },
    }
  }

  function findLoadedExpense(expenseId) {
    return Object.values(expensesByCategory.value)
      .flat()
      .find((expense) => expense.id === expenseId)
  }

  function reset() {
    summaryRequestId += 1
    categoryRequestId += 1
    summary.value = null
    expensesByCategory.value = {}
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
    updateSimpleCategoryEstimate,
    updateSimpleCategoryOwnership,
    addExpense,
    editExpense,
    deleteExpense,
    deleteCategory,
    itemsForCategory,
    totalForCategory,
    totals,
    reset,
  }
})
