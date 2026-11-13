/**
 * Coordinates Google Sheets portfolio imports with Firestore. It validates access, manages cache freshness, synchronizes linked assets and dividend income, and rebuilds affected financial projections.
 */
import { FieldValue } from 'firebase-admin/firestore'
import { roundMoneyOrNull } from '../../shared/core/money.js'
import { currentYear, rebuildFinancialYear } from '../financial-years/service.js'
import {
  PORTFOLIO_SCHEMA,
  normalizeInvestmentPortfolio,
  parseCsv,
} from './schema.js'

const GOOGLE_SHEETS_HOST = 'docs.google.com'
const SPREADSHEET_PATH = /^\/spreadsheets(?:\/u\/\d+)?\/d\/([A-Za-z0-9_-]+)(?:\/|$)/
const SHEET_READ_ATTEMPTS = 2
const SHEET_RETRY_DELAY_MS = 200
const GOOGLE_SHEET_TIMEOUT_MS = 25_000
const PORTFOLIO_CACHE_TTL_MS = 15 * 60 * 1000
const MAXIMUM_CACHE_BYTES = 700_000
const MAXIMUM_STORED_WARNINGS = 100

/**
 * Connects or disconnects a portfolio sheet after validating access and source data.
 */
async function updateInvestmentPortfolio(
  firestore,
  { workspaceId, userId, assetId, spreadsheetUrl = null },
  fetchImpl = fetch,
  rebuildFinancialYearImpl = rebuildFinancialYear,
  nowImpl = Date.now,
) {
  assertRequest(workspaceId, userId, assetId)
  if (spreadsheetUrl == null) {
    return disconnectInvestmentPortfolio(firestore, { workspaceId, userId, assetId })
  }

  const canonicalUrl = canonicalGoogleSheetsUrl(spreadsheetUrl)
  return synchronizeInvestmentPortfolio(
    firestore,
    { workspaceId, userId, assetId, force: true },
    fetchImpl,
    rebuildFinancialYearImpl,
    nowImpl,
    canonicalUrl,
  )
}

/**
 * Refreshes one linked portfolio, using its cache unless forced.
 */
async function syncInvestmentPortfolio(
  firestore,
  { workspaceId, userId, assetId, force = false },
  fetchImpl = fetch,
  rebuildFinancialYearImpl = rebuildFinancialYear,
  nowImpl = Date.now,
) {
  assertRequest(workspaceId, userId, assetId)
  return synchronizeInvestmentPortfolio(
    firestore,
    { workspaceId, userId, assetId, force: Boolean(force) },
    fetchImpl,
    rebuildFinancialYearImpl,
    nowImpl,
  )
}

/**
 * Refreshes all linked portfolios in a workspace and aggregates failures.
 */
async function syncWorkspaceInvestmentPortfolios(
  firestore,
  { workspaceId, userId = null, force = false, throwOnError = false },
  fetchImpl = fetch,
  rebuildFinancialYearImpl = rebuildFinancialYear,
  nowImpl = Date.now,
) {
  assertText(workspaceId, 'A workspace is required')
  const workspaceReference = firestore.collection('workspaces').doc(workspaceId)
  const workspaceSnapshot = await workspaceReference.get()
  const workspace = workspaceSnapshot.data()
  if (!workspaceSnapshot.exists || workspace?.deletionPendingAt) {
    throw new Error('Workspace membership is required')
  }
  if (userId && !workspace?.memberIds?.includes(userId)) {
    throw new Error('Workspace membership is required')
  }

  const investments = await workspaceReference
    .collection('modelAssets')
    .where('categoryId', '==', 'investment')
    .get()
  const connected = (investments.docs || []).filter(
    (document) => document.data()?.detail?.portfolio?.spreadsheetUrl,
  )
  const results = []
  const failures = []
  for (const document of connected) {
    try {
      const result = await synchronizeInvestmentPortfolio(
        firestore,
        { workspaceId, userId: userId || 'system:portfolio-sync', assetId: document.id, force },
        fetchImpl,
        rebuildFinancialYearImpl,
        nowImpl,
        null,
        {
          workspaceReference,
          assetReference: document.ref,
          asset: document.data(),
        },
      )
      results.push({ assetId: document.id, ...result })
    } catch (error) {
      failures.push({ assetId: document.id, error: error?.message || String(error) })
      if (throwOnError) throw error
    }
  }
  return { results, failures }
}

/**
 * Imports one portfolio and synchronizes its asset, cache, dividend income, and projection transactionally.
 */
