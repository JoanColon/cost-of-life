import { describe, expect, it } from 'vitest'
import {
  calculateCashBufferScenario,
  calculateInvestmentContributionScenario,
  calculateProjectionDelta,
  calculateSafetyCoverageScenario,
  calculateSavingsCapacityScenario,
  normalizeWhatIfConfig,
  normalizeStrategyForOptions,
} from '../../../functions/shared/plan/what-if.js'

describe('What If calculations', () => {
  it('adds the selected discretionary reduction to current savings capacity', () => {
    expect(
      calculateSavingsCapacityScenario({
        availableIncome: 36_000,
        costOfLife: 28_320,
        discretionary: 7_440,
        reductionPercent: 25,
      }),
    ).toMatchObject({
      currentSavingsCapacity: 640,
      monthlyDiscretionary: 620,
      extraSavings: 155,
      simulatedSavingsCapacity: 795,
      simulatedCostOfLife: 2205,
    })
  })

  it('reports the discretionary reduction needed to break even', () => {
    expect(
      calculateSavingsCapacityScenario({
        availableIncome: 24_000,
        costOfLife: 25_200,
        discretionary: 3_000,
      }).breakEvenReductionPercent,
    ).toBe(40)
  })

  it('combines direct extra savings with savings from lower spending', () => {
    expect(
      calculateSavingsCapacityScenario({
        availableIncome: 36_000,
        costOfLife: 28_320,
        discretionary: 7_440,
        reductionPercent: 10,
        extraMonthlySavings: 100,
      }),
    ).toMatchObject({
      spendingReductionSavings: 62,
      directExtraSavings: 100,
      extraSavings: 162,
      simulatedSavingsCapacity: 802,
      simulatedCostOfLife: 2298,
    })
  })

  it('always compares the one-year emergency-fund milestone on both paths', () => {
    expect(
      calculateCashBufferScenario({
        cash: 5_000,
        currentMonthlyCost: 2_000,
        simulatedMonthlyCost: 1_800,
        currentMonthlySavings: 500,
        simulatedMonthlySavings: 700,
      }),
    ).toMatchObject({
      targetMonths: 12,
      currentMonths: 38,
      simulatedMonths: 24,
      monthsSooner: 14,
      achieved: false,
    })
  })

  it('keeps the cash scenario visible when the one-year milestone is achieved', () => {
    expect(
      calculateCashBufferScenario({
        cash: 25_000,
        currentMonthlyCost: 2_000,
        simulatedMonthlyCost: 2_000,
        currentMonthlySavings: 500,
        simulatedMonthlySavings: 700,
      }),
    ).toMatchObject({ targetMonths: 12, simulatedMonths: 0, achieved: true })
  })

  it('projects monthly investing and compares it with the current path', () => {
    const tenYears = calculateInvestmentContributionScenario({
      monthlyContribution: 795,
      currentMonthlyContribution: 640,
      annualReturnPercent: 7,
    })[0]
    expect(tenYears.projectedValue).toBeGreaterThan(tenYears.currentPathValue)
    expect(tenYears.difference).toBeGreaterThan(0)
  })

  it('keeps an existing portfolio in both paths so the reported result is a delta', () => {
    const result = calculateInvestmentContributionScenario({
      startingValue: 50_000,
      monthlyContribution: 600,
      currentMonthlyContribution: 500,
      annualReturnPercent: 7,
    }).find(({ years }) => years === 20)
    expect(result.projectedValue).toBeGreaterThan(result.currentPathValue)
    expect(result.difference).toBe(
      calculateProjectionDelta(result.projectedValue, result.currentPathValue),
    )
  })

  it('reports additional emergency-fund safety against the baseline path', () => {
    expect(
      calculateSafetyCoverageScenario({
        cash: 10_000,
        currentMonthlyCost: 2_000,
        simulatedMonthlyCost: 2_000,
        currentMonthlySavings: 500,
        simulatedMonthlySavings: 600,
      }),
    ).toMatchObject({
      baselineSafetyMonths: 7.91,
      scenarioSafetyMonths: 8.5,
      additionalSafetyMonths: 0.59,
      alreadyFunded: false,
    })
  })

  it('moves allocations from unavailable options into Invest', () => {
    expect(
      normalizeStrategyForOptions({ cash: 20, invest: 60, debt: 20 }, { cash: false, debt: true }),
    ).toEqual({ cash: 0, invest: 80, debt: 20 })
  })

  it('migrates the original single strategy into a saved scenario configuration', () => {
    const config = normalizeWhatIfConfig({
      discretionaryReductionPercent: 25,
      expectedAnnualReturnPercent: 6,
      selectedLiabilityId: 'mortgage-a',
      strategy: { cash: 10, invest: 70, debt: 20 },
    })

    expect(config).toMatchObject({
      activeScenarioId: 'default',
      scenarios: [
        {
          allocation: { cash: 10, invest: 70, debt: 20 },
          investmentMix: {
            stockMarket: { allocation: 100, annualReturnPercent: 6 },
          },
          selectedLiabilityId: 'mortgage-a',
        },
      ],
    })
  })

  it('keeps cash return settings while defaulting older scenarios to one percent', () => {
    const configured = normalizeWhatIfConfig({
      activeScenarioId: 'cash-return',
      scenarios: [
        {
          id: 'cash-return',
          name: 'Cash return',
          allocation: { cash: 100, invest: 0, debt: 0 },
          investmentMix: { stockMarket: { allocation: 100, annualReturnPercent: 7 } },
          cashAnnualReturnPercent: 2.5,
        },
      ],
    })
    const legacy = normalizeWhatIfConfig({
      strategy: { cash: 100, invest: 0, debt: 0 },
    })

    expect(configured.scenarios[0].cashAnnualReturnPercent).toBe(2.5)
    expect(legacy.scenarios[0].cashAnnualReturnPercent).toBe(1)
  })
})
