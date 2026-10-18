import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const {
  calculateMilestoneProgress,
  createMissingAchievements,
  getAchievements,
  getFinancialHistory,
  getFinancialYear,
} = vi.hoisted(() => ({
  calculateMilestoneProgress: vi.fn(),
  createMissingAchievements: vi.fn(),
  getAchievements: vi.fn(),
  getFinancialHistory: vi.fn(),
  getFinancialYear: vi.fn(),
}))

vi.mock('@/domain/milestones/calculations', () => ({ calculateMilestoneProgress }))
vi.mock('@/services/firebase/achievements.service', () => ({
  createMissingAchievements,
  getAchievements,
}))
vi.mock('@/services/firebase/history.service', () => ({ getFinancialHistory }))
vi.mock('@/services/firebase/financial-years.service', () => ({
  getFinancialYear,
  subscribeFinancialYear: vi.fn(() => vi.fn()),
}))

import { useMilestonesStore } from '../../src/stores/milestones-store'

describe('milestones store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    getFinancialYear.mockReset().mockResolvedValue({ year: 2026, months: {} })
    getFinancialHistory.mockReset().mockResolvedValue([{ year: 2025, months: {} }])
    getAchievements.mockReset().mockResolvedValue([])
    createMissingAchievements.mockReset().mockResolvedValue([])
    calculateMilestoneProgress.mockReset().mockReturnValue([
      {
        id: 'safety_1_month',
        family: 'safety',
        progress: 0.5,
        reached: false,
        previouslyAchieved: false,
      },
    ])
  })

  it('shares a cached workspace load between consumers', async () => {
    const store = useMilestonesStore()

    await store.load('workspace-a')
    await store.load('workspace-a')

    expect(getFinancialHistory).toHaveBeenCalledTimes(1)
    expect(getAchievements).toHaveBeenCalledTimes(1)
    expect(store.progress).toHaveLength(1)
  })

  it('clears milestone state when the application resets', async () => {
    const store = useMilestonesStore()

    await store.load('workspace-a')
    store.reset()

    expect(store.achievements).toEqual([])
    expect(store.historyDocuments).toEqual([])
    expect(store.progress).toEqual([])
  })
})
