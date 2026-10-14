import { describe, expect, it } from 'vitest'
import { buildNetWorthSeries } from '../../../src/domain/financial/history'

describe('financial history series', () => {
  it('flattens and sorts annual documents into monthly net worth points', () => {
    expect(
      buildNetWorthSeries([
        {
          id: '2026',
          months: {
            '02': { netWorth: 120 },
            '01': { netWorth: 100 },
          },
        },
        { year: 2025, months: { 12: { netWorth: 90 } } },
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
          months: { '01': { netWorth: 10 } },
        },
        {
          year: 2026,
          months: {
            '00': { netWorth: 10 },
            13: { netWorth: 20 },
            '03': { netWorth: 'not-a-number' },
            '04': { netWorth: -50 },
            '05': { netWorth: null },
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
              '09': { netWorth: 90 },
              10: { netWorth: 100 },
              11: { netWorth: 110 },
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
})
