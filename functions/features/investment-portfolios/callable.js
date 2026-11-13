/**
 * Firebase callable boundaries for connecting, refreshing, and synchronizing Google Sheets investment portfolios while translating service errors for clients.
 */
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/https'
import * as logger from 'firebase-functions/logger'
import {
  syncInvestmentPortfolio as syncInvestmentPortfolioData,
  syncWorkspaceInvestmentPortfolios as syncWorkspaceInvestmentPortfoliosData,
  updateInvestmentPortfolio as updateInvestmentPortfolioData,
} from './service.js'

/**
 * Connects or disconnects a portfolio sheet after validating access and source data.
 */
const updateInvestmentPortfolio = onCall({ region: 'europe-west1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication is required')

  try {
    return await updateInvestmentPortfolioData(getFirestore(), {
      workspaceId: String(request.data?.workspaceId || '').trim(),
      userId: request.auth.uid,
      assetId: String(request.data?.assetId || '').trim(),
      spreadsheetUrl: request.data?.spreadsheetUrl ?? null,
    })
  } catch (error) {
    if (error instanceof HttpsError) throw error
    throw new HttpsError('failed-precondition', error.message)
  }
})

/**
 * Forces or reuses a portfolio-sheet refresh and returns the normalized portfolio result.
 */
const readInvestmentPortfolioSheet = onCall({ region: 'europe-west1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication is required')

  const workspaceId = String(request.data?.workspaceId || '').trim()
  const assetId = String(request.data?.assetId || '').trim()
  try {
    return await syncInvestmentPortfolioData(getFirestore(), {
      workspaceId,
      userId: request.auth.uid,
      assetId,
      force: Boolean(request.data?.force),
    })
  } catch (error) {
    if (error instanceof HttpsError) throw error
    logger.error('Investment portfolio refresh failed', {
      workspaceId,
      assetId,
      error: error?.message || String(error),
    })
    throw new HttpsError('failed-precondition', error.message)
  }
})

/**
 * Refreshes all linked portfolios in a workspace and aggregates failures.
 */
const syncWorkspaceInvestmentPortfolios = onCall(
  { region: 'europe-west1', timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication is required')

    const workspaceId = String(request.data?.workspaceId || '').trim()
    try {
      return await syncWorkspaceInvestmentPortfoliosData(getFirestore(), {
        workspaceId,
        userId: request.auth.uid,
        force: Boolean(request.data?.force),
      })
    } catch (error) {
      if (error instanceof HttpsError) throw error
      logger.error('Workspace investment portfolios refresh failed', {
        workspaceId,
        error: error?.message || String(error),
      })
      throw new HttpsError('failed-precondition', error.message)
    }
  },
)

export {
  readInvestmentPortfolioSheet,
  syncWorkspaceInvestmentPortfolios,
  updateInvestmentPortfolio,
}
