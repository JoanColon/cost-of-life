import { describe, expect, it } from 'vitest'
import {
  countryFlag,
  formatCurrencyValue,
  formatPercentageValue,
  portfolioAllocationGroups,
  portfolioKpis,
  portfolioTableRows,
} from '../../src/domain/financial/investment-portfolio.js'

describe('investment portfolio table', () => {
  it('groups market value and dividend income by portfolio dimensions', () => {
    const holdings = [
      {
        ticker: 'IBE.MC',
        sector: 'Utilities',
        marketValueBase: 700,
        annualDividendBase: 40,
      },
      {
        ticker: 'ENG.MC',
        sector: 'Utilities',
        marketValueBase: 300,
        annualDividendBase: 60,
      },
      {
        ticker: 'ETF',
        sector: '',
        marketValueBase: 1000,
        annualDividendBase: 0,
      },
    ]

    expect(portfolioAllocationGroups(holdings, 'sector', 'marketValueBase', 'Unknown')).toEqual([
      expect.objectContaining({ name: 'Unknown', value: 1000, percentage: 50 }),
      expect.objectContaining({ name: 'Utilities', value: 1000, percentage: 50 }),
    ])
    expect(portfolioAllocationGroups(holdings, 'ticker', 'annualDividendBase')).toEqual([
      expect.objectContaining({ name: 'ENG.MC', value: 60, percentage: 60 }),
      expect.objectContaining({ name: 'IBE.MC', value: 40, percentage: 40 }),
    ])
  })

  it('derives flags from ISO country codes without a country map', () => {
    expect(countryFlag('ES')).toBe('🇪🇸')
    expect(countryFlag('us')).toBe('🇺🇸')
    expect(countryFlag('Spain')).toBe('')
  })

  it('formats normalized holdings without knowing the Google Sheets columns', () => {
    const rows = portfolioTableRows(
      [
        {
          ticker: 'IBE.MC',
          country: 'ES',
          currency: 'EUR',
          shares: 1000,
          priceLocal: 21.9,
          dayChangePercent: 0.74,
          dividendYieldPercent: 2.51,
          marketValueBase: 21900,
          portfolioWeightPercent: 81.52,
          annualDividendBase: 550,
          incomeWeightPercent: 82.89,
        },
      ],
      'EUR',
    )

    expect(rows).toEqual([
      {
        id: 'portfolio-0',
        ticker: 'IBE.MC',
        country: 'ES',
        currency: 'EUR',
        shares: '1,000',
        sharesValue: 1000,
        priceLocal: '€21.90',
        priceLocalValue: 21.9,
        dayChange: '0.74%',
        dayChangeValue: 0.74,
        dayChangeTone: 'positive',
        dividendYield: '2.51%',
        dividendYieldValue: 2.51,
        marketValueBase: '€21,900',
        marketValueBaseValue: 21900,
        portfolioWeight: '81.5%',
        portfolioWeightValue: 81.52,
        annualDividendBase: '€550',
        annualDividendBaseValue: 550,
        incomeWeight: '82.9%',
        incomeWeightValue: 82.89,
      },
    ])
  })

  it('uses placeholders for unavailable normalized holding values', () => {
    expect(portfolioTableRows(null)).toEqual([])
    expect(portfolioTableRows([{ ticker: 'VWCE', dayChangePercent: null }])[0]).toMatchObject({
      ticker: 'VWCE',
      dayChange: '',
      dayChangeTone: 'neutral',
    })
  })

  it('formats canonical numeric currency and percentage values consistently', () => {
    expect(formatCurrencyValue(5793.2, 'EUR', 0)).toBe('€5,793')
    expect(formatCurrencyValue(92.71, 'USD', 2)).toBe('$92.71')
    expect(formatCurrencyValue(null, 'EUR', 0)).toBe('')
    expect(formatPercentageValue(79.08, 1)).toBe('79.1%')
  })

  it('calculates portfolio KPIs exclusively from the Summary values', () => {
    const metrics = portfolioKpis({
      baseCurrency: 'EUR',
      totalPortfolioValue: 27693.16,
      totalDividendsReceived: 800,
      annualDividendIncome: 600,
    })

    expect(metrics).toEqual({
      totalPortfolioValue: '€27,693',
      annualDividendIncome: '€600',
      grossDividendIncome: '€800',
      dividendYield: '2.2%',
    })
  })

  it('uses placeholders when KPI source values are unavailable', () => {
    expect(portfolioKpis()).toEqual({
      totalPortfolioValue: '—',
      annualDividendIncome: '—',
      grossDividendIncome: '—',
      dividendYield: '—',
    })
  })
})
