import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { getFinancialYear, subscribeFinancialYear } = vi.hoisted(() => ({
  getFinancialYear: vi.fn(),
  subscribeFinancialYear: vi.fn(),
}))

vi.mock('@/services/firebase/financial-years.service', () => ({
  getFinancialYear,
  subscribeFinancialYear,
}))

import { currentFinancialYear } from '../../src/domain/financial/financial-year'
import { useFinancialYearsStore } from '../../src/stores/financial-years-store'

describe('financial years store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    getFinancialYear.mockReset()
    subscribeFinancialYear.mockReset()
    getFinancialYear.mockResolvedValue({ id: String(currentFinancialYear()), totals: {} })
    subscribeFinancialYear.mockImplementation(() => vi.fn())
  })

  it('reactivates the current-year listener when a cached workspace is reopened', async () => {
    const store = useFinancialYearsStore()
    const year = currentFinancialYear()

    await store.load('workspace-a', year)
    store.stopWatching()
    await store.load('workspace-a', year)

    expect(getFinancialYear).toHaveBeenCalledTimes(1)
    expect(subscribeFinancialYear).toHaveBeenCalledTimes(2)
  })

  it('moves the listener when returning to another cached workspace', async () => {
    const store = useFinancialYearsStore()
    const year = currentFinancialYear()

    await store.load('workspace-a', year)
    await store.load('workspace-b', year)
    await store.load('workspace-a', year)

    expect(getFinancialYear).toHaveBeenCalledTimes(2)
    expect(subscribeFinancialYear).toHaveBeenCalledTimes(3)
  })

  it('subscribes to a selected historical year so trigger updates reach the cache', async () => {
    const store = useFinancialYearsStore()

    await store.load('workspace-a', 2025)

    expect(subscribeFinancialYear).toHaveBeenCalledWith(
      'workspace-a',
      2025,
      expect.any(Function),
      expect.any(Function),
    )
  })

  it('keeps load errors scoped to their workspace and year', async () => {
    const store = useFinancialYearsStore()
    const failure = new Error('unavailable')
    getFinancialYear.mockRejectedValueOnce(failure)

    await expect(store.load('workspace-a', 2025)).rejects.toThrow('unavailable')

    expect(store.errorFor('workspace-a', 2025)).toBe(failure)
    expect(store.errorFor('workspace-b', 2025)).toBeNull()
  })
})
