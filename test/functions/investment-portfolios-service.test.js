import { describe, expect, it, vi } from 'vitest'
import {
  PORTFOLIO_CACHE_TTL_MS,
  canonicalGoogleSheetsUrl,
  portfolioCacheIsFresh,
  syncInvestmentPortfolio,
  syncWorkspaceInvestmentPortfolios,
  updateInvestmentPortfolio,
} from '../../functions/features/investment-portfolios/service.js'

describe('investment portfolio synchronization', () => {
  it('accepts canonical Google Sheets URLs and rejects other sources', () => {
    expect(
      canonicalGoogleSheetsUrl(
        ' https://docs.google.com/spreadsheets/d/sheet_123/edit?usp=sharing#gid=42 ',
      ),
    ).toBe('https://docs.google.com/spreadsheets/d/sheet_123/edit?usp=sharing')
    expect(() => canonicalGoogleSheetsUrl('https://example.com/spreadsheets/d/sheet/edit')).toThrow(
      'A valid Google Sheets URL is required',
    )
  })

  it('validates and synchronizes a Sheet before connecting it', async () => {
    const { firestore, writes } = createFirestore({ currentValue: 100 })
    const fetchSpreadsheet = sheetFetch({
      portfolioValue: '27.693,16',
      grossDividends: '800',
      netDividends: '682,47',
    })
    const rebuildProjection = vi.fn(async () => ({ status: 'rebuilt' }))

    const result = await updateInvestmentPortfolio(
      firestore,
      {
        workspaceId: 'workspace-a',
        userId: 'member-a',
        assetId: 'investment-a',
        spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet_123/edit',
      },
      fetchSpreadsheet,
      rebuildProjection,
      () => 1_000,
    )

    expect(result).toMatchObject({
      currentValue: 27693.16,
      summary: {
        baseCurrency: 'EUR',
        totalPortfolioValue: 27693.16,
        totalDividendsReceived: 800,
        annualDividendIncome: 682.47,
      },
      holdings: [expect.objectContaining({ ticker: 'IBE.MC', marketValueBase: 21900 })],
      cacheStatus: 'refreshed',
      financialSections: ['assets'],
    })
    expect(result.portfolio.cache).toMatchObject({
      lastCheckedAt: 1_000,
      refreshAfter: 1_000 + PORTFOLIO_CACHE_TTL_MS,
    })
    expect(writes).toContainEqual(
      expect.objectContaining({
        path: 'workspaces/workspace-a/modelAssets/investment-a',
        data: expect.objectContaining({
          currentValue: 27693.16,
          'detail.portfolio': expect.objectContaining({
            schemaVersion: 2,
            spreadsheetId: 'sheet_123',
          }),
        }),
      }),
    )
    expect(rebuildProjection).toHaveBeenCalledWith(
      firestore,
      'workspace-a',
      expect.any(Number),
      { sections: ['assets'] },
    )
  })

  it('does not replace an existing connection when the new Sheet is invalid', async () => {
    const existing = canonicalPortfolio({ refreshAfter: 0 })
    const { firestore, writes } = createFirestore({ portfolio: existing, currentValue: 1000 })

    await expect(
      updateInvestmentPortfolio(
        firestore,
        {
          workspaceId: 'workspace-a',
          userId: 'member-a',
          assetId: 'investment-a',
          spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/broken/edit',
        },
        async () => ({ ok: false, status: 403 }),
      ),
    ).rejects.toThrow('Portfolio tab returned HTTP 403')
    expect(writes).toHaveLength(1)
    expect(writes[0].data).not.toHaveProperty('currentValue')
    expect(writes[0].data).not.toHaveProperty('detail.portfolio')
    expect(writes[0].data['detail.portfolio.sync']).toMatchObject({
      lastErrorMessage: 'The Portfolio tab returned HTTP 403',
    })
  })

  it('returns a fresh cache without reading Google or writing Firestore', async () => {
    const portfolio = canonicalPortfolio({ refreshAfter: 20_000 })
    const { firestore, writes } = createFirestore({ portfolio, currentValue: 1000 })
    const fetchSpreadsheet = vi.fn()
    const rebuildProjection = vi.fn()

    const result = await syncInvestmentPortfolio(
      firestore,
      { workspaceId: 'workspace-a', userId: 'member-a', assetId: 'investment-a' },
      fetchSpreadsheet,
      rebuildProjection,
      () => 10_000,
    )

    expect(result).toMatchObject({ cacheStatus: 'fresh', holdings: portfolio.cache.holdings })
    expect(fetchSpreadsheet).not.toHaveBeenCalled()
    expect(rebuildProjection).not.toHaveBeenCalled()
    expect(writes).toEqual([])
  })

  it('refreshes stale metadata but skips financial writes and rebuilds when values match', async () => {
    const portfolio = canonicalPortfolio({ refreshAfter: 5_000 })
    const { firestore, writes } = createFirestore({ portfolio, currentValue: 1000 })
    const rebuildProjection = vi.fn()

    const result = await syncInvestmentPortfolio(
      firestore,
      { workspaceId: 'workspace-a', userId: 'member-a', assetId: 'investment-a' },
      sheetFetch(),
      rebuildProjection,
      () => 10_000,
    )

    expect(result).toMatchObject({ contentChanged: false, financialSections: [] })
    expect(writes).toHaveLength(1)
    expect(writes[0].data).not.toHaveProperty('currentValue')
    expect(rebuildProjection).not.toHaveBeenCalled()
  })

  it('updates only Income and rebuilds its section when net dividends change', async () => {
    const portfolio = canonicalPortfolio({ refreshAfter: 0 })
    const { firestore, writes } = createFirestore({
      portfolio,
      currentValue: 1000,
      linkedIncome: [
        {
          id: 'dividends-a',
          categoryId: 'investments',
          subcategoryId: 'dividends',
          portfolioAssetId: 'investment-a',
          calculation: { mode: 'recurring', amount: 90, frequency: 'yearly' },
        },
      ],
    })
    const rebuildProjection = vi.fn(async () => ({ status: 'rebuilt' }))

    const result = await syncInvestmentPortfolio(
      firestore,
      { workspaceId: 'workspace-a', userId: 'member-a', assetId: 'investment-a', force: true },
      sheetFetch({ netDividends: '120' }),
      rebuildProjection,
      () => 10_000,
    )

    expect(result.financialSections).toEqual(['income'])
    expect(writes).toContainEqual(
      expect.objectContaining({
        path: 'workspaces/workspace-a/modelIncome/dividends-a',
        data: expect.objectContaining({
          calculation: { mode: 'recurring', amount: 120, frequency: 'yearly' },
        }),
      }),
    )
    expect(rebuildProjection).toHaveBeenCalledWith(
      firestore,
      'workspace-a',
      expect.any(Number),
      { sections: ['income'] },
    )
  })

  it('imports a valid valuation while preserving dividend data after a formula error', async () => {
    const portfolio = canonicalPortfolio({ refreshAfter: 0 })
    const { firestore, writes } = createFirestore({
      portfolio,
      currentValue: 1000,
      linkedIncome: [
        {
          id: 'dividends-a',
          categoryId: 'investments',
          subcategoryId: 'dividends',
          portfolioAssetId: 'investment-a',
          calculation: { mode: 'recurring', amount: 100, frequency: 'yearly' },
        },
      ],
    })
    const rebuildProjection = vi.fn(async () => ({ status: 'rebuilt' }))

    const result = await syncInvestmentPortfolio(
      firestore,
      { workspaceId: 'workspace-a', userId: 'member-a', assetId: 'investment-a', force: true },
      sheetFetch({ portfolioValue: '2.000', netDividends: '#DIV/0!' }),
      rebuildProjection,
      () => 10_000,
    )

    expect(result).toMatchObject({
      status: 'partial',
      currentValue: 2000,
      summary: { annualDividendIncome: 100 },
    })
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ scope: 'summary', field: 'annualDividendIncome' }),
    )
    expect(writes.find((write) => write.path.endsWith('dividends-a'))).toBeUndefined()
    expect(rebuildProjection).toHaveBeenCalledWith(
      firestore,
      'workspace-a',
      expect.any(Number),
      { sections: ['assets'] },
    )
  })

  it('preserves the previous valuation when the Summary portfolio value is invalid', async () => {
    const { firestore, writes } = createFirestore({
      portfolio: canonicalPortfolio({ refreshAfter: 0 }),
      currentValue: 1200,
    })

    const result = await syncInvestmentPortfolio(
      firestore,
      { workspaceId: 'workspace-a', userId: 'member-a', assetId: 'investment-a', force: true },
      sheetFetch({ portfolioValue: '#REF!' }),
      vi.fn(),
      () => 10_000,
    )

    expect(result).toMatchObject({ status: 'partial', currentValue: 1200 })
    const portfolioWrite = writes.find((write) => write.data?.['detail.portfolio'])
    expect(portfolioWrite.data).not.toHaveProperty('currentValue')
  })

  it('refreshes holdings from Portfolio when the Summary tab is temporarily unavailable', async () => {
    const { firestore } = createFirestore({
      portfolio: canonicalPortfolio({ refreshAfter: 0 }),
      currentValue: 1000,
    })
    const fetchSpreadsheet = vi.fn(async (url) =>
      url.searchParams.get('sheet') === 'Summary'
        ? { ok: false, status: 503, text: async () => '' }
        : { ok: true, text: async () => portfolioCsv() },
    )

    const result = await syncInvestmentPortfolio(
      firestore,
      { workspaceId: 'workspace-a', userId: 'member-a', assetId: 'investment-a', force: true },
      fetchSpreadsheet,
      vi.fn(),
      () => 10_000,
    )

    expect(result).toMatchObject({
      status: 'partial',
      currentValue: 1000,
      summary: { totalPortfolioValue: 1000, annualDividendIncome: 100 },
    })
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ scope: 'summary', code: 'source_unavailable' }),
    )
  })

  it('treats a valid zero dividend as data and updates linked Income', async () => {
    const { firestore, writes } = createFirestore({
      portfolio: canonicalPortfolio({ refreshAfter: 0 }),
      currentValue: 1000,
      linkedIncome: [
        {
          id: 'dividends-a',
          categoryId: 'investments',
          subcategoryId: 'dividends',
          portfolioAssetId: 'investment-a',
          calculation: { mode: 'recurring', amount: 100, frequency: 'yearly' },
        },
      ],
    })

    const result = await syncInvestmentPortfolio(
      firestore,
      { workspaceId: 'workspace-a', userId: 'member-a', assetId: 'investment-a', force: true },
      sheetFetch({ netDividends: '0' }),
      vi.fn(async () => ({ status: 'rebuilt' })),
      () => 10_000,
    )

    expect(result.status).toBe('success')
    expect(writes.find((write) => write.path.endsWith('dividends-a')).data.calculation.amount).toBe(0)
  })

  it('preserves the last valid holding field when one formula fails', async () => {
    const { firestore } = createFirestore({
      portfolio: canonicalPortfolio({ refreshAfter: 0 }),
      currentValue: 1000,
    })
    const portfolioBody = portfolioCsv().replace('"21,9"', '"#DIV/0!"')

    const result = await syncInvestmentPortfolio(
      firestore,
      { workspaceId: 'workspace-a', userId: 'member-a', assetId: 'investment-a', force: true },
      sheetFetch({ portfolioBody }),
      vi.fn(),
      () => 10_000,
    )

    expect(result.status).toBe('partial')
    expect(result.holdings[0].priceLocal).toBe(21.9)
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ ticker: 'IBE.MC', field: 'priceLocal', code: 'formula_error' }),
    )
  })

  it('does not rebuild Income when dividends change without a linked Income', async () => {
    const { firestore } = createFirestore({
      portfolio: canonicalPortfolio({ refreshAfter: 0 }),
      currentValue: 1000,
    })
    const rebuildProjection = vi.fn()
    const result = await syncInvestmentPortfolio(
      firestore,
      { workspaceId: 'workspace-a', userId: 'member-a', assetId: 'investment-a', force: true },
      sheetFetch({ netDividends: '120' }),
      rebuildProjection,
      () => 10_000,
    )
    expect(result.financialSections).toEqual([])
    expect(rebuildProjection).not.toHaveBeenCalled()
  })

  it('retries a pending financial rebuild even when source data matches', async () => {
    const portfolio = canonicalPortfolio({
      refreshAfter: 20_000,
      sync: { financialProjectionDirty: true, pendingSections: ['assets'] },
    })
    const { firestore } = createFirestore({ portfolio, currentValue: 1000 })
    const rebuildProjection = vi.fn(async () => ({ status: 'rebuilt' }))

    const result = await syncInvestmentPortfolio(
      firestore,
      { workspaceId: 'workspace-a', userId: 'member-a', assetId: 'investment-a' },
      sheetFetch(),
      rebuildProjection,
      () => 10_000,
    )

    expect(result.financialSections).toEqual(['assets'])
    expect(rebuildProjection).toHaveBeenCalledOnce()
  })

  it('keeps the financial projection marked dirty when its rebuild fails', async () => {
    const { firestore, writes } = createFirestore({
      portfolio: canonicalPortfolio({ refreshAfter: 0 }),
      currentValue: 1000,
    })
    const rebuildProjection = vi.fn(async () => {
      throw new Error('projection unavailable')
    })

    await expect(
      syncInvestmentPortfolio(
        firestore,
        { workspaceId: 'workspace-a', userId: 'member-a', assetId: 'investment-a', force: true },
        sheetFetch({ portfolioValue: '2.000,00' }),
        rebuildProjection,
        () => 10_000,
      ),
    ).rejects.toThrow('projection unavailable')

    const portfolioWrite = writes.find((write) => write.data?.['detail.portfolio'])
    expect(portfolioWrite.data['detail.portfolio'].sync).toMatchObject({
      financialProjectionDirty: true,
      pendingSections: ['assets'],
    })
  })

  it('disconnects the Sheet and preserves linked Income as a manual value', async () => {
    const { firestore, writes } = createFirestore({
      portfolio: canonicalPortfolio(),
      linkedIncome: [
        {
          id: 'dividends-a',
          categoryId: 'investments',
          subcategoryId: 'dividends',
          portfolioAssetId: 'investment-a',
          calculation: { mode: 'recurring', amount: 100, frequency: 'yearly' },
        },
      ],
    })

    await expect(
      updateInvestmentPortfolio(firestore, {
        workspaceId: 'workspace-a',
        userId: 'member-a',
        assetId: 'investment-a',
        spreadsheetUrl: null,
      }),
    ).resolves.toEqual({ portfolio: null })

    expect(writes).toContainEqual(
      expect.objectContaining({
        path: 'workspaces/workspace-a/modelIncome/dividends-a',
        data: expect.objectContaining({ portfolioAssetId: null }),
      }),
    )
    expect(writes.find((write) => write.path.endsWith('dividends-a')).data).not.toHaveProperty(
      'calculation',
    )
  })

  it('rejects non-members and non-investment assets', async () => {
    const nonMember = createFirestore({ memberIds: ['other'] })
    await expect(
      updateInvestmentPortfolio(nonMember.firestore, {
        workspaceId: 'workspace-a',
        userId: 'member-a',
        assetId: 'investment-a',
        spreadsheetUrl: null,
      }),
    ).rejects.toThrow('Workspace membership is required')

    const cashAsset = createFirestore({ categoryId: 'cash' })
    await expect(
      updateInvestmentPortfolio(cashAsset.firestore, {
        workspaceId: 'workspace-a',
        userId: 'member-a',
        assetId: 'investment-a',
        spreadsheetUrl: null,
      }),
    ).rejects.toThrow('Investment not found')
  })

  it('recognizes cache freshness from the centralized TTL metadata', () => {
    expect(portfolioCacheIsFresh(canonicalPortfolio({ refreshAfter: 101 }), 100)).toBe(true)
    expect(portfolioCacheIsFresh(canonicalPortfolio({ refreshAfter: 100 }), 100)).toBe(false)
  })

  it('synchronizes connected portfolios when a workspace is opened', async () => {
    const { firestore } = createFirestore({
      portfolio: canonicalPortfolio({ refreshAfter: 999_999 }),
      currentValue: 1000,
    })
    const fetchSpreadsheet = sheetFetch({ portfolioValue: '1.250,00' })

    const result = await syncWorkspaceInvestmentPortfolios(
      firestore,
      { workspaceId: 'workspace-a', userId: 'member-a', force: true },
      fetchSpreadsheet,
      vi.fn(async () => ({ status: 'rebuilt' })),
      () => 10_000,
    )

    expect(result.failures).toEqual([])
    expect(result.results).toEqual([
      expect.objectContaining({ assetId: 'investment-a', currentValue: 1250 }),
    ])
    expect(fetchSpreadsheet).toHaveBeenCalled()
  })

  it('reuses fresh connected portfolio caches during automatic workspace synchronization', async () => {
    const { firestore } = createFirestore({
      portfolio: canonicalPortfolio({ refreshAfter: 999_999 }),
      currentValue: 1000,
    })
    const fetchSpreadsheet = sheetFetch({ portfolioValue: '1.250,00' })

    const result = await syncWorkspaceInvestmentPortfolios(
      firestore,
      { workspaceId: 'workspace-a', userId: 'member-a' },
      fetchSpreadsheet,
      vi.fn(async () => ({ status: 'rebuilt' })),
      () => 10_000,
    )

    expect(result.failures).toEqual([])
    expect(result.results).toEqual([
      expect.objectContaining({
        assetId: 'investment-a',
        cacheStatus: 'fresh',
        currentValue: 1000,
      }),
    ])
    expect(fetchSpreadsheet).not.toHaveBeenCalled()
  })

  it('fails a required workspace synchronization when Google cannot be read', async () => {
    const { firestore } = createFirestore({ portfolio: canonicalPortfolio() })

    await expect(
      syncWorkspaceInvestmentPortfolios(
        firestore,
        { workspaceId: 'workspace-a', throwOnError: true },
        async () => ({ ok: false, status: 503 }),
      ),
    ).rejects.toThrow('Portfolio tab returned HTTP 503')
  })
})

