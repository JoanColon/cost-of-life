const { FieldValue } = require('firebase-admin/firestore')
const { currentYear, rebuildFinancialYear } = require('./financial-years')

const GOOGLE_SHEETS_HOST = 'docs.google.com'
const SPREADSHEET_PATH = /^\/spreadsheets(?:\/u\/\d+)?\/d\/([A-Za-z0-9_-]+)(?:\/|$)/
const PORTFOLIO_SHEET_NAME = 'Portfolio'
const SUMMARY_SHEET_NAME = 'Summary'
const SHEET_READ_ATTEMPTS = 2
const SHEET_RETRY_DELAY_MS = 200
const GOOGLE_SHEET_TIMEOUT_MS = 25_000
const MAXIMUM_SNAPSHOT_ROWS_BYTES = 700_000

async function updateInvestmentPortfolio(
  firestore,
  { workspaceId, userId, assetId, spreadsheetUrl = null },
) {
  assertText(workspaceId, 'A workspace is required')
  assertText(userId, 'Authentication is required')
  assertText(assetId, 'An investment is required')

  const canonicalUrl = spreadsheetUrl == null ? null : canonicalGoogleSheetsUrl(spreadsheetUrl)
  const workspaceReference = firestore.collection('workspaces').doc(workspaceId)
  const assetReference = workspaceReference.collection('modelAssets').doc(assetId)

  return firestore.runTransaction(async (transaction) => {
    const [workspaceSnapshot, assetSnapshot] = await Promise.all([
      transaction.get(workspaceReference),
      transaction.get(assetReference),
    ])
    const workspace = workspaceSnapshot.data()
    const asset = assetSnapshot.data()

    if (
      !workspaceSnapshot.exists ||
      workspace?.deletionPendingAt ||
      !workspace?.memberIds?.includes(userId)
    ) {
      throw new Error('Workspace membership is required')
    }
    if (!assetSnapshot.exists || asset?.categoryId !== 'investment') {
      throw new Error('Investment not found')
    }

    const detail = isPlainObject(asset.detail) ? { ...asset.detail } : {}
    if (canonicalUrl) {
      detail.portfolio = { source: 'google_sheets', spreadsheetUrl: canonicalUrl }
    } else {
      delete detail.portfolio
    }

    transaction.update(assetReference, {
      detail,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: userId,
    })

    return { portfolio: detail.portfolio || null }
  })
}

async function readInvestmentPortfolioSheet(
  firestore,
  { workspaceId, userId, assetId },
  fetchImpl = fetch,
  rebuildFinancialYearImpl = rebuildFinancialYear,
) {
  assertText(workspaceId, 'A workspace is required')
  assertText(userId, 'Authentication is required')
  assertText(assetId, 'An investment is required')

  const workspaceReference = firestore.collection('workspaces').doc(workspaceId)
  const assetReference = workspaceReference.collection('modelAssets').doc(assetId)
  const [workspaceSnapshot, assetSnapshot] = await Promise.all([
    workspaceReference.get(),
    assetReference.get(),
  ])
  const workspace = workspaceSnapshot.data()
  const asset = assetSnapshot.data()

  if (
    !workspaceSnapshot.exists ||
    workspace?.deletionPendingAt ||
    !workspace?.memberIds?.includes(userId)
  ) {
    throw new Error('Workspace membership is required')
  }
  if (!assetSnapshot.exists || asset?.categoryId !== 'investment') {
    throw new Error('Investment not found')
  }

  const spreadsheetUrl = asset?.detail?.portfolio?.spreadsheetUrl
  const spreadsheetId = spreadsheetIdFromUrl(spreadsheetUrl)
  const portfolioUrl = googleSheetQueryUrl(spreadsheetId, {
    tqx: 'out:csv',
    sheet: PORTFOLIO_SHEET_NAME,
  })
  const summaryUrl = googleSheetQueryUrl(spreadsheetId, {
    tqx: 'out:csv',
    sheet: SUMMARY_SHEET_NAME,
  })

  const { portfolioRows, summary } = await fetchPortfolioSheetData(
    { portfolioUrl, summaryUrl },
    fetchImpl,
  )

  const linkedIncomeSnapshot = await workspaceReference
    .collection('modelIncome')
    .where('portfolioAssetId', '==', assetId)
    .get()
  const linkedIncomeDocuments = (linkedIncomeSnapshot.docs || []).filter((document) => {
    const income = document.data()
    return income?.categoryId === 'investments' && income?.subcategoryId === 'dividends'
  })

  const rowsJson = JSON.stringify(portfolioRows)
  if (Buffer.byteLength(rowsJson, 'utf8') > MAXIMUM_SNAPSHOT_ROWS_BYTES) {
    throw new Error('The Google Sheet is too large to cache safely')
  }

  await Promise.all([
    assetReference.update({
      currentValue: roundMoney(summary.totalPortfolioValue),
      'detail.portfolio.summary': {
        ...summary,
        syncedAt: FieldValue.serverTimestamp(),
      },
      'detail.portfolio.snapshot': {
        schemaVersion: 1,
        sheet: PORTFOLIO_SHEET_NAME,
        rowsJson,
        summary,
        syncedAt: FieldValue.serverTimestamp(),
      },
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: userId,
    }),
    ...linkedIncomeDocuments.map((document) =>
      document.ref.update({
        calculation: {
          mode: 'recurring',
          amount: summary.annualDividendIncome,
          frequency: 'yearly',
        },
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: userId,
      }),
    ),
  ])
  await rebuildFinancialYearImpl(firestore, workspaceId, currentYear(), {
    sections: linkedIncomeDocuments.length ? ['assets', 'income'] : ['assets'],
  })

  return { sheet: PORTFOLIO_SHEET_NAME, rows: portfolioRows, summary }
}

