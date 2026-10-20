import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { getWhatIfConfig, saveWhatIfConfig } = vi.hoisted(() => ({
  getWhatIfConfig: vi.fn(),
  saveWhatIfConfig: vi.fn(),
}))

vi.mock('@/services/firebase/what-if.service', () => ({
  getWhatIfConfig,
  saveWhatIfConfig,
}))

import { useWhatIfStore } from '../../src/stores/what-if-store'

describe('What If store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    getWhatIfConfig.mockReset().mockResolvedValue({
      discretionaryReductionPercent: 25,
      activeScenarioId: 'default',
      scenarios: [
        {
          id: 'default',
          name: 'Balanced strategy',
          allocation: { cash: 20, invest: 60, debt: 20 },
          investmentMix: {
            stockMarket: { allocation: 100, annualReturnPercent: 7 },
          },
          horizonYears: 20,
          cashTargetMonths: 12,
          selectedLiabilityId: null,
        },
      ],
    })
    saveWhatIfConfig.mockReset().mockImplementation(async (_workspaceId, config) => config)
  })

  it('caches configuration per active workspace', async () => {
    const store = useWhatIfStore()
    await store.load('workspace-a')
    await store.load('workspace-a')
    expect(getWhatIfConfig).toHaveBeenCalledTimes(1)
    expect(store.config.discretionaryReductionPercent).toBe(25)
  })

  it('persists assumptions but not calculated results', async () => {
    const store = useWhatIfStore()
    await store.load('workspace-a')
    const scenarios = JSON.parse(JSON.stringify(store.config.scenarios))
    scenarios[0].investmentMix.stockMarket.annualReturnPercent = 6
    await store.save('workspace-a', { scenarios })

    expect(saveWhatIfConfig).toHaveBeenCalledWith(
      'workspace-a',
      expect.objectContaining({
        discretionaryReductionPercent: 25,
        scenarios: expect.arrayContaining([
          expect.objectContaining({
            investmentMix: expect.objectContaining({
              stockMarket: expect.objectContaining({ annualReturnPercent: 6 }),
            }),
          }),
        ]),
      }),
    )
    expect(saveWhatIfConfig.mock.calls[0][1]).not.toHaveProperty('results')
  })
})
