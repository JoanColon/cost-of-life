import { describe, expect, it } from 'vitest'
import schema from '../../functions/services/investment-portfolio-schema.js'

const { normalizeHoldings, normalizeSummary, parseCsv, parseLocalizedNumber } = schema

describe('Google Sheets investment portfolio schema', () => {
  it('parses CSV quotes, commas, line breaks and empty cells', () => {
    expect(parseCsv('Name,Notes,Value\r\nFund,"A ""quoted""\nvalue",""')).toEqual([
      ['Name', 'Notes', 'Value'],
      ['Fund', 'A "quoted"\nvalue', ''],
    ])
  })

  it('normalizes localized Summary values', () => {
    expect(
      normalizeSummary([
        ['Base currency', 'EUR'],
        ['Total Portofolio Value', '27.693,16 €'],
        ['Total dividends received', '800,00 €'],
        ['Net dividends received', '682,47 €'],
      ]),
    ).toEqual({
      baseCurrency: 'EUR',
      totalPortfolioValue: 27693.16,
      totalDividendsReceived: 800,
      annualDividendIncome: 682.47,
    })
  })

  it('supports the localized number formats used by the template', () => {
    expect(parseLocalizedNumber('27.693,16 €')).toBe(27693.16)
    expect(parseLocalizedNumber('27,693.16 USD')).toBe(27693.16)
    expect(parseLocalizedNumber('1.000')).toBe(1000)
    expect(parseLocalizedNumber('-0,74%')).toBe(-0.74)
  })

  it('maps Portfolio columns into typed canonical holdings', () => {
    const holdings = normalizeHoldings([
      portfolioHeaders(),
      [
        'IBE.MC',
        'ES',
        'Utilities',
        'Diversified Utilities',
        'EUR',
        '1000',
        '21,9',
        '0,74%',
        '2,51%',
        '21900',
        '81,52%',
        '550',
        '82,89%',
      ],
    ])
    expect(holdings).toEqual([
      {
        id: 'portfolio-0',
        ticker: 'IBE.MC',
        country: 'ES',
        sector: 'Utilities',
        industry: 'Diversified Utilities',
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
    ])
  })

  it('keeps older portfolio templates compatible when classifications are absent', () => {
    const holdings = normalizeHoldings([
      [
        'Ticker',
        'Country',
        'Currency',
        'Shares',
        'Price (local)',
        'Day Change %',
        'Dividend yield (local)',
        'Market value (base)',
        'Portfolio %',
        'Annual dividend (base)',
        'Income %',
      ],
      ['ETF', 'IE', 'EUR', '1', '10', '0', '0', '10', '100', '0', '0'],
    ])

    expect(holdings[0]).toMatchObject({ sector: '', industry: '' })
  })

  it('rejects incomplete templates instead of using fallback indexes', () => {
    expect(() => normalizeHoldings([['Ticker', 'Country'], ['IBE.MC', 'ES']])).toThrow(
      'Portfolio is missing columns',
    )
    expect(() => normalizeSummary([['Base currency', 'EUR']])).toThrow('invalid Summary')
  })
})

function portfolioHeaders() {
  return [
    'Ticker',
    'Country',
    'Sector',
    'Industry',
    'Currency',
    'Shares',
    'Price (local)',
    'Day Change %',
    'Dividend yield (local)',
    'Market value (base)',
    'Portfolio %',
    'Annual dividend (base)',
    'Income %',
  ]
}
