const { getFirestore } = require('firebase-admin/firestore')
const { logger } = require('firebase-functions')
const { onDocumentWritten } = require('firebase-functions/firestore')
const { HttpsError, onCall } = require('firebase-functions/https')
const { onSchedule } = require('firebase-functions/scheduler')
const {
  currentYear,
  rebuildFinancialYear,
  refreshFinancialYearTrackingMonth,
} = require('./services/financial-years')

const options = { region: 'europe-west1', retry: true }

const ensureFinancialYear = onCall({ region: 'europe-west1' }, async (request) => {
  return handleFinancialYearRequest(request, true)
})

const refreshFinancialYear = onCall({ region: 'europe-west1' }, async (request) => {
  return handleFinancialYearRequest(request, false)
})

const refreshFinancialYearTracking = onCall({ region: 'europe-west1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication is required')
  const workspaceId = String(request.data?.workspaceId || '')
  const period = String(request.data?.period || '')
  const firestore = getFirestore()
  const workspace = await firestore.collection('workspaces').doc(workspaceId).get()
  if (!workspace.exists || !workspace.data()?.memberIds?.includes(request.auth.uid)) {
    throw new HttpsError('permission-denied', 'Workspace membership is required')
  }
  return refreshFinancialYearTrackingMonth(firestore, workspaceId, period)
})

async function handleFinancialYearRequest(request, createOnly) {
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
  if (!workspace.exists || !workspace.data()?.memberIds?.includes(request.auth.uid)) {
    throw new HttpsError('permission-denied', 'Workspace membership is required')
  }
  return rebuildFinancialYear(firestore, workspaceId, year, { createOnly })
}

const onExpenseModelConfigWritten = onDocumentWritten(
  { ...options, document: 'workspaces/{workspaceId}/modelConfig/expenses' },
  (event) => rebuildCurrent(event.params.workspaceId, ['expenses']),
)

const onIncomeModelConfigWritten = onDocumentWritten(
  { ...options, document: 'workspaces/{workspaceId}/modelConfig/income' },
  (event) => rebuildCurrent(event.params.workspaceId, ['income']),
)

const onAssetModelConfigWritten = onDocumentWritten(
  { ...options, document: 'workspaces/{workspaceId}/modelConfig/assets' },
  (event) => rebuildCurrent(event.params.workspaceId, ['assets']),
)

const onLiabilityModelConfigWritten = onDocumentWritten(
  { ...options, document: 'workspaces/{workspaceId}/modelConfig/liabilities' },
  (event) => rebuildCurrent(event.params.workspaceId, ['liabilities']),
)

const onExpenseModelWritten = onDocumentWritten(
  { ...options, document: 'workspaces/{workspaceId}/modelExpenses/{expenseId}' },
  (event) => rebuildModelChange(event, ['expenses']),
)

const onIncomeModelWritten = onDocumentWritten(
  { ...options, document: 'workspaces/{workspaceId}/modelIncome/{incomeId}' },
  (event) => rebuildModelChange(event, ['income']),
)

const onAssetModelWritten = onDocumentWritten(
  { ...options, document: 'workspaces/{workspaceId}/modelAssets/{assetId}' },
  (event) => rebuildModelChange(event, ['assets']),
)

const onLiabilityModelWritten = onDocumentWritten(
  { ...options, document: 'workspaces/{workspaceId}/modelLiabilities/{liabilityId}' },
  (event) => rebuildModelChange(event, ['liabilities']),
)

const onExpenseTrackingWritten = onDocumentWritten(
  { ...options, document: 'workspaces/{workspaceId}/expenseTracking/{period}' },
  async (event) => {
    const year = Number(String(event.params.period).slice(0, 4))
    if (!Number.isInteger(year) || year !== currentYear()) return
    await refreshFinancialYearTrackingMonth(
      getFirestore(),
      event.params.workspaceId,
      event.params.period,
    )
  },
)

const scheduledFinancialYear = onSchedule(
  {
    schedule: '5 0 1 1 *',
    timeZone: 'Europe/Madrid',
    region: 'europe-west1',
    retryCount: 3,
  },
  async () => {
    const firestore = getFirestore()
    const workspaces = await firestore.collection('workspaces').get()
    const year = currentYear()
    const results = await Promise.allSettled(
      workspaces.docs.map((workspace) =>
        rebuildFinancialYear(firestore, workspace.id, year, { createOnly: true }),
      ),
    )
    const failed = results.filter((result) => result.status === 'rejected')
    if (failed.length) {
      logger.error('Financial year creation failed', { year, failed: failed.length })
      throw new Error(`Financial year creation failed for ${failed.length} workspaces`)
    }
  },
)

async function rebuildCurrent(workspaceId, sections) {
  await rebuildFinancialYear(getFirestore(), workspaceId, currentYear(), { sections })
}

async function rebuildModelChange(event, sections) {
  const beforeExists = event.data?.before?.exists === true
  const after = event.data?.after?.data()
  if (!beforeExists && after?.kind === 'categoryBaseline') return
  await rebuildCurrent(event.params.workspaceId, sections)
}

module.exports = {
  ensureFinancialYear,
  onAssetModelConfigWritten,
  onAssetModelWritten,
  onExpenseModelConfigWritten,
  onExpenseModelWritten,
  onExpenseTrackingWritten,
  onIncomeModelConfigWritten,
  onIncomeModelWritten,
  onLiabilityModelConfigWritten,
  onLiabilityModelWritten,
  refreshFinancialYear,
  refreshFinancialYearTracking,
  scheduledFinancialYear,
}
