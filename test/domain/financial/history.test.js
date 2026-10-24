import { describe, expect, it } from 'vitest'
import {
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
})
