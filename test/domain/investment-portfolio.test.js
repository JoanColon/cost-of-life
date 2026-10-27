import { describe, expect, it } from 'vitest'
import {
  changeTone,
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

  it('maps the requested columns from a Google Sheets response', () => {
    const rows = portfolioTableRows(
      [
        [
          'DividnedData Ticker',
          'Name',
          'Country',
          'Sector',
          'Industry',
          'Currency',
          'Shares',
          'Price (local)',
          'Day Change %',
          'Cost basis (local)',
          'Avg buy cost / share (local)',
          'Avg cost / share (local FIFO)',
          'Return %',
          'Dividend (local)',
          'Dividend yield (local)',
          'FX to base',
          'Market value (base)',
          'Portfolio %',
          'Annual dividend (base)',
          'Income %',
        ],
        [
          'IBE.MC',
          'Iberdrola',
          'ES',
          'Utilities',
          '',
          'EUR',
          '1000',
          '21,9',
          '0,74%',
          '',
          '',
          '',
          '',
          '',
          '2,51%',
          '1,00',
          '21900',
          '81,52%',
          '550,00',
          '82,89%',
        ],
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
        dividendYield: '2.51%',
        marketValueBase: '€21,900',
        portfolioWeight: '81.5%',
        annualDividendBase: '€550',
        incomeWeight: '82.9%',
      },
    ])
  })

  it('ignores empty rows and classifies daily changes', () => {
    expect(portfolioTableRows([['Ticker'], ['', '']])).toEqual([])
    expect(changeTone('-1,25%')).toBe('negative')
    expect(changeTone('0,74%')).toBe('positive')
    expect(changeTone('0%')).toBe('neutral')
    expect(changeTone('')).toBe('neutral')
  })

  it('formats localized currency and percentage values consistently', () => {
    expect(formatCurrencyValue('5.793,2', 'EUR', 0)).toBe('€5,793')
    expect(formatCurrencyValue('92,71', 'USD', 2)).toBe('$92.71')
    expect(formatCurrencyValue('', 'EUR', 0)).toBe('')
    expect(formatPercentageValue('79,08%', 1)).toBe('79.1%')
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