async function synchronizeInvestmentPortfolio(
  firestore,
  { workspaceId, userId, assetId, force },
  fetchImpl,
  rebuildFinancialYearImpl,
  nowImpl,
  spreadsheetUrlOverride = null,
  contextOverride = null,
) {
  const context =
    contextOverride || (await portfolioContext(firestore, { workspaceId, userId, assetId }))
  const existingPortfolio = context.asset?.detail?.portfolio || null
  const now = Number(nowImpl())
  let nextPortfolio = null

  try {
    if (!spreadsheetUrlOverride && !force && portfolioCacheIsFresh(existingPortfolio, now)) {
      return portfolioResult(existingPortfolio, context.asset.currentValue, 'fresh')
    }

    const spreadsheetUrl = spreadsheetUrlOverride || existingPortfolio?.spreadsheetUrl
    const spreadsheetId = spreadsheetIdFromUrl(spreadsheetUrl)
    const imported = await fetchInvestmentPortfolioSource(spreadsheetId, fetchImpl)
    const normalized = mergeInvestmentPortfolio(imported, existingPortfolio)
    if (!Number.isFinite(normalized.summary.totalPortfolioValue)) {
      throw new Error('The Google Sheet did not provide a valid portfolio value')
    }
    const warnings = normalized.warnings.slice(0, MAXIMUM_STORED_WARNINGS)
    const warningCount = normalized.warnings.length
    const cacheBytes = Buffer.byteLength(JSON.stringify({ holdings: normalized.holdings, warnings }), 'utf8')
    if (cacheBytes > MAXIMUM_CACHE_BYTES) {
      throw new Error('The Google Sheet is too large to cache safely')
    }

    const linkedIncomeSnapshot = await context.workspaceReference
      .collection('modelIncome')
      .where('portfolioAssetId', '==', assetId)
      .get()
    const linkedIncomeDocuments = (linkedIncomeSnapshot.docs || []).filter((document) => {
      const income = document.data()
      return income?.categoryId === 'investments' && income?.subcategoryId === 'dividends'
    })
    const incomeDocumentsToUpdate = Number.isFinite(imported.summary.annualDividendIncome) ?
      linkedIncomeDocuments.filter(
          (document) => !incomeMatchesAnnualDividends(document.data(), normalized.summary),
        ) :
      []

    const importedPortfolioValueIsValid = Number.isFinite(imported.summary.totalPortfolioValue)
    const assetValueChanged =
      importedPortfolioValueIsValid &&
      roundMoneyOrNull(context.asset.currentValue) !== normalized.summary.totalPortfolioValue
    const summaryChanged = !sameValue(existingPortfolio?.summary, normalized.summary)
    const holdingsChanged = !sameValue(existingPortfolio?.cache?.holdings, normalized.holdings)
    const pendingSections = existingPortfolio?.sync?.financialProjectionDirty ?
      existingPortfolio.sync.pendingSections || [] :
      []
    const sections = [
      ...new Set([
        ...pendingSections,
        ...(assetValueChanged ? ['assets'] : []),
        ...(incomeDocumentsToUpdate.length ? ['income'] : []),
      ]),
    ]
    const contentChanged = summaryChanged || holdingsChanged
    nextPortfolio = {
      schemaVersion: PORTFOLIO_SCHEMA.version,
      source: 'google_sheets',
      spreadsheetId,
      spreadsheetUrl: canonicalGoogleSheetsUrl(spreadsheetUrl),
      summary: normalized.summary,
      cache: {
        schemaVersion: PORTFOLIO_SCHEMA.version,
        holdings: normalized.holdings,
        warnings,
        warningCount,
        lastCheckedAt: now,
        dataUpdatedAt: contentChanged ? now : existingPortfolio?.cache?.dataUpdatedAt || now,
        refreshAfter: now + PORTFOLIO_CACHE_TTL_MS,
      },
      sync: {
        financialProjectionDirty: sections.length > 0,
        pendingSections: sections,
        lastSuccessAt: sections.length ? existingPortfolio?.sync?.lastSuccessAt || null : now,
        lastErrorAt: null,
        lastErrorMessage: null,
      },
    }

    const batch = firestore.batch()
    batch.update(context.assetReference, {
      ...(assetValueChanged ? { currentValue: normalized.summary.totalPortfolioValue } : {}),
      'detail.portfolio': nextPortfolio,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: userId,
    })
    for (const document of incomeDocumentsToUpdate) {
      batch.update(document.ref, {
        calculation: {
          mode: 'recurring',
          amount: normalized.summary.annualDividendIncome,
          frequency: 'yearly',
        },
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: userId,
      })
    }
    await batch.commit()

    if (sections.length) {
      await rebuildFinancialYearImpl(firestore, workspaceId, currentYear(), { sections })
      nextPortfolio.sync = {
        ...nextPortfolio.sync,
        financialProjectionDirty: false,
        pendingSections: [],
        lastSuccessAt: now,
      }
      await context.assetReference.update({
        'detail.portfolio.sync': nextPortfolio.sync,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: userId,
      })
    }

    return portfolioResult(
      nextPortfolio,
      importedPortfolioValueIsValid ?
        normalized.summary.totalPortfolioValue :
        context.asset.currentValue,
      'refreshed',
      {
        contentChanged,
        financialSections: sections,
      },
    )
  } catch (error) {
    if (existingPortfolio?.spreadsheetUrl) {
      try {
        await context.assetReference.update({
          'detail.portfolio.sync': {
            ...(nextPortfolio?.sync || existingPortfolio.sync || {}),
            lastErrorAt: now,
            lastErrorMessage: error?.message || String(error),
          },
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: userId,
        })
      } catch {
        // Preserve the synchronization error when its diagnostic metadata cannot be stored.
      }
    }
    throw error
  }
}

