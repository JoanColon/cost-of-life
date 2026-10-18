import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { getCategoryExpenses, getExpensesConfig } = vi.hoisted(() => ({
  getCategoryExpenses: vi.fn(),
  getExpensesConfig: vi.fn(),
}))

vi.mock('@/services/firebase/expenses.service', () => ({
  createExpense: vi.fn(),
  deleteExpense: vi.fn(),
  deleteExpenseCategory: vi.fn(),
  getCategoryExpenses,
  getExpensesConfig,
  saveExpensesSetup: vi.fn(),
  updateExpense: vi.fn(),
  updateExpensesCategories: vi.fn(),
}))

import { useExpensesStore } from '../../src/stores/expenses-store'

describe('expenses store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    getCategoryExpenses.mockReset()
    getExpensesConfig.mockReset()
    getExpensesConfig.mockResolvedValue({
      schemaVersion: 1,
      setupCompleted: true,
      categories: {
        food: { enabled: true },
        housing: { enabled: true },
      },
    })
  })

  it('keeps every category when parallel requests finish out of order', async () => {
    const pending = new Map()
    getCategoryExpenses.mockImplementation(
      (_workspaceId, categoryId) =>
        new Promise((resolve) => {
          pending.set(categoryId, resolve)
        }),
    )
    const store = useExpensesStore()

    await store.loadConfig('workspace-a')
    const foodRequest = store.loadCategory('workspace-a', 'food')
    const housingRequest = store.loadCategory('workspace-a', 'housing')
    await vi.waitFor(() => expect(pending.size).toBe(2))

    pending.get('housing')([{ id: 'rent', categoryId: 'housing' }])
    await housingRequest
    pending.get('food')([{ id: 'groceries', categoryId: 'food' }])
    await foodRequest

    expect(store.itemsForCategory('food')).toEqual([{ id: 'groceries', categoryId: 'food' }])
    expect(store.itemsForCategory('housing')).toEqual([{ id: 'rent', categoryId: 'housing' }])
    expect(store.categoryLoading).toBe(false)
  })
})
