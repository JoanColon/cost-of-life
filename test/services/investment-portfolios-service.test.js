import { describe, expect, it, vi } from 'vitest'

vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn(() => vi.fn()) }))
vi.mock('@/firebase/firebase', () => ({ functions: {} }))

import {
  investmentPortfolioCache,
  investmentPortfolioCacheIsFresh,
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

  it('reads a normalized portfolio cache and evaluates its TTL', () => {
    const portfolio = {
      schemaVersion: 2,
      summary: { baseCurrency: 'EUR' },
      cache: {
        schemaVersion: 2,
        holdings: [{ ticker: 'VWCE' }],
        lastCheckedAt: 100,
        refreshAfter: 200,
      },
      sync: { financialProjectionDirty: false },
    }
    expect(investmentPortfolioCache(portfolio)).toMatchObject({
      holdings: [{ ticker: 'VWCE' }],
      summary: { baseCurrency: 'EUR' },
    })
    expect(investmentPortfolioCacheIsFresh(portfolio, 199)).toBe(true)
    expect(investmentPortfolioCacheIsFresh(portfolio, 200)).toBe(false)
  })

  it('ignores invalid or financially dirty caches', () => {
    expect(investmentPortfolioCache({ schemaVersion: 2, cache: { schemaVersion: 2 } })).toBeNull()
    const dirty = {
      schemaVersion: 2,
      summary: {},
      cache: { schemaVersion: 2, holdings: [], refreshAfter: 200 },
      sync: { financialProjectionDirty: true },
    }
    expect(investmentPortfolioCacheIsFresh(dirty, 100)).toBe(false)
  })
})
