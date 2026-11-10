import { describe, expect, it } from 'vitest'
import {
  buildAssetAnnualSeries,
  buildMonthlyFlowSeries,
  buildNetWorthBreakdownSeries,
  buildNetWorthBridge,
  buildNetWorthSeries,
  buildProgressSeries,
  positionHistoryDocuments,
  withCurrentPosition,
} from '../../../src/domain/financial/history'

function positionMonth(assets, liabilities = 0) {
  const memberValues = { member: assets }
  return {
    assets: {
      categories: {
        assets: { subcategories: { assets: { total: assets, memberValues } } },
      },
    },
    liabilities: {
      categories: {
        liabilities: {
          subcategories: {
            liabilities: { total: liabilities, memberValues: { member: liabilities } },
          },
        },
      },
    },
  }
}

describe('financial history series', () => {
  it('uses only observed financial year months as position history', () => {
    const history = {
      year: 2026,
      projectionState: { assetsInitializedMonth: '10', liabilitiesInitializedMonth: '11' },
      months: {
        '09': positionMonth(90),
        10: positionMonth(100),
        11: positionMonth(110),
        12: positionMonth(120),
      },
    }

    expect(
      Object.keys(positionHistoryDocuments([history], { throughPeriod: '2026-11' })[0].months),
    ).toEqual(['10', '11'])
  })

  it('excludes explicitly unobserved and projected position months', () => {
    const history = {
      year: 2026,
      months: {
        '09': { ...positionMonth(90), positionStatus: 'unobserved' },
        10: { ...positionMonth(100), positionStatus: 'closed' },
        11: { ...positionMonth(110), positionStatus: 'current' },
        12: { ...positionMonth(120), positionStatus: 'projected' },
      },
    }

    expect(buildNetWorthSeries([history])).toEqual([
      { period: '2026-10', value: 100 },
      { period: '2026-11', value: 110 },
    ])
  })

  it('keeps closed snapshots and replaces only the live current month', () => {
    const result = withCurrentPosition(
      [{ year: 2026, months: { '01': positionMonth(100), '02': positionMonth(110) } }],
      { year: 2026, months: { '03': positionMonth(125), '04': positionMonth(999) } },
      '03',
    )

    expect(Object.keys(result[0].months)).toEqual(['01', '02', '03'])
    expect(buildNetWorthSeries(result).at(-1)).toEqual({ period: '2026-03', value: 125 })
  })

  it('builds one annual history point for a specific asset', () => {
    const annualDocument = (year, value) => ({
      year,
      months: {
        12: {
          assets: {
            categories: {
              investment: {
                subcategories: {
                  stocks: { items: { portfolio: { total: value }, other: { total: 10 } } },
                },
              },
            },
          },
        },
      },
    })

    expect(
      buildAssetAnnualSeries([annualDocument(2026, 30_000), annualDocument(2025, 25_000)], {
        assetId: 'portfolio',
      }),
    ).toEqual([
      { year: 2025, value: 25_000 },
      { year: 2026, value: 30_000 },
    ])
  })

  it('flattens and sorts annual documents into monthly net worth points', () => {
    expect(
      buildNetWorthSeries([
        {
          id: '2026',
          months: {
            '02': positionMonth(120),
            '01': positionMonth(100),
          },
        },
        { year: 2025, months: { 12: positionMonth(90) } },
      ]),
    ).toEqual([
      { period: '2025-12', value: 90 },
      { period: '2026-01', value: 100 },
      { period: '2026-02', value: 120 },
    ])
  })

  it('ignores invalid years, months, and values', () => {
    expect(
      buildNetWorthSeries([
        {
          id: 'invalid',
          months: { '01': positionMonth(10) },
        },
        {
          year: 2026,
          months: {
            '00': positionMonth(10),
            13: positionMonth(20),
            '03': {},
            '04': positionMonth(50, 100),
            '05': null,
          },
        },
      ]),
    ).toEqual([{ period: '2026-04', value: -50 }])
  })

  it('returns an empty series without history', () => {
    expect(buildNetWorthSeries()).toEqual([])
  })

  it('excludes projected months after the requested history period', () => {
    expect(
      buildNetWorthSeries(
        [
          {
            year: 2026,
            months: {
              '09': positionMonth(90),
              10: positionMonth(100),
              11: positionMonth(110),
            },
          },
        ],
        { throughPeriod: '2026-10' },
      ),
    ).toEqual([
      { period: '2026-09', value: 90 },
      { period: '2026-10', value: 100 },
    ])
  })

  it('builds category series with liabilities below zero', () => {
    const month = {
      assets: {
        categories: {
          cash: { subcategories: { cash: { total: 15_000 } } },
          investment: { subcategories: { investment: { total: 25_000 } } },
        },
      },
      liabilities: {
        categories: {
          mortgage: { subcategories: { mortgage: { total: 12_000 } } },
        },
      },
    }

    expect(buildNetWorthBreakdownSeries([{ year: 2026, months: { '03': month } }])).toEqual([
      {
        period: '2026-03',
        assets: { cash: 15_000, investment: 25_000 },
        liabilities: { mortgage: -12_000 },
      },
    ])
  })

  it('filters net worth and category history by member', () => {
    const month = {
      assets: {
        categories: {
          cash: {
            subcategories: {
              cash: { total: 1_000, memberValues: { alice: 400, bob: 600 } },
            },
          },
        },
      },
      liabilities: {
        categories: {
          mortgage: {
            subcategories: {
              mortgage: { total: 300, memberValues: { alice: 100, bob: 200 } },
            },
          },
        },
      },
    }
    const history = [{ year: 2026, months: { '03': month } }]

    expect(buildNetWorthSeries(history, { memberId: 'alice' })).toEqual([
      { period: '2026-03', value: 300 },
    ])
    expect(buildNetWorthBreakdownSeries(history, { memberId: 'alice' })).toEqual([
      {
        period: '2026-03',
        assets: { cash: 400 },
        liabilities: { mortgage: -100 },
      },
    ])
  })

  it('builds progress snapshots from the same financial year model', () => {
    const month = {
      positionStatus: 'current',
      assets: {
        categories: {
          cash: { subcategories: { cash: { total: 5_000 } } },
          investment: { subcategories: { stocks: { total: 40_000 } } },
          real_estate: {
            subcategories: {
              rental_property: { total: 20_000 },
              main_home: { total: 100_000 },
            },
          },
        },
      },
      liabilities: {
        categories: { mortgage: { subcategories: { home: { total: 60_000 } } } },
      },
      income: {
        categories: {
          salary: {
            subcategories: { salary: { items: { salary: { total: 30_000 } } } },
          },
        },
      },
      expenses: {
        categories: {
          housing: { subcategories: { housing: { effective: 12_000 } } },
        },
      },
    }

    expect(buildProgressSeries([{ year: 2026, months: { 11: month } }])).toEqual([
      {
        period: '2026-11',
        netWorth: 105_000,
        assets: 165_000,
        liabilities: 60_000,
        investmentAssets: 40_000,
        mortgageBalance: 60_000,
        costOfLife: 12_000,
        income: 30_000,
        savingsCapacity: 18_000,
        investableWealth: 5_000,
        yearsFunded: 5 / 12,
      },
    ])
  })

  it('builds monthly flow points and reports the expense data coverage', () => {
    const month = {
      positionStatus: 'current',
      assets: { categories: {} },
      liabilities: { categories: {} },
      income: {
        categories: {
          salary: { subcategories: { salary: { items: { job: { total: 3_000 } } } } },
        },
      },
      expenses: {
        categories: {
          living: {
            subcategories: {
              housing: { effective: 1_000, source: 'tracked' },
              food: { effective: 500, source: 'model' },
            },
          },
        },
      },
    }

    expect(buildMonthlyFlowSeries([{ year: 2026, months: { 11: month } }])).toEqual([
      {
        period: '2026-11',
        income: 3_000,
        costOfLife: 1_500,
        savingsCapacity: 1_500,
        coverage: 'mixed',
      },
    ])
  })

  it('builds a net worth bridge from asset and liability category changes', () => {
    expect(
      buildNetWorthBridge(
        { assets: { cash: 10_000 }, liabilities: { mortgage: -8_000 } },
        { assets: { cash: 12_500, investment: 2_000 }, liabilities: { mortgage: -6_000 } },
      ),
    ).toEqual([
      { key: 'assets:cash', section: 'assets', categoryId: 'cash', value: 2_500 },
      { key: 'assets:investment', section: 'assets', categoryId: 'investment', value: 2_000 },
      { key: 'liabilities:mortgage', section: 'liabilities', categoryId: 'mortgage', value: 2_000 },
    ])
  })

  it('uses the full financial year for annual flows when only one position month is observed', () => {
    const flowMonth = (positionStatus = 'projected') => ({
      positionStatus,
      assets: { categories: { investment: { subcategories: { stocks: { total: 24_000 } } } } },
      liabilities: { categories: {} },
      income: {
        categories: {
          salary: { subcategories: { salary: { items: { salary: { total: 3_000 } } } } },
        },
      },
      expenses: {
        categories: { living: { subcategories: { living: { effective: 1_000 } } } },
      },
    })
    const months = Object.fromEntries(
      Array.from({ length: 12 }, (_, index) => {
        const month = String(index + 1).padStart(2, '0')
        return [month, flowMonth(month === '11' ? 'current' : 'projected')]
      }),
    )

    expect(buildProgressSeries([{ year: 2026, months }], { throughPeriod: '2026-11' })).toEqual([
      expect.objectContaining({
        period: '2026-11',
        costOfLife: 12_000,
        income: 36_000,
        savingsCapacity: 24_000,
        investableWealth: 24_000,
        yearsFunded: 2,
      }),
    ])
  })
})