function parseLocalizedNumber(value) {
  const input = String(value ?? '')
    .trim()
    .replace(/[^0-9,.-]/g, '')
  if (!input) return null

  const lastComma = input.lastIndexOf(',')
  const lastDot = input.lastIndexOf('.')
  let normalized = input
  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.'
    normalized = normalized.replaceAll(decimalSeparator === ',' ? '.' : ',', '')
    const decimalIndex = normalized.lastIndexOf(decimalSeparator)
    normalized =
      normalized.slice(0, decimalIndex).replaceAll(decimalSeparator, '') +
      '.' +
      normalized.slice(decimalIndex + 1)
  } else {
    const separator = lastComma >= 0 ? ',' : lastDot >= 0 ? '.' : null
    if (separator) {
      const parts = normalized.split(separator)
      const grouping = parts.length > 2 || (parts.length === 2 && parts[1].length === 3)
      normalized = grouping ? parts.join('') : `${parts[0]}.${parts[1]}`
    }
  }

  const number = Number(normalized)
  return Number.isFinite(number) ? number : null
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

function normalizeHeader(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[()%]/g, ' ')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
}

function googleSheetQueryUrl(spreadsheetId, parameters) {
  const url = new URL(
    `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/gviz/tq`,
  )
  for (const [name, value] of Object.entries(parameters)) url.searchParams.set(name, value)
  return url
}

async function fetchGoogleSheet(
  url,
  fetchImpl,
  maximumLength = 100_000,
  sheetName = 'Google Sheet',
) {
  let response
  try {
    response = await fetchImpl(url, {
      signal: AbortSignal.timeout(GOOGLE_SHEET_TIMEOUT_MS),
      headers: { accept: 'text/plain, text/csv, application/json', 'cache-control': 'no-cache' },
    })
  } catch {
    throw new Error(`The ${sheetName} tab timed out`)
  }
  if (!response.ok) throw new Error(`The ${sheetName} tab returned HTTP ${response.status}`)

  const body = await response.text()
  if (body.length > maximumLength) throw new Error(`The ${sheetName} tab is too large`)
  return body
}

async function fetchPortfolioSheetData(urls, fetchImpl) {
  let lastError

  for (let attempt = 0; attempt < SHEET_READ_ATTEMPTS; attempt += 1) {
    try {
      const [portfolioBody, summaryBody] = await Promise.all([
        fetchGoogleSheet(urls.portfolioUrl, fetchImpl, 1_000_000, 'Portfolio'),
        fetchGoogleSheet(urls.summaryUrl, fetchImpl, 100_000, 'Summary'),
      ])
      const portfolioRows = parseCsv(portfolioBody)
      const summaryRows = parseCsv(summaryBody)
      const summaryValues = summaryValuesByLabel(summaryRows)
      const summary = {
        baseCurrency: parseBaseCurrency(
          summaryValues.baseCurrency,
          summaryValues.totalPortfolioValue,
          summaryValues.totalDividendsReceived,
        ),
        totalPortfolioValue: parseLocalizedNumber(summaryValues.totalPortfolioValue),
        totalDividendsReceived: parseLocalizedNumber(summaryValues.totalDividendsReceived),
        annualDividendIncome: parseLocalizedNumber(summaryValues.netDividendsReceived),
      }

      const invalidFields = []
      if (!/^[A-Z]{3}$/.test(summary.baseCurrency)) invalidFields.push('base currency')
      if (!Number.isFinite(summary.totalPortfolioValue)) invalidFields.push('portfolio value')
      if (!Number.isFinite(summary.totalDividendsReceived)) invalidFields.push('dividends received')
      if (!Number.isFinite(summary.annualDividendIncome)) invalidFields.push('annual dividends')
      if (invalidFields.length) {
        throw new Error(`The Google Sheet returned an invalid Summary: ${invalidFields.join(', ')}`)
      }
      return { portfolioRows, summary }
    } catch (error) {
      lastError = error
      if (attempt + 1 < SHEET_READ_ATTEMPTS) await delay(SHEET_RETRY_DELAY_MS)
    }
  }

  throw lastError
}

