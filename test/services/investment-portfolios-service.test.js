import { describe, expect, it, vi } from 'vitest'

vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn(() => vi.fn()) }))
vi.mock('@/firebase/firebase', () => ({ functions: {} }))

import {
  investmentPortfolioSnapshot,
  isGoogleSheetsUrl,
} from '../../src/services/firebase/investment-portfolios.service.js'

describe('investment portfolio client validation', () => {
  it('recognizes supported Google Sheets links', () => {
    expect(
      isGoogleSheetsUrl('https://docs.google.com/spreadsheets/d/sheet_123/edit?usp=sharing'),
    ).toBe(true)
    expect(isGoogleSheetsUrl('https://docs.google.com/spreadsheets/u/0/d/sheet_123/edit')).toBe(
      true,
    )
  })

  it('rejects other URLs', () => {
    expect(isGoogleSheetsUrl('https://example.com/spreadsheets/d/sheet/edit')).toBe(false)
    expect(isGoogleSheetsUrl('javascript:alert(1)')).toBe(false)
  })

  it('reads and validates a persisted portfolio snapshot', () => {
    expect(
      investmentPortfolioSnapshot({
        snapshot: {
          schemaVersion: 1,
          sheet: 'Portfolio',
          rowsJson: '[["Ticker"],["VWCE"]]',
          summary: { baseCurrency: 'EUR' },
        },
      }),
    ).toMatchObject({
      rows: [['Ticker'], ['VWCE']],
      summary: { baseCurrency: 'EUR' },
    })
  })

  it('ignores an invalid persisted snapshot', () => {
    expect(
      investmentPortfolioSnapshot({ snapshot: { schemaVersion: 1, rowsJson: '{invalid' } }),
    ).toBeNull()
  })
})
