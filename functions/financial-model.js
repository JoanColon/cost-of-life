const { getFirestore } = require('firebase-admin/firestore')
const { HttpsError, onCall } = require('firebase-functions/https')
const { mutateFinancialModel: mutateFinancialModelData } = require('./services/financial-model')

const mutateFinancialModel = onCall({ region: 'europe-west1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication is required')

  try {
    return await mutateFinancialModelData(getFirestore(), {
      workspaceId: String(request.data?.workspaceId || '').trim(),
      userId: request.auth.uid,
      section: request.data?.section,
      operation: request.data?.operation,
      itemId: request.data?.itemId,
      item: request.data?.item,
      categoryId: request.data?.categoryId,
      subcategories: request.data?.subcategories,
    })
  } catch (error) {
    if (error instanceof HttpsError) throw error
    throw new HttpsError('failed-precondition', error.message)
  }
})

module.exports = { mutateFinancialModel }