function canonicalPortfolio({
  refreshAfter = 20_000,
  sync = { financialProjectionDirty: false, pendingSections: [] },
} = {}) {
  return {
    schemaVersion: 2,
    source: 'google_sheets',
    spreadsheetId: 'sheet_123',
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet_123/edit',
    summary: {
      baseCurrency: 'EUR',
      totalPortfolioValue: 1000,
      totalDividendsReceived: 125,
      annualDividendIncome: 100,
    },
    cache: {
      schemaVersion: 2,
      holdings: normalizedHoldings(),
      lastCheckedAt: 1_000,
      dataUpdatedAt: 1_000,
      refreshAfter,
    },
    sync,
  }
}

function normalizedHoldings() {
  return [
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
  ]
}

function sheetFetch({
  portfolioValue = '1.000,00',
  grossDividends = '125,00',
  netDividends = '100,00',
  portfolioBody = null,
} = {}) {
  return vi.fn(async (url) => ({
    ok: true,
    text: async () =>
      url.searchParams.get('sheet') === 'Summary'
        ? summaryCsv('EUR', portfolioValue, grossDividends, netDividends)
        : portfolioBody || portfolioCsv(),
  }))
}

function portfolioCsv() {
  return [
    [
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
    ],
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
      '550,00',
      '82,89%',
    ],
  ]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n')
}

