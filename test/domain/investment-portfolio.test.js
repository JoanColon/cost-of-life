import { describe, expect, it } from 'vitest'
import {
  countryFlag,
  formatCurrencyValue,
  formatPercentageValue,
  portfolioKpis,
  portfolioTableRows,
} from '../../src/domain/financial/investment-portfolio.js'

describe('investment portfolio table', () => {
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
        priceLocal: '€21.90',
        dayChange: '0.74%',
        dayChangeTone: 'positive',
        dividendYield: '2.51%',
        marketValueBase: '€21,900',
        portfolioWeight: '81.5%',
        annualDividendBase: '€550',
        incomeWeight: '82.9%',
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
