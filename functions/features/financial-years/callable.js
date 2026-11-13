/**
 * Firebase callable boundary for ensuring the current financial year. It validates membership, refreshes modeled positions, rebuilds affected projections, and returns synchronization status.
 */
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/https'
import * as logger from 'firebase-functions/logger'
import {
  madridToday,
  currentYear,
  rebuildFinancialYear,
  refreshModeledPositions,
  synchronizeFinancialYearPositions,
} from './service.js'

/**
 * Exposes the authenticated callable that ensures and synchronizes the current financial year.
 */
const ensureFinancialYear = onCall({ region: 'europe-west1' }, async (request) => {
  const startedAt = Date.now()
  try {
    const result = await handleFinancialYearRequest(request)
    logger.info('Financial year ensured', {
      workspaceId: request.data?.workspaceId || null,
      year: request.data?.year || null,
      durationMs: Date.now() - startedAt,
      status: result.status,
      modeledPositions: result.modeledPositions,
      financialPosition: result.financialPosition,
    })
    return result
  } catch (error) {
    logger.error('Financial year ensure failed', {
      workspaceId: request.data?.workspaceId || null,
      year: request.data?.year || null,
      durationMs: Date.now() - startedAt,
      error: error?.message || String(error),
    })
    throw error
  }
})

/**
 * Validates a callable request and coordinates refresh, rebuild, and position synchronization.
 */
async function handleFinancialYearRequest(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication is required')
  const workspaceId = String(request.data?.workspaceId || '')
  const year = Number(request.data?.year)
  if (!workspaceId || !Number.isInteger(year)) {
    throw new HttpsError('invalid-argument', 'A workspace and valid year are required')
  }
  if (year !== currentYear()) {
    throw new HttpsError('invalid-argument', 'Only the current financial year can be ensured')
  }
  const firestore = getFirestore()
  const workspace = await firestore.collection('workspaces').doc(workspaceId).get()
  if (
    !workspace.exists ||
    workspace.data()?.deletionPendingAt ||
    !workspace.data()?.memberIds?.includes(request.auth.uid)
  ) {
    throw new HttpsError('permission-denied', 'Workspace membership is required')
  }
  const refresh = request.data?.refresh === true
  const modeledPositions = await refreshModeledPositions(firestore, workspaceId, request.auth.uid)
  const assetsChanged = modeledPositions.assetsUpdated > 0
  const liabilitiesChanged = modeledPositions.liabilitiesUpdated > 0
  const expensesChanged = modeledPositions.expensesUpdated > 0
  let sections
  if (refresh) {
    sections = [
      'income',
      'expenses',
      ...(assetsChanged ? ['assets'] : []),
      ...(liabilitiesChanged ? ['liabilities'] : []),
    ]
  } else {
    sections = [
      ...(assetsChanged ? ['assets'] : []),
      ...(liabilitiesChanged ? ['liabilities'] : []),
      ...(expensesChanged ? ['expenses'] : []),
    ]
    if (!sections.length) sections = undefined
  }
  const financialYear = await rebuildFinancialYear(firestore, workspaceId, year, {
    createOnly: !refresh && !assetsChanged && !liabilitiesChanged && !expensesChanged,
    sections,
  })
  const financialPosition = await synchronizeFinancialYearPositions(
    firestore,
    workspaceId,
    madridToday(),
  )
  return { ...financialYear, modeledPositions, financialPosition }
}

export { ensureFinancialYear }
