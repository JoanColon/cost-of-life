const { getFirestore } = require('firebase-admin/firestore')
const { HttpsError, onCall } = require('firebase-functions/https')
const {
  financialModelMutationInput,
  mutateFinancialModel: mutateFinancialModelData,
} = require('./services/financial-model')

const mutateFinancialModel = onCall({ region: 'europe-west1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication is required')

  try {
    return await mutateFinancialModelData(
      getFirestore(),
      financialModelMutationInput(request.data, request.auth.uid),
    )
  } catch (error) {
    if (error instanceof HttpsError) throw error
    throw new HttpsError('failed-precondition', error.message)
  }
})

module.exports = { mutateFinancialModel }