function summaryCsv(currency, portfolioValue, grossDividends, netDividends) {
  return [
    ['Base currency', currency],
    ['Total Portofolio Value', portfolioValue],
    ['Total dividends received', grossDividends],
    ['Net dividends received', netDividends],
  ]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n')
}

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`
}

function createFirestore({
  portfolio,
  currentValue = 0,
  memberIds = ['member-a'],
  categoryId = 'investment',
  linkedIncome = [],
} = {}) {
  const writes = []
  const records = {
    'workspaces/workspace-a': { memberIds },
    'workspaces/workspace-a/modelAssets/investment-a': {
      categoryId,
      currentValue,
      detail: { notes: 'preserved', ...(portfolio ? { portfolio } : {}) },
    },
  }
  linkedIncome.forEach((income) => {
    records[`workspaces/workspace-a/modelIncome/${income.id}`] = income
  })

  function reference(path) {
    return {
      path,
      async get() {
        const data = records[path]
        return { exists: Boolean(data), data: () => data }
      },
      async update(data) {
        writes.push({ path, data })
        records[path] = { ...(records[path] || {}), ...data }
      },
      where(field, operator, value) {
        return {
          path: `${path}?${field}${operator}${value}`,
          async get() {
            const prefix = `${path}/`
            return {
              docs: Object.entries(records)
                .filter(
                  ([recordPath, data]) =>
                    recordPath.startsWith(prefix) &&
                    !recordPath.slice(prefix.length).includes('/') &&
                    data?.[field] === value,
                )
                .map(([recordPath, data]) => ({
                  id: recordPath.slice(prefix.length),
                  data: () => data,
                  ref: reference(recordPath),
                })),
            }
          },
        }
      },
      doc(id) {
        return reference(`${path}/${id}`)
      },
      collection(name) {
        return reference(`${path}/${name}`)
      },
    }
  }

  const firestore = {
    collection(name) {
      return reference(name)
    },
    batch() {
      const operations = []
      return {
        update(target, data) {
          operations.push({ target, data })
        },
        async commit() {
          for (const { target, data } of operations) await target.update(data)
        },
      }
    },
  }
  return { firestore, writes }
}
