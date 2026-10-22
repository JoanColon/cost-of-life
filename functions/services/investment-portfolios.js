const { FieldValue } = require('firebase-admin/firestore')

const GOOGLE_SHEETS_HOST = 'docs.google.com'
const SPREADSHEET_PATH = /^\/spreadsheets(?:\/u\/\d+)?\/d\/([A-Za-z0-9_-]+)(?:\/|$)/

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

async function readInvestmentPortfolioA1(
  firestore,
  { workspaceId, userId, assetId },
  fetchImpl = fetch,
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
  const readUrl = new URL(
    `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/gviz/tq`,
  )
  readUrl.searchParams.set('tqx', 'out:csv')
  readUrl.searchParams.set('range', 'A1')

  let response
  try {
    response = await fetchImpl(readUrl, { signal: AbortSignal.timeout(10_000) })
  } catch {
    throw new Error('The Google Sheet could not be read')
  }
  if (!response.ok) throw new Error('The Google Sheet could not be read')

  const body = await response.text()
  if (body.length > 100_000) throw new Error('The Google Sheet returned an invalid response')
  return { cell: 'A1', value: firstCsvCell(body) }
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

function firstCsvCell(value) {
  const csv = String(value || '').replace(/^\uFEFF/, '')
  if (!csv.startsWith('"')) return csv.split(/[,\r\n]/, 1)[0]

  let result = ''
  for (let index = 1; index < csv.length; index += 1) {
    if (csv[index] !== '"') {
      result += csv[index]
      continue
    }
    if (csv[index + 1] === '"') {
      result += '"'
      index += 1
      continue
    }
    return result
  }
  throw new Error('The Google Sheet returned an invalid response')
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function assertText(value, message) {
  if (!String(value || '').trim()) throw new Error(message)
}

module.exports = {
  canonicalGoogleSheetsUrl,
  firstCsvCell,
  readInvestmentPortfolioA1,
  updateInvestmentPortfolio,
}
