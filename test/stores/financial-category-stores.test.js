import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const mocks = vi.hoisted(() => ({
  getAssetsConfig: vi.fn(),
  getCategoryAssets: vi.fn(),
  getLiabilitiesConfig: vi.fn(),
  getCategoryLiabilities: vi.fn(),
  getIncomeConfig: vi.fn(),
  getCategoryIncome: vi.fn(),
}))

vi.mock('@/services/firebase/assets.service', () => ({
  createAsset: vi.fn(),
  deleteAsset: vi.fn(),
  deleteAssetCategory: vi.fn(),
  getAssetsConfig: mocks.getAssetsConfig,
  getCategoryAssets: mocks.getCategoryAssets,
  saveAssetsSetup: vi.fn(),
  updateAsset: vi.fn(),
  updateAssetsCategories: vi.fn(),
  updateSimpleCategoryOwnership: vi.fn(),
  updateSimpleCategoryValue: vi.fn(),
}))

vi.mock('@/services/firebase/liabilities.service', () => ({
  createLiability: vi.fn(),
  deleteLiability: vi.fn(),
  deleteLiabilityCategory: vi.fn(),
  getCategoryLiabilities: mocks.getCategoryLiabilities,
  getLiabilitiesConfig: mocks.getLiabilitiesConfig,
  saveLiabilitiesSetup: vi.fn(),
  updateLiability: vi.fn(),
  updateLiabilityCategories: vi.fn(),
  updateSimpleLiabilityOwnership: vi.fn(),
  updateSimpleLiabilityValue: vi.fn(),
}))

vi.mock('@/services/firebase/income.service', () => ({
  createIncome: vi.fn(),
  deleteIncome: vi.fn(),
  deleteIncomeCategory: vi.fn(),
  getCategoryIncome: mocks.getCategoryIncome,
  getIncomeConfig: mocks.getIncomeConfig,
  saveIncomeSetup: vi.fn(),
  updateIncome: vi.fn(),
  updateIncomeCategories: vi.fn(),
}))

vi.mock('@/services/firebase/investment-portfolios.service', () => ({
  disconnectInvestmentPortfolio: vi.fn(),
  saveInvestmentPortfolio: vi.fn(),
}))

import { useAssetsStore } from '../../src/stores/assets-store'
import { useIncomeStore } from '../../src/stores/income-store'
import { useLiabilitiesStore } from '../../src/stores/liabilities-store'

const storeCases = [
  {
    name: 'assets',
    useStore: useAssetsStore,
    getConfig: mocks.getAssetsConfig,
    getCategory: mocks.getCategoryAssets,
  },
  {
    name: 'liabilities',
    useStore: useLiabilitiesStore,
    getConfig: mocks.getLiabilitiesConfig,
    getCategory: mocks.getCategoryLiabilities,
  },
  {
    name: 'income',
    useStore: useIncomeStore,
    getConfig: mocks.getIncomeConfig,
    getCategory: mocks.getCategoryIncome,
  },
]

describe.each(storeCases)(
  '$name store category loading',
  ({ useStore, getConfig, getCategory }) => {
    beforeEach(() => {
      setActivePinia(createPinia())
      getConfig.mockReset()
      getCategory.mockReset()
      getConfig.mockResolvedValue({
        schemaVersion: 1,
        setupCompleted: true,
        categories: {
          first: { enabled: true },
          second: { enabled: true },
        },
      })
    })

    it('keeps every category when parallel requests finish out of order', async () => {
      const pending = new Map()
      getCategory.mockImplementation(
        (_workspaceId, categoryId) =>
          new Promise((resolve) => {
            pending.set(categoryId, resolve)
          }),
      )
      const store = useStore()

      await store.loadConfig('workspace-a')
      const firstRequest = store.loadCategory('workspace-a', 'first')
      const secondRequest = store.loadCategory('workspace-a', 'second')
      await vi.waitFor(() => expect(pending.size).toBe(2))

      pending.get('second')([{ id: 'second-item', categoryId: 'second' }])
      await secondRequest
      expect(store.categoryLoading).toBe(true)
      pending.get('first')([{ id: 'first-item', categoryId: 'first' }])
      await firstRequest

      expect(store.itemsForCategory('first')).toEqual([{ id: 'first-item', categoryId: 'first' }])
      expect(store.itemsForCategory('second')).toEqual([
        { id: 'second-item', categoryId: 'second' },
      ])
      expect(store.categoryLoading).toBe(false)
    })
  },
)
