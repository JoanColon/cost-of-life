import { describe, expect, it } from 'vitest'
import { changeTone, portfolioTableRows } from '../../src/domain/financial/investment-portfolio.js'

describe('investment portfolio table', () => {
  it('maps the requested columns from a Google Sheets response', () => {
    const rows = portfolioTableRows([
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
    ])

    expect(rows).toEqual([
      {
        id: 'portfolio-0',
        ticker: 'IBE.MC',
        country: 'ES',
        shares: '1000',
        priceLocal: '21,9',
        dayChange: '0,74%',
        dividendYield: '2,51%',
        marketValueBase: '21900',
        portfolioWeight: '81,52%',
        annualDividendBase: '550,00',
        incomeWeight: '82,89%',
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
})
