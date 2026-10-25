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
      const range = url.searchParams.get('range')
      const body =
        range === 'B4'
          ? googleVisualizationResponse(['EUR'])
          : range === 'B6:B7'
            ? googleVisualizationResponse([27693.16, 682.47])
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
    expect(requestedUrls).toHaveLength(3)
    expect(requestedUrls[0].hostname).toBe('docs.google.com')
    expect(requestedUrls[0].pathname).toBe('/spreadsheets/d/sheet_123/gviz/tq')
    expect(requestedUrls[0].searchParams.get('sheet')).toBe('Portfolio')
    expect(requestedUrls[1].searchParams.get('sheet')).toBe('Summary')
    expect(requestedUrls[1].searchParams.get('range')).toBe('B4')
    expect(requestedUrls[2].searchParams.get('range')).toBe('B6:B7')
    expect(writes.at(-1)).toMatchObject({
      path: 'workspaces/workspace-a/modelAssets/investment-a',
      data: {
        currentValue: 27693.16,
        'detail.portfolio.summary': {
          baseCurrency: 'EUR',
          totalPortfolioValue: 27693.16,
          totalDividendsReceived: 682.47,
          annualDividendIncome: 682.47,
          syncedAt: expect.anything(),
        },
        updatedBy: 'member-a',
      },
    })
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
      const range = url.searchParams.get('range')
      const body =
        range === 'B4'
          ? googleVisualizationResponse(['EUR'])
          : range === 'B6:B7'
            ? googleVisualizationResponse([30000, 700])
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
        async () => ({ ok: false }),
      ),
    ).rejects.toThrow('The Google Sheet could not be read')
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
