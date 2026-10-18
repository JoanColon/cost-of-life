import { describe, expect, it } from 'vitest'
import {
  calculateCashScenario,
  calculateInvestmentScenario,
  calculateWhatIf,
  normalizeStrategyForOptions,
} from '../../../src/domain/financial/what-if'

describe('What If calculations', () => {
  it('adds the selected discretionary reduction to current savings capacity', () => {
    expect(
      calculateWhatIf({
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
      calculateWhatIf({
        availableIncome: 24_000,
        costOfLife: 25_200,
        discretionary: 3_000,
      }).breakEvenReductionPercent,
    ).toBe(40)
  })

  it('compares the same emergency-fund milestone on both paths', () => {
    expect(
      calculateCashScenario({
        cash: 5_000,
        currentMonthlyCost: 2_000,
        simulatedMonthlyCost: 1_800,
        currentMonthlySavings: 500,
        simulatedMonthlySavings: 700,
      }),
    ).toMatchObject({ targetMonths: 3, currentMonths: 2, simulatedMonths: 1, monthsSooner: 1 })
  })

  it('projects monthly investing and compares it with the current path', () => {
    const tenYears = calculateInvestmentScenario({
      monthlyContribution: 795,
      currentMonthlyContribution: 640,
      annualReturnPercent: 7,
    })[0]
    expect(tenYears.projectedValue).toBeGreaterThan(tenYears.currentPathValue)
    expect(tenYears.difference).toBeGreaterThan(0)
  })

  it('moves allocations from unavailable options into Invest', () => {
    expect(
      normalizeStrategyForOptions({ cash: 20, invest: 60, debt: 20 }, { cash: false, debt: true }),
    ).toEqual({ cash: 0, invest: 80, debt: 20 })
  })
})
