import { describe, expect, it, vi } from 'vitest'
import investmentPortfolioService from '../../functions/services/investment-portfolios.js'

const {
  canonicalGoogleSheetsUrl,
  parseCsv,
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
    const { firestore } = createFirestore({
      portfolio: {
        source: 'google_sheets',
        spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet_123/edit?usp=sharing',
      },
    })
    const fetchSpreadsheet = vi.fn(async () => ({
      ok: true,
      text: async () => 'Ticker,Value\r\nVWCE,"1,250"',
    }))

    await expect(
      readInvestmentPortfolioSheet(
        firestore,
        { workspaceId: 'workspace-a', userId: 'member-a', assetId: 'investment-a' },
        fetchSpreadsheet,
      ),
    ).resolves.toEqual({
      sheet: 'Portfolio',
      rows: [
        ['Ticker', 'Value'],
        ['VWCE', '1,250'],
      ],
    })

    const requestedUrl = fetchSpreadsheet.mock.calls[0][0]
    expect(requestedUrl.hostname).toBe('docs.google.com')
    expect(requestedUrl.pathname).toBe('/spreadsheets/d/sheet_123/gviz/tq')
    expect(requestedUrl.searchParams.get('sheet')).toBe('Portfolio')
  })

  it('parses a CSV sheet with quotes, commas, line breaks and empty cells', () => {
    expect(parseCsv('Name,Notes,Value\r\nFund,"A ""quoted""\nvalue",""')).toEqual([
      ['Name', 'Notes', 'Value'],
      ['Fund', 'A "quoted"\nvalue', ''],
    ])
    expect(parseCsv('')).toEqual([])
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

function createFirestore({ portfolio, memberIds = ['member-a'], categoryId = 'investment' } = {}) {
  const writes = []
  const records = {
    'workspaces/workspace-a': { memberIds },
    'workspaces/workspace-a/modelAssets/investment-a': {
      categoryId,
      detail: { notes: 'preserved', ...(portfolio ? { portfolio } : {}) },
    },
  }

  function reference(path) {
    return {
      path,
      async get() {
        const data = records[path]
        return { exists: Boolean(data), data: () => data }
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
