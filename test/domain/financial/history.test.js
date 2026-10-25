import { describe, expect, it } from 'vitest'
import {
  buildAssetAnnualSeries,
  buildNetWorthBreakdownSeries,
  buildNetWorthSeries,
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
})
