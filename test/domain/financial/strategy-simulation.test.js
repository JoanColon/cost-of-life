import { describe, expect, it } from 'vitest'
import {
  inflationAdjustedCoverage,
  latestPositionMonth,
  projectPath,
  simulateStrategy,
  strategyNetWorthProjection,
  strategyNetWorthPoints,
  strategyStartingPosition,
} from '../../../src/domain/financial/strategy-simulation'

describe('strategy simulation', () => {
  it('uses the same inflation-adjusted coverage calculation for months and years', () => {
    expect(
      inflationAdjustedCoverage({
        projectedValue: 24_000,
        currentPeriodCost: 1_000,
        annualInflationPercent: 2,
        month: 120,
      }),
    ).toBe(19.69)

    expect(
      inflationAdjustedCoverage({
        projectedValue: 240_000,
        currentPeriodCost: 12_000,
        annualInflationPercent: 2,
        month: 120,
      }),
    ).toBe(16.41)
  })
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

  it('keeps the configured monthly cash contribution after reaching the emergency fund target', () => {
    const result = projectPath({
      startingPosition: { cash: 1_000, investmentBalances: {} },
      allocation: { cash: 50, invest: 50, debt: 0 },
      investmentMix: { stockMarket: { allocation: 100, annualReturnPercent: 0 } },
      horizonYears: 1,
      cashTargetMonths: 3,
      monthlySavings: 1_000,
      monthlyCost: 500,
    })

    expect(result.cash).toBe(7_000)
    expect(result.cashTargetMonth).toBe(1)
    expect(result.cashContributions).toBe(6_000)
    expect(result.investmentContributions).toBe(6_000)
  })

  it('inflates the future safety target while retaining today’s target', () => {
    const result = projectPath({
      startingPosition: { cash: 0, investmentBalances: {} },
      allocation: { cash: 100, invest: 0, debt: 0 },
      horizonYears: 10,
      cashTargetMonths: 12,
      monthlySavings: 100,
      monthlyCost: 1_000,
      inflationAnnualPercent: 2,
    })

    expect(result.cashContributions).toBe(12_000)
    expect(result.initialCashTarget).toBe(12_000)
    expect(result.cashTarget).toBe(14_627.93)
    expect(result.points.at(-1)).toMatchObject({
      annualCost: 12_000,
      inflationAdjustedAnnualCost: 14_627.93,
      cashTarget: 14_627.93,
      realCash: 9_844.18,
    })
    expect(result.monthlyPoints).toHaveLength(121)
    expect(result.monthlyPoints[1].month).toBe(1)
  })

  it('compounds the configured cash return on the balance and new contributions', () => {
    const result = projectPath({
      startingPosition: { cash: 1_000, investmentBalances: {} },
      allocation: { cash: 100, invest: 0, debt: 0 },
      cashAnnualReturnPercent: 12,
      horizonYears: 1,
      monthlySavings: 100,
      monthlyCost: 0,
    })

    expect(result.cash).toBe(2_384.65)
    expect(result.cashContributions).toBe(1_200)
    expect(result.cashGrowth).toBe(184.65)
    expect(result.points.at(-1).cash).toBe(2_384.65)
  })

  it('keeps unmodeled debt frozen in net worth projections', () => {
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
      { month: 12, value: 18_000 },
      { month: 24, value: 33_000 },
    ])
  })

  it('projects net worth from modeled property appreciation and mortgage amortization', () => {
    const points = strategyNetWorthPoints({
      currentNetWorth: 110_000,
      currentAssets: 160_000,
      currentLiabilities: 50_000,
      currentRealEstate: 100_000,
      strategy: {
        startingValue: 40_000,
        points: [
          {
            month: 0,
            cash: 10_000,
            investmentValue: 30_000,
            investmentBalances: { stockMarket: 30_000, realEstate: 0 },
            investmentContributionBalances: { stockMarket: 0, realEstate: 0 },
          },
          {
            month: 12,
            cash: 22_000,
            investmentValue: 42_000,
            investmentBalances: { stockMarket: 42_000, realEstate: 0 },
            investmentContributionBalances: { stockMarket: 12_000, realEstate: 0 },
          },
        ],
      },
      monthlyDebtContribution: 500,
      debtBalance: 50_000,
      selectedDebtId: 'home',
      realEstateAssets: [
        {
          currentValue: 100_000,
          model: { schemaVersion: 1, annualAppreciationRate: 10 },
        },
      ],
      mortgages: [
        {
          id: 'home',
          currentBalance: 50_000,
          annualInterestRate: 0,
          monthlyPayment: 1_000,
        },
      ],
      asOfDate: '2026-01-01',
    })

    expect(points[0]).toEqual({
      month: 0,
      value: 110_000,
      breakdown: {
        cash: 10_000,
        investments: 30_000,
        realEstate: 100_000,
        otherAssets: 20_000,
        liabilities: -50_000,
      },
    })
    expect(points[1]).toEqual({
      month: 12,
      value: 162_000,
      breakdown: {
        cash: 22_000,
        investments: 42_000,
        realEstate: 110_000,
        otherAssets: 20_000,
        liabilities: -32_000,
      },
    })
  })

  it('reports incomplete mortgage projections instead of silently treating them as unchanged', () => {
    const result = strategyNetWorthProjection({
      currentAssets: 10_000,
      currentLiabilities: 5_000,
      strategy: {
        points: [
          {
            month: 0,
            cash: 10_000,
            investmentValue: 0,
            investmentBalances: {},
            investmentContributionBalances: {},
          },
        ],
      },
      mortgages: [
        {
          id: 'broken',
          currentBalance: 5_000,
          annualInterestRate: 10,
          monthlyPayment: 1,
        },
      ],
      asOfDate: '2026-01-01',
    })

    expect(result.points).toHaveLength(1)
    expect(result.warnings).toEqual([expect.objectContaining({ type: 'mortgage', id: 'broken' })])
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
