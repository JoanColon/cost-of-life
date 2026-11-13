/**
 * Firebase callable boundary for atomic financial-model mutations. It authenticates the caller, converts request data into service input, and maps domain failures to callable errors.
 */
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/https'
import {
  financialModelMutationInput,
  mutateFinancialModel as mutateFinancialModelData,
} from './service.js'

/**
 * Validates and applies one model mutation plus all related projection and relationship writes in a Firestore transaction.
 */
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

export { mutateFinancialModel }
