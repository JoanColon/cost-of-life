import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { createTrackedExpense, getExpenseTrackingMonth, getExpenseTrackingPreferences } = vi.hoisted(
  () => ({
    createTrackedExpense: vi.fn(),
    getExpenseTrackingMonth: vi.fn(),
    getExpenseTrackingPreferences: vi.fn(),
  }),
)

vi.mock('@/services/firebase/expense-tracking.service', () => ({
  createTrackedExpense,
  getExpenseTrackingMonth,
  getExpenseTrackingPreferences,
  removeTrackedExpense: vi.fn(),
  saveExpenseTrackingPreferences: vi.fn(),
  saveTrackingReconciliation: vi.fn(),
  saveTrackingReconciliations: vi.fn(),
  updateTrackedExpense: vi.fn(),
}))

import { useExpenseTrackingStore } from '../../src/stores/expense-tracking-store'

describe('expense tracking store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    getExpenseTrackingMonth.mockReset()
    getExpenseTrackingPreferences.mockReset()
    createTrackedExpense.mockReset()
    getExpenseTrackingMonth.mockImplementation(async (_, period) => ({ period, categories: {} }))
    getExpenseTrackingPreferences.mockResolvedValue({
      enabledSubcategories: ['groceries'],
    })
  })

  it('reuses workspace preferences while loading different months', async () => {
    const store = useExpenseTrackingStore()

    await store.load('workspace-a', '2026-09', true)
    await store.load('workspace-a', '2026-10', true)
    await store.load('workspace-a', '2026-11', true)

    expect(getExpenseTrackingMonth).toHaveBeenCalledTimes(3)
    expect(getExpenseTrackingPreferences).toHaveBeenCalledTimes(1)
  })

  it('reloads preferences after the expense model is invalidated', async () => {
    const store = useExpenseTrackingStore()

    await store.load('workspace-a', '2026-09', true)
    store.invalidatePreferences('workspace-a')
    await store.load('workspace-a', '2026-10', true)

    expect(getExpenseTrackingPreferences).toHaveBeenCalledTimes(2)
  })

  it('ignores a completed mutation after the user has moved to another month', async () => {
    const store = useExpenseTrackingStore()
    let resolveMutation
    createTrackedExpense.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMutation = resolve
        }),
    )

    await store.load('workspace-a', '2026-09', true)
    const mutation = store.add('workspace-a', '2026-09', 'groceries', {}, [])
    await store.load('workspace-a', '2026-10', true)
    resolveMutation({ period: '2026-09', categories: { groceries: { items: [{}] } } })
    await mutation

    expect(store.month.period).toBe('2026-10')
  })
})
