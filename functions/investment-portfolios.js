const { getFirestore } = require('firebase-admin/firestore')
const { HttpsError, onCall } = require('firebase-functions/https')
const {
  readInvestmentPortfolioSheet: readInvestmentPortfolioSheetData,
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

  try {
    return await readInvestmentPortfolioSheetData(getFirestore(), {
      workspaceId: String(request.data?.workspaceId || '').trim(),
      userId: request.auth.uid,
      assetId: String(request.data?.assetId || '').trim(),
    })
  } catch (error) {
    if (error instanceof HttpsError) throw error
    throw new HttpsError('failed-precondition', error.message)
  }
})

module.exports = { readInvestmentPortfolioSheet, updateInvestmentPortfolio }
