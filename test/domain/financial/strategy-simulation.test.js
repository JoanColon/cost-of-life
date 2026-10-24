import { describe, expect, it } from 'vitest'
import {
  latestPositionMonth,
  projectPath,
  simulateStrategy,
  strategyNetWorthPoints,
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

  it('scopes the starting position to one workspace member', () => {
    const financialYear = {
      months: {
        '03': {
          assets: {
            categories: {
              cash: {
                subcategories: {
                  savings_account: {
                    total: 5_000,
                    memberValues: { 'member-a': 2_000, 'member-b': 3_000 },
                  },
                },
              },
              investment: {
                subcategories: {
                  brokerage: {
                    total: 10_000,
                    memberValues: { 'member-a': 4_000, 'member-b': 6_000 },
                  },
                },
              },
            },
          },
        },
      },
    }

    expect(strategyStartingPosition(financialYear, '03', 'member-a')).toMatchObject({
      cash: 2_000,
      investmentTotal: 4_000,
      investmentBalances: { stockMarket: 4_000 },
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

  it('projects net worth from asset growth and capped debt reduction', () => {
    const points = strategyNetWorthPoints({
      currentNetWorth: 5_000,
      strategy: {
        startingValue: 10_000,
        points: [
          { month: 0, value: 10_000 },
          { month: 12, value: 23_000 },
          { month: 24, value: 38_000 },
        ],
      },
      monthlyDebtContribution: 500,
      debtBalance: 8_000,
    })

    expect(points).toEqual([
      { month: 0, value: 5_000 },
      { month: 12, value: 24_000 },
      { month: 24, value: 41_000 },
    ])
  })

  it('counts non-primary real estate toward freedom while keeping cash separate', () => {
    const result = projectPath({
      startingPosition: {
        cash: 5_000,
        investmentBalances: { stockMarket: 10_000, realEstate: 80_000 },
      },
      allocation: { cash: 0, invest: 100, debt: 0 },
      investmentMix: {
        stockMarket: { allocation: 100, annualReturnPercent: 0 },
        realEstate: { allocation: 0, annualReturnPercent: 0 },
      },
      horizonYears: 1,
      monthlySavings: 1_000,
    })

    expect(result.points[0]).toMatchObject({
      value: 95_000,
      cash: 5_000,
      investmentValue: 90_000,
      investmentBalances: { stockMarket: 10_000, realEstate: 80_000 },
      investableValue: 90_000,
    })
    expect(result.points.at(-1)).toMatchObject({
      investmentBalances: { stockMarket: 22_000, realEstate: 80_000 },
      investableValue: 102_000,
    })
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