/**
 * Removes a spreadsheet connection while preserving the asset and clearing imported portfolio state.
 */
async function disconnectInvestmentPortfolio(firestore, { workspaceId, userId, assetId }) {
  const context = await portfolioContext(firestore, { workspaceId, userId, assetId })
  const linkedIncomeSnapshot = await context.workspaceReference
    .collection('modelIncome')
    .where('portfolioAssetId', '==', assetId)
    .get()
  const batch = firestore.batch()
  batch.update(context.assetReference, {
    'detail.portfolio': FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: userId,
  })
  for (const document of linkedIncomeSnapshot.docs || []) {
    batch.update(document.ref, {
      portfolioAssetId: null,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: userId,
    })
  }
  await batch.commit()
  return { portfolio: null }
}

/**
 * Loads and validates the workspace, asset, and linked income context for a portfolio.
 */
async function portfolioContext(firestore, { workspaceId, userId, assetId }) {
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
  return { workspaceReference, assetReference, asset }
}

/**
 * Downloads and normalizes the required portfolio and summary sheets.
 */
async function fetchInvestmentPortfolioSource(spreadsheetId, fetchImpl) {
  const requestId = Date.now()
  const portfolioUrl = googleSheetQueryUrl(spreadsheetId, {
    tqx: 'out:csv',
    sheet: PORTFOLIO_SCHEMA.sheets.portfolio,
    _: requestId,
  })
  const summaryUrl = googleSheetQueryUrl(spreadsheetId, {
    tqx: 'out:csv',
    sheet: PORTFOLIO_SCHEMA.sheets.summary,
    _: requestId,
  })
  let lastError
  for (let attempt = 0; attempt < SHEET_READ_ATTEMPTS; attempt += 1) {
    try {
      const [portfolioResult, summaryResult] = await Promise.allSettled([
        fetchGoogleSheet(portfolioUrl, fetchImpl, 1_000_000, 'Portfolio'),
        fetchGoogleSheet(summaryUrl, fetchImpl, 100_000, 'Summary'),
      ])
      if (portfolioResult.status === 'rejected') throw portfolioResult.reason
      const normalized = normalizeInvestmentPortfolio(
        parseCsv(portfolioResult.value),
        summaryResult.status === 'fulfilled' ? parseCsv(summaryResult.value) : [],
      )
      if (summaryResult.status === 'rejected') {
        normalized.warnings.unshift({
          scope: 'summary',
          field: 'summary',
          code: 'source_unavailable',
          message: summaryResult.reason?.message || 'The Summary tab could not be read',
        })
      }
      return normalized
    } catch (error) {
      lastError = error
      if (attempt + 1 < SHEET_READ_ATTEMPTS) await delay(SHEET_RETRY_DELAY_MS)
    }
  }
  throw lastError
}

/**
 * Merges investment portfolio without discarding valid existing data.
 */
function mergeInvestmentPortfolio(imported, existingPortfolio) {
  const previousSummary = existingPortfolio?.summary || {}
  const summary = Object.fromEntries(
    ['baseCurrency', 'totalPortfolioValue', 'totalDividendsReceived', 'annualDividendIncome'].map(
      (field) => [field, validImportedValue(imported.summary?.[field]) ? imported.summary[field] : previousSummary[field] ?? null],
    ),
  )
  const previousHoldings = existingPortfolio?.cache?.holdings || []
  const previousByKey = uniqueHoldingsByKey(previousHoldings)
  const holdings = imported.holdings.map((holding) => {
    const previous = previousByKey.get(holdingKey(holding))
    if (!previous) return holding
    return Object.fromEntries(
      Object.entries(holding).map(([field, value]) => [
        field,
        value == null || value === '' ? previous[field] ?? value : value,
      ]),
    )
  })
  return { ...imported, summary, holdings }
}

