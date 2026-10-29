import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase/firebase'

const updatePortfolio = httpsCallable(functions, 'updateInvestmentPortfolio')
const syncPortfolioSheet = httpsCallable(functions, 'readInvestmentPortfolioSheet')
const spreadsheetPath = /^\/spreadsheets(?:\/u\/\d+)?\/d\/[A-Za-z0-9_-]+(?:\/|$)/
const PORTFOLIO_SCHEMA_VERSION = 2

export function isGoogleSheetsUrl(value) {
  try {
    const url = new URL(String(value || '').trim())
    return (
      url.protocol === 'https:' &&
      url.hostname === 'docs.google.com' &&
      spreadsheetPath.test(url.pathname) &&
      url.toString().length <= 2048
    )
  } catch {
    return false
  }
}

export async function saveInvestmentPortfolio(workspaceId, assetId, spreadsheetUrl) {
  const normalizedUrl = String(spreadsheetUrl || '').trim()
  if (!isGoogleSheetsUrl(normalizedUrl)) throw new Error('A valid Google Sheets URL is required')
  const result = await updatePortfolio({ workspaceId, assetId, spreadsheetUrl: normalizedUrl })
  return result.data
}

export async function disconnectInvestmentPortfolio(workspaceId, assetId) {
  const result = await updatePortfolio({ workspaceId, assetId, spreadsheetUrl: null })
  return result.data
}

export async function syncInvestmentPortfolio(workspaceId, assetId, force = false) {
  const result = await syncPortfolioSheet({ workspaceId, assetId, force })
  return result.data
}

export function investmentPortfolioCache(portfolio) {
  const cache = portfolio?.cache
  if (
    portfolio?.schemaVersion !== PORTFOLIO_SCHEMA_VERSION ||
    cache?.schemaVersion !== PORTFOLIO_SCHEMA_VERSION
  ) {
    return null
  }
  if (!Array.isArray(cache.holdings) || !portfolio?.summary) return null
  return { summary: portfolio.summary, ...cache }
}

export function investmentPortfolioCacheIsFresh(portfolio, now = Date.now()) {
  const cache = investmentPortfolioCache(portfolio)
  return Boolean(
    cache && !portfolio?.sync?.financialProjectionDirty && Number(cache.refreshAfter) > Number(now),
  )
}