function summaryValuesByLabel(rows) {
  const values = {}

  for (const row of rows) {
    if (!Array.isArray(row)) continue
    const label = normalizeHeader(row[0])
    const value = row[1]
    const labelWords = label.split(' ')

    if (
      values.baseCurrency === undefined &&
      ['currency', 'moneda', 'divisa'].some((word) => labelWords.includes(word))
    ) {
      values.baseCurrency = value
    }
    if (
      label === 'portfolio value' ||
      label === 'total portfolio value' ||
      label === 'total portofolio value'
    ) {
      values.totalPortfolioValue = value
    }
    if (label === 'dividends received' || label === 'total dividends received') {
      values.totalDividendsReceived = value
    }
    if (label === 'net dividends received') {
      values.netDividendsReceived = value
    }
  }

  return values
}

function parseBaseCurrency(...values) {
  const inputs = values.map((value) => String(value ?? '').trim()).filter(Boolean)
  for (const input of inputs) {
    const code = input.toUpperCase().match(/(?:^|[^A-Z])([A-Z]{3})(?:[^A-Z]|$)/)?.[1]
    if (code) return code
  }

  const combined = inputs.join(' ')
  if (combined.includes('€')) return 'EUR'
  if (combined.includes('£')) return 'GBP'
  if (combined.includes('₹')) return 'INR'
  if (combined.includes('₩')) return 'KRW'
  if (combined.includes('¥')) return 'JPY'
  if (combined.includes('$')) return 'USD'
  return ''
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function canonicalGoogleSheetsUrl(value) {
  const input = String(value || '').trim()
  if (!input || input.length > 2048) throw new Error('A valid Google Sheets URL is required')

  let url
  try {
    url = new URL(input)
  } catch {
    throw new Error('A valid Google Sheets URL is required')
  }

  if (
    url.protocol !== 'https:' ||
    url.hostname !== GOOGLE_SHEETS_HOST ||
    !SPREADSHEET_PATH.test(url.pathname)
  ) {
    throw new Error('A valid Google Sheets URL is required')
  }

  url.hash = ''
  return url.toString()
}

function spreadsheetIdFromUrl(value) {
  const url = new URL(canonicalGoogleSheetsUrl(value))
  const match = url.pathname.match(SPREADSHEET_PATH)
  if (!match?.[1]) throw new Error('A Google Sheets portfolio is not configured')
  return match[1]
}

function parseCsv(value) {
  const csv = String(value || '').replace(/^\uFEFF/, '')
  if (!csv) return []

  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index]

    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        field += character
      }
    } else if (character === '"' && field === '') {
      quoted = true
    } else if (character === ',') {
      row.push(field)
      field = ''
    } else if (character === '\n' || character === '\r') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      if (character === '\r' && csv[index + 1] === '\n') index += 1
    } else {
      field += character
    }
  }

  if (quoted) throw new Error('The Google Sheet returned an invalid response')
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

function parseGoogleVisualizationValues(value) {
  const response = String(value || '')
  const start = response.indexOf('{')
  const end = response.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('The Google Sheet returned an invalid response')

  let payload
  try {
    payload = JSON.parse(response.slice(start, end + 1))
  } catch {
    throw new Error('The Google Sheet returned an invalid response')
  }
  if (payload?.status !== 'ok' || !Array.isArray(payload?.table?.rows)) {
    throw new Error('The Google Sheet returned an invalid response')
  }

  return payload.table.rows.map((row) => row?.c?.[0]?.v ?? null)
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function assertText(value, message) {
  if (!String(value || '').trim()) throw new Error(message)
}

module.exports = {
  canonicalGoogleSheetsUrl,
  parseCsv,
  parseGoogleVisualizationValues,
  readInvestmentPortfolioSheet,
  updateInvestmentPortfolio,
}
