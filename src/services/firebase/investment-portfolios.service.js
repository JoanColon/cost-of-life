import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase/firebase'

const updatePortfolio = httpsCallable(functions, 'updateInvestmentPortfolio')
const readPortfolioSheet = httpsCallable(functions, 'readInvestmentPortfolioSheet')
const spreadsheetPath = /^\/spreadsheets(?:\/u\/\d+)?\/d\/[A-Za-z0-9_-]+(?:\/|$)/

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

export async function readInvestmentPortfolioSheet(workspaceId, assetId) {
  const result = await readPortfolioSheet({ workspaceId, assetId })
  return result.data
}

export function investmentPortfolioSnapshot(portfolio) {
  const data = portfolio?.snapshot
  if (data?.schemaVersion !== 1 || typeof data?.rowsJson !== 'string') return null

  try {
    const rows = JSON.parse(data.rowsJson)
    if (!Array.isArray(rows)) return null
    return {
      sheet: data.sheet,
      rows,
      summary: data.summary || null,
      syncedAt: data.syncedAt || null,
    }
  } catch {
    return null
  }
}
