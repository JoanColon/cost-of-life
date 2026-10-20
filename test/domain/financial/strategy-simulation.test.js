import { describe, expect, it } from 'vitest'
import {
  latestPositionMonth,
  projectPath,
  simulateStrategy,
  strategyStartingPosition,
} from '../../../src/domain/financial/strategy-simulation'

describe('strategy simulation', () => {
  it('uses the current month or latest available financial position', () => {
    const financialYear = { months: { '01': {}, '03': {} } }
    expect(latestPositionMonth(financialYear, '03')).toBe('03')
    expect(latestPositionMonth(financialYear, '05')).toBe('03')
  })

  it('maps current assets into investment types without treating the primary home as an investment', () => {
    const financialYear = {
      months: {
        '03': {
          assets: {
            categories: {
              cash: { subcategories: { savings_account: { total: 5_000 } } },
              investment: {
                subcategories: {
                  brokerage: { total: 10_000 },
                  bonds: { total: 2_000 },
                },
              },
              real_estate: {
                subcategories: {
                  primary_home: { total: 300_000 },
                  rental_property: { total: 80_000 },
                },
              },
            },
          },
        },
      },
    }

    expect(strategyStartingPosition(financialYear, '03')).toMatchObject({
      cash: 5_000,
      investmentTotal: 92_000,
      investmentBalances: { stockMarket: 10_000, fixedIncome: 2_000, realEstate: 80_000 },
    })
  })

  it('redirects cash contributions into investments after reaching the emergency fund target', () => {
    const result = projectPath({
      startingPosition: { cash: 1_000, investmentBalances: {} },
      allocation: { cash: 50, invest: 50, debt: 0 },
      investmentMix: { stockMarket: { allocation: 100, annualReturnPercent: 0 } },
      horizonYears: 1,
      cashTargetMonths: 3,
      monthlySavings: 1_000,
      monthlyCost: 500,
    })

    expect(result.cash).toBe(1_500)
    expect(result.cashTargetMonth).toBe(1)
    expect(result.investmentContributions).toBe(11_500)
  })

  it('keeps freedom milestone assets separate from cash and non-investable asset types', () => {
    const result = projectPath({
      startingPosition: {
        cash: 5_000,
        investmentBalances: { stockMarket: 10_000, realEstate: 80_000 },
      },
      allocation: { cash: 0, invest: 100, debt: 0 },
      investmentMix: { stockMarket: { allocation: 100, annualReturnPercent: 0 } },
      horizonYears: 1,
      monthlySavings: 1_000,
    })

    expect(result.points[0]).toMatchObject({
      value: 95_000,
      cash: 5_000,
      investmentValue: 90_000,
      investableValue: 10_000,
    })
    expect(result.points.at(-1).investableValue).toBe(22_000)
  })

  it('projects only the user-defined scenario from the current financial position', () => {
    const result = simulateStrategy({
      startingPosition: { cash: 0, investmentBalances: {} },
      scenario: {
        allocation: { cash: 0, invest: 100, debt: 0 },
        investmentMix: { stockMarket: { allocation: 100, annualReturnPercent: 7 } },
        horizonYears: 10,
        cashTargetMonths: 12,
      },
      simulatedMonthlySavings: 800,
      simulatedMonthlyCost: 2_000,
    })

    expect(result.strategy.finalValue).toBeGreaterThan(800 * 12 * 10)
    expect(result).not.toHaveProperty('currentPath')
    expect(result).not.toHaveProperty('difference')
  })
})
