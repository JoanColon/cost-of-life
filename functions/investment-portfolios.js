const { getFirestore } = require('firebase-admin/firestore')
const { HttpsError, onCall } = require('firebase-functions/https')
const logger = require('firebase-functions/logger')
const {
  syncInvestmentPortfolio: syncInvestmentPortfolioData,
  updateInvestmentPortfolio: updateInvestmentPortfolioData,
} = require('./services/investment-portfolios')

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

module.exports = { readInvestmentPortfolioSheet, updateInvestmentPortfolio }
