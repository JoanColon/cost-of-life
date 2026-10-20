import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  commit: vi.fn(),
  getModelConfig: vi.fn(),
  modelConfigRef: vi.fn((_workspaceId, model) => ({ id: model })),
  set: vi.fn(),
}))

vi.mock('firebase/firestore', () => ({
  serverTimestamp: vi.fn(() => 'server-time'),
  writeBatch: vi.fn(() => ({ set: mocks.set, commit: mocks.commit })),
}))
vi.mock('@/firebase/firebase', () => ({ db: { id: 'db' } }))
vi.mock('@/services/firebase/current-user', () => ({ currentUserId: () => 'user-a' }))
vi.mock('@/services/firebase/model-config.service', () => ({
  getModelConfig: mocks.getModelConfig,
  modelConfigRef: mocks.modelConfigRef,
}))

import { getWhatIfConfig, saveWhatIfConfig } from '../../src/services/firebase/what-if.service'

describe('What If persistence', () => {
  beforeEach(() => {
    mocks.commit.mockReset().mockResolvedValue(undefined)
    mocks.getModelConfig.mockReset()
    mocks.modelConfigRef.mockClear()
    mocks.set.mockReset()
  })

  it('loads saved scenarios on top of the legacy What If configuration', async () => {
    mocks.getModelConfig
      .mockResolvedValueOnce({
        discretionaryReductionPercent: 25,
        expectedAnnualReturnPercent: 7,
        strategy: { cash: 20, invest: 60, debt: 20 },
      })
      .mockResolvedValueOnce({
        activeScenarioId: 'custom',
        scenarios: [
          {
            id: 'custom',
            name: 'Custom',
            allocation: { cash: 10, invest: 90, debt: 0 },
            investmentMix: {
              stockMarket: { allocation: 100, annualReturnPercent: 6 },
            },
          },
        ],
      })

    const config = await getWhatIfConfig('workspace-a')

    expect(config.activeScenarioId).toBe('custom')
    expect(config.scenarios[0].investmentMix.stockMarket.annualReturnPercent).toBe(6)
    expect(config.discretionaryReductionPercent).toBe(25)
  })

  it('keeps the original document compatible and stores scenario configuration separately', async () => {
    const config = {
      discretionaryReductionPercent: 25,
      activeScenarioId: 'default',
      scenarios: [
        {
          id: 'default',
          name: 'Balanced',
          allocation: { cash: 20, invest: 60, debt: 20 },
          investmentMix: {
            stockMarket: { allocation: 100, annualReturnPercent: 6 },
          },
          horizonYears: 20,
          cashTargetMonths: 12,
          selectedLiabilityId: 'mortgage-a',
        },
      ],
    }

    await saveWhatIfConfig('workspace-a', config)

    expect(mocks.set).toHaveBeenCalledWith(
      { id: 'whatIf' },
      expect.objectContaining({
        schemaVersion: 1,
        discretionaryReductionPercent: 25,
        expectedAnnualReturnPercent: 6,
        strategy: { cash: 20, invest: 60, debt: 20 },
      }),
    )
    expect(mocks.set).toHaveBeenCalledWith(
      { id: 'whatIfStrategies' },
      expect.objectContaining({
        schemaVersion: 1,
        activeScenarioId: 'default',
        scenarios: expect.any(Array),
      }),
    )
    expect(mocks.commit).toHaveBeenCalledOnce()
  })
})
