import { describe, expect, it } from 'vitest'
import financialHistory from '../../functions/domain/financial-history.js'

const { buildMonthlyFinancialSnapshot, isLastDayOfMonth, periodForInstant } = financialHistory

function category(overrides = {}) {
  return {
    enabled: true,
    manualValue: 0,
    itemCount: 0,
    itemizedValue: 0,
    ...overrides,
  }
}

describe('monthly financial snapshot', () => {
  it('builds totals, categories, compact items, labels, and net worth', () => {
    const capturedAt = { seconds: 123 }
    const result = buildMonthlyFinancialSnapshot({
      assetsSummary: {
        categories: {
          cash: category({ manualValue: 50 }),
          investment: category({ itemCount: 2, itemizedValue: 125.55 }),
          hidden: category({ enabled: false, manualValue: 900 }),
        },
      },
      liabilitiesSummary: {
        categories: {
          mortgage: category({ itemCount: 1, itemizedValue: 25.55 }),
        },
      },
      assets: [
        { id: 'asset-a', data: { category: 'investment', currentValue: 100, name: 'Degiro' } },
        {
          id: 'asset-b',
          data: { category: 'investment', currentValue: 25.55, name: 'Indexa' },
        },
        { id: 'ignored', data: { category: 'cash', currentValue: 500, name: 'Old cash' } },
      ],
      liabilities: [
        {
          id: 'liability-a',
          data: { category: 'mortgage', balance: 25.55, name: 'Home mortgage' },
        },
      ],
      capturedAt,
    })

    expect(result.snapshot).toEqual({
      assets: {
        total: 175.55,
        categories: { cash: 50, investment: 125.55 },
        items: { 'asset-a': 100, 'asset-b': 25.55 },
      },
      liabilities: {
        total: 25.55,
        categories: { mortgage: 25.55 },
        items: { 'liability-a': 25.55 },
      },
      netWorth: 150,
      capturedAt,
    })
    expect(result.itemLabels).toEqual({
      assets: { 'asset-a': 'Degiro', 'asset-b': 'Indexa' },
      liabilities: { 'liability-a': 'Home mortgage' },
    })
  })

  it('handles assets without liabilities', () => {
    const result = buildMonthlyFinancialSnapshot({
      assetsSummary: { categories: { cash: category({ manualValue: 80 }) } },
    })

    expect(result.snapshot.assets.total).toBe(80)
    expect(result.snapshot.liabilities).toEqual({ total: 0, categories: {}, items: {} })
    expect(result.snapshot.netWorth).toBe(80)
  })

  it('handles liabilities without assets', () => {
    const result = buildMonthlyFinancialSnapshot({
      liabilitiesSummary: { categories: { loan: category({ manualValue: 30 }) } },
    })

    expect(result.snapshot.assets).toEqual({ total: 0, categories: {}, items: {} })
    expect(result.snapshot.liabilities.total).toBe(30)
    expect(result.snapshot.netWorth).toBe(-30)
  })

  it('handles a workspace without financial data', () => {
    const result = buildMonthlyFinancialSnapshot({})

    expect(result.snapshot).toMatchObject({
      assets: { total: 0, categories: {}, items: {} },
      liabilities: { total: 0, categories: {}, items: {} },
      netWorth: 0,
    })
    expect(result.itemLabels).toEqual({ assets: {}, liabilities: {} })
  })
})

describe('financial history calendar', () => {
  const timeZone = 'Europe/Madrid'

  it.each([
    ['2026-02-28T12:00:00Z', true],
    ['2026-02-27T12:00:00Z', false],
    ['2028-02-29T12:00:00Z', true],
    ['2028-02-28T12:00:00Z', false],
    ['2026-04-30T12:00:00Z', true],
    ['2026-05-31T12:00:00Z', true],
    ['2026-12-31T12:00:00Z', true],
    ['2027-01-01T12:00:00Z', false],
  ])('detects month boundaries for %s', (instant, expected) => {
    expect(isLastDayOfMonth(new Date(instant), timeZone)).toBe(expected)
  })

  it('derives the period in the configured timezone', () => {
    expect(periodForInstant(new Date('2026-03-31T22:30:00Z'), timeZone)).toEqual({
      year: 2026,
      month: '04',
      day: 1,
    })
  })
})
