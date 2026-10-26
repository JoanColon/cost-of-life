import { describe, expect, it, vi } from 'vitest'
import investmentPortfolioService from '../../functions/services/investment-portfolios.js'

const {
  canonicalGoogleSheetsUrl,
  parseCsv,
  parseGoogleVisualizationValues,
  portfolioAnnualDividendIncome,
  readInvestmentPortfolioSheet,
  updateInvestmentPortfolio,
} = investmentPortfolioService

describe('investment portfolio service', () => {
  it('accepts Google Sheets URLs and removes fragments', () => {
    expect(
      canonicalGoogleSheetsUrl(
        ' https://docs.google.com/spreadsheets/d/sheet_123/edit?usp=sharing#gid=42 ',
      ),
    ).toBe('https://docs.google.com/spreadsheets/d/sheet_123/edit?usp=sharing')
  })

  it.each([
    'https://example.com/spreadsheets/d/sheet/edit',
    'http://docs.google.com/spreadsheets/d/sheet/edit',
    'https://docs.google.com/document/d/document/edit',
    'not a url',
  ])('rejects invalid spreadsheet URL %s', (url) => {
    expect(() => canonicalGoogleSheetsUrl(url)).toThrow('A valid Google Sheets URL is required')
  })

  it('updates only the investment detail without touching financial projections', async () => {
    const { firestore, writes } = createFirestore()

    const result = await updateInvestmentPortfolio(firestore, {
      workspaceId: 'workspace-a',
      userId: 'member-a',
      assetId: 'investment-a',
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123/edit?usp=sharing',
    })

    expect(result.portfolio).toEqual({
      source: 'google_sheets',
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123/edit?usp=sharing',
    })
    expect(writes).toHaveLength(1)
    expect(writes[0]).toMatchObject({
      path: 'workspaces/workspace-a/modelAssets/investment-a',
      data: { detail: { notes: 'preserved', portfolio: result.portfolio }, updatedBy: 'member-a' },
    })
  })

  it('disconnects a portfolio while preserving other detail', async () => {
    const { firestore, writes } = createFirestore({
      portfolio: {
        source: 'google_sheets',
        spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet/edit',
      },
    })

    await expect(
      updateInvestmentPortfolio(firestore, {
        workspaceId: 'workspace-a',
        userId: 'member-a',
        assetId: 'investment-a',
        spreadsheetUrl: null,
      }),
    ).resolves.toEqual({ portfolio: null })
    expect(writes[0].data.detail).toEqual({ notes: 'preserved' })
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

  it('reads the Portfolio tab from the configured Google Sheet', async () => {
    const { firestore, writes } = createFirestore({
      portfolio: {
        source: 'google_sheets',
        spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet_123/edit?usp=sharing',
      },
    })
    const fetchSpreadsheet = vi.fn(async (url) => {
      const body =
        url.searchParams.get('sheet') === 'Summary'
          ? summaryCsv('EUR', '€27.693,16', '€682,47')
          : 'Ticker,Annual dividend (base)\r\nVWCE,"550,00"\r\nKO,"132,47"'
      return { ok: true, text: async () => body }
    })
    const rebuildProjection = vi.fn(async () => ({ status: 'rebuilt' }))

    await expect(
      readInvestmentPortfolioSheet(
        firestore,
        { workspaceId: 'workspace-a', userId: 'member-a', assetId: 'investment-a' },
        fetchSpreadsheet,
        rebuildProjection,
      ),
    ).resolves.toEqual({
      sheet: 'Portfolio',
      rows: [
        ['Ticker', 'Annual dividend (base)'],
        ['VWCE', '550,00'],
        ['KO', '132,47'],
      ],
      summary: {
        baseCurrency: 'EUR',
        totalPortfolioValue: 27693.16,
        totalDividendsReceived: 682.47,
        annualDividendIncome: 682.47,
      },
    })

    const requestedUrls = fetchSpreadsheet.mock.calls.map(([url]) => url)
    expect(requestedUrls).toHaveLength(2)
    expect(requestedUrls[0].hostname).toBe('docs.google.com')
    expect(requestedUrls[0].pathname).toBe('/spreadsheets/d/sheet_123/gviz/tq')
    expect(requestedUrls[0].searchParams.get('sheet')).toBe('Portfolio')
    expect(requestedUrls[1].searchParams.get('sheet')).toBe('Summary')
    expect(requestedUrls[1].searchParams.has('range')).toBe(false)
    expect(requestedUrls[1].searchParams.get('tqx')).toBe('out:csv')
    expect(writes).toContainEqual(
      expect.objectContaining({
        path: 'workspaces/workspace-a/modelAssets/investment-a',
        data: expect.objectContaining({
        currentValue: 27693.16,
        'detail.portfolio.summary': {
          baseCurrency: 'EUR',
          totalPortfolioValue: 27693.16,
          totalDividendsReceived: 682.47,
          annualDividendIncome: 682.47,
          syncedAt: expect.anything(),
        },
        'detail.portfolio.snapshot': expect.objectContaining({
          schemaVersion: 1,
          sheet: 'Portfolio',
          rowsJson: expect.stringContaining('VWCE'),
          summary: expect.objectContaining({ totalPortfolioValue: 27693.16 }),
        }),
        updatedBy: 'member-a',
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

  it('parses a CSV sheet with quotes, commas, line breaks and empty cells', () => {
    expect(parseCsv('Name,Notes,Value\r\nFund,"A ""quoted""\nvalue",""')).toEqual([
      ['Name', 'Notes', 'Value'],
      ['Fund', 'A "quoted"\nvalue', ''],
    ])
    expect(parseCsv('')).toEqual([])
  })

  it('extracts raw values from a Google Visualization response', () => {
    expect(parseGoogleVisualizationValues(googleVisualizationResponse(['EUR']))).toEqual(['EUR'])
    expect(
      parseGoogleVisualizationValues(googleVisualizationResponse([27693.16, 682.47])),
    ).toEqual([27693.16, 682.47])
  })

  it('sums annual dividends using localized sheet values', () => {
    expect(
      portfolioAnnualDividendIncome([
        ['Ticker', 'Annual dividend (base)'],
        ['IBE.MC', '550,00'],
        ['KO', '132.47'],
      ]),
    ).toBe(682.47)
  })

  it('updates income linked to the portfolio when annual dividends change', async () => {
    const { firestore, writes } = createFirestore({
      portfolio: {
        source: 'google_sheets',
        spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet_123/edit',
      },
      linkedIncome: [
        {
          id: 'dividends-a',
          categoryId: 'investments',
          subcategoryId: 'dividends',
          portfolioAssetId: 'investment-a',
        },
      ],
    })
    const rebuildProjection = vi.fn(async () => ({ status: 'rebuilt' }))
    const fetchSpreadsheet = vi.fn(async (url) => {
      const body =
        url.searchParams.get('sheet') === 'Summary'
          ? summaryCsv('EUR', '30,000.00', '700.00')
          : 'Ticker,Annual dividend (base)\r\nVWCE,720'
      return { ok: true, text: async () => body }
    })

    await readInvestmentPortfolioSheet(
      firestore,
      { workspaceId: 'workspace-a', userId: 'member-a', assetId: 'investment-a' },
      fetchSpreadsheet,
      rebuildProjection,
    )

    expect(writes).toContainEqual(
      expect.objectContaining({
        path: 'workspaces/workspace-a/modelIncome/dividends-a',
        data: expect.objectContaining({
          calculation: { mode: 'recurring', amount: 720, frequency: 'yearly' },
        }),
      }),
    )
    expect(rebuildProjection).toHaveBeenCalledWith(
      firestore,
      'workspace-a',
      expect.any(Number),
      { sections: ['assets', 'income'] },
    )
  })

  it('reports an inaccessible configured Sheet', async () => {
    const { firestore } = createFirestore({
      portfolio: {
        source: 'google_sheets',
        spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/private-sheet/edit',
      },
    })

    await expect(
      readInvestmentPortfolioSheet(
        firestore,
        { workspaceId: 'workspace-a', userId: 'member-a', assetId: 'investment-a' },
        async () => ({ ok: false, status: 403 }),
      ),
    ).rejects.toThrow('The Portfolio tab returned HTTP 403')
  })

  it('retries the complete Google Sheets read after a transient failure', async () => {
    const { firestore } = createFirestore({
      portfolio: {
        source: 'google_sheets',
        spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet_123/edit',
      },
    })
    const fetchSpreadsheet = vi.fn(async (url) => {
      if (fetchSpreadsheet.mock.calls.length === 1) throw new Error('temporary failure')
      return {
        ok: true,
        text: async () =>
          url.searchParams.get('sheet') === 'Summary'
            ? summaryCsv('EUR', '1,000.00', '20.00')
            : 'Ticker,Annual dividend (base)\r\nVWCE,25',
      }
    })

    await expect(
      readInvestmentPortfolioSheet(
        firestore,
        { workspaceId: 'workspace-a', userId: 'member-a', assetId: 'investment-a' },
        fetchSpreadsheet,
        vi.fn(),
      ),
    ).resolves.toMatchObject({ summary: { totalPortfolioValue: 1000 } })
    expect(fetchSpreadsheet).toHaveBeenCalledTimes(4)
  })

  it('reads localized values from the complete Summary tab by label', async () => {
    const { firestore } = createFirestore({
      portfolio: {
        source: 'google_sheets',
        spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet_123/edit',
      },
    })
    const fetchSpreadsheet = vi.fn(async (url) => ({
      ok: true,
      text: async () =>
        url.searchParams.get('sheet') === 'Summary'
          ? summaryCsv('EUR', '27.693,16 €', '682,47 €', 'Portfolio 2026')
          : 'Ticker,Annual dividend (base)\r\nVWCE,"682,47"',
    }))

    await expect(
      readInvestmentPortfolioSheet(
        firestore,
        { workspaceId: 'workspace-a', userId: 'member-a', assetId: 'investment-a' },
        fetchSpreadsheet,
        vi.fn(),
      ),
    ).resolves.toMatchObject({
      summary: {
        baseCurrency: 'EUR',
        totalPortfolioValue: 27693.16,
        totalDividendsReceived: 682.47,
      },
    })
  })

  it('accepts a currency symbol and the shorter Currency label', async () => {
    const { firestore } = createFirestore({
      portfolio: {
        source: 'google_sheets',
        spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet_123/edit',
      },
    })
    const fetchSpreadsheet = vi.fn(async (url) => ({
      ok: true,
      text: async () =>
        url.searchParams.get('sheet') === 'Summary'
          ? summaryCsv('€', '27.693,16 €', '682,47 €').replace('Base currency', 'Currency')
          : 'Ticker,Annual dividend (base)\r\nVWCE,"682,47"',
    }))

    await expect(
      readInvestmentPortfolioSheet(
        firestore,
        { workspaceId: 'workspace-a', userId: 'member-a', assetId: 'investment-a' },
        fetchSpreadsheet,
        vi.fn(),
      ),
    ).resolves.toMatchObject({
      summary: {
        baseCurrency: 'EUR',
        totalPortfolioValue: 27693.16,
        totalDividendsReceived: 682.47,
      },
    })
  })
})

function createFirestore({
  portfolio,
  memberIds = ['member-a'],
  categoryId = 'investment',
  linkedIncome = [],
} = {}) {
  const writes = []
  const records = {
    'workspaces/workspace-a': { memberIds },
    'workspaces/workspace-a/modelAssets/investment-a': {
      categoryId,
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
          async get() {
            if (operator !== '==') return { docs: [] }
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
    async runTransaction(callback) {
      return callback({
        async get(target) {
          const data = records[target.path]
          return { exists: Boolean(data), data: () => data }
        },
        update(target, data) {
          writes.push({ path: target.path, data })
        },
      })
    },
  }

  return { firestore, writes }
}

function googleVisualizationResponse(values) {
  return `google.visualization.Query.setResponse(${JSON.stringify({
    version: '0.6',
    status: 'ok',
    table: { rows: values.map((value) => ({ c: [{ v: value }] })) },
  })});`
}

function summaryCsv(currency, totalPortfolioValue, totalDividendsReceived, name = 'My portfolio') {
  return [
    '"Cost of Life — Investment Sheet settings",""',
    '"","Value"',
    `"Base currency","${currency}"`,
    `"Portfolio name","${name}"`,
    `"Total Portofolio Value","${totalPortfolioValue}"`,
    `"Total dividends received","${totalDividendsReceived}"`,
  ].join('\r\n')
}