/**
 * Reports whether imported data can safely replace a persisted value.
 */
function validImportedValue(value) {
  return typeof value === 'string' ? Boolean(value) : Number.isFinite(value)
}

/**
 * Deduplicates holdings by their stable key.
 */
function uniqueHoldingsByKey(holdings) {
  const counts = new Map()
  for (const holding of holdings) {
    const key = holdingKey(holding)
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return new Map(
    holdings
      .filter((holding) => counts.get(holdingKey(holding)) === 1)
      .map((holding) => [holdingKey(holding), holding]),
  )
}

/**
 * Returns the stable deduplication key for a portfolio holding.
 */
function holdingKey(holding) {
  return String(holding?.ticker || '').trim().toUpperCase()
}

/**
 * Fetches one sheet CSV endpoint with timeout and bounded retries.
 */
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
      headers: { accept: 'text/csv', 'cache-control': 'no-cache' },
    })
  } catch {
    throw new Error(`The ${sheetName} tab timed out`)
  }
  if (!response.ok) throw new Error(`The ${sheetName} tab returned HTTP ${response.status}`)
  const body = await response.text()
  if (body.length > maximumLength) throw new Error(`The ${sheetName} tab is too large`)
  return body
}

/**
 * Reports whether a cached import remains inside its configured time-to-live.
 */
function portfolioCacheIsFresh(portfolio, now = Date.now()) {
  return Boolean(
    portfolio?.schemaVersion === PORTFOLIO_SCHEMA.version &&
    portfolio?.summary &&
    portfolio?.cache?.schemaVersion === PORTFOLIO_SCHEMA.version &&
    Array.isArray(portfolio.cache.holdings) &&
    !portfolio?.sync?.financialProjectionDirty &&
    Number(portfolio.cache.refreshAfter) > Number(now),
  )
}

/**
 * Builds the client-facing portfolio synchronization result.
 */
function portfolioResult(portfolio, currentValue, cacheStatus, extra = {}) {
  const warnings = Array.isArray(portfolio?.cache?.warnings) ? portfolio.cache.warnings : []
  const warningCount = Number(portfolio?.cache?.warningCount) || warnings.length
  return {
    portfolio,
    currentValue: roundMoneyOrNull(currentValue),
    summary: portfolio.summary,
    holdings: portfolio.cache.holdings,
    cacheStatus,
    status: warningCount ? 'partial' : 'success',
    warnings,
    warningCount,
    ...extra,
  }
}

/**
 * Reports whether linked income matches imported annual dividends.
 */
function incomeMatchesAnnualDividends(income, summary) {
  return (
    income?.calculation?.mode === 'recurring' &&
    income?.calculation?.frequency === 'yearly' &&
    roundMoneyOrNull(income?.calculation?.amount) === summary.annualDividendIncome
  )
}

/**
 * Reports whether two optional values are equivalent for synchronization.
 */
function sameValue(first, second) {
  return JSON.stringify(first ?? null) === JSON.stringify(second ?? null)
}

/**
 * Builds a CSV export URL for one Google Sheet query.
 */
function googleSheetQueryUrl(spreadsheetId, parameters) {
  const url = new URL(
    `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/gviz/tq`,
  )
  for (const [name, value] of Object.entries(parameters)) url.searchParams.set(name, value)
  return url
}

/**
 * Validates a Sheets URL and returns its stable canonical document URL.
 */
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

/**
 * Extracts the document identifier from a validated Sheets URL.
 */
function spreadsheetIdFromUrl(value) {
  const url = new URL(canonicalGoogleSheetsUrl(value))
  const match = url.pathname.match(SPREADSHEET_PATH)
  if (!match?.[1]) throw new Error('A Google Sheets portfolio is not configured')
  return match[1]
}

/**
 * Returns a promise that resolves after the requested duration.
 */
function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

/**
 * Validates request and throws a descriptive error when its contract is not satisfied.
 */
function assertRequest(workspaceId, userId, assetId) {
  assertText(workspaceId, 'A workspace is required')
  assertText(userId, 'Authentication is required')
  assertText(assetId, 'An investment is required')
}

/**
 * Validates text and throws a descriptive error when its contract is not satisfied.
 */
function assertText(value, message) {
  if (!String(value || '').trim()) throw new Error(message)
}

export {
  PORTFOLIO_CACHE_TTL_MS,
  canonicalGoogleSheetsUrl,
  portfolioCacheIsFresh,
  syncInvestmentPortfolio,
  syncWorkspaceInvestmentPortfolios,
  updateInvestmentPortfolio,
}
