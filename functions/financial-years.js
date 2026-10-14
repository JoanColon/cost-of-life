const { getFirestore } = require('firebase-admin/firestore')
const { onDocumentWritten } = require('firebase-functions/firestore')
const { HttpsError, onCall } = require('firebase-functions/https')
const {
  currentYear,
  rebuildFinancialYear,
  refreshFinancialYearTrackingMonth,
} = require('./services/financial-years')

const options = { region: 'europe-west1', retry: true }

const ensureFinancialYear = onCall({ region: 'europe-west1' }, async (request) => {
  return handleFinancialYearRequest(request)
})

const refreshFinancialYearTracking = onCall({ region: 'europe-west1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication is required')
  const workspaceId = String(request.data?.workspaceId || '')
  const period = String(request.data?.period || '')
  const firestore = getFirestore()
  const workspace = await firestore.collection('workspaces').doc(workspaceId).get()
  if (
    !workspace.exists ||
    workspace.data()?.deletionPendingAt ||
    !workspace.data()?.memberIds?.includes(request.auth.uid)
  ) {
    throw new HttpsError('permission-denied', 'Workspace membership is required')
  }
  return refreshFinancialYearTrackingMonth(firestore, workspaceId, period)
})

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
  return rebuildFinancialYear(firestore, workspaceId, year, { createOnly: true })
}

const modelSections = new Set(['assets', 'liabilities', 'income', 'expenses'])

const onModelConfigWritten = onDocumentWritten(
  { ...options, document: 'workspaces/{workspaceId}/modelConfig/{section}' },
  (event) => {
    const { section, workspaceId } = event.params
    if (!modelSections.has(section)) return
    return rebuildCurrent(workspaceId, [section])
  },
)

const onExpenseModelWritten = onDocumentWritten(
  { ...options, document: 'workspaces/{workspaceId}/modelExpenses/{expenseId}' },
  (event) => rebuildCurrent(event.params.workspaceId, ['expenses']),
)

const onIncomeModelWritten = onDocumentWritten(
  { ...options, document: 'workspaces/{workspaceId}/modelIncome/{incomeId}' },
  (event) => rebuildCurrent(event.params.workspaceId, ['income']),
)

const onAssetModelWritten = onDocumentWritten(
  { ...options, document: 'workspaces/{workspaceId}/modelAssets/{assetId}' },
  (event) => rebuildCurrent(event.params.workspaceId, ['assets']),
)

const onLiabilityModelWritten = onDocumentWritten(
  { ...options, document: 'workspaces/{workspaceId}/modelLiabilities/{liabilityId}' },
  (event) => rebuildCurrent(event.params.workspaceId, ['liabilities']),
)

const onExpenseTrackingWritten = onDocumentWritten(
  { ...options, document: 'workspaces/{workspaceId}/expenseTracking/{period}' },
  async (event) => {
    const year = Number(String(event.params.period).slice(0, 4))
    if (!Number.isInteger(year) || year !== currentYear()) return
    const firestore = getFirestore()
    if (!(await workspaceIsActive(firestore, event.params.workspaceId))) return
    await refreshFinancialYearTrackingMonth(
      firestore,
      event.params.workspaceId,
      event.params.period,
    )
  },
)

async function rebuildCurrent(workspaceId, sections) {
  const firestore = getFirestore()
  if (!(await workspaceIsActive(firestore, workspaceId))) return
  await rebuildFinancialYear(firestore, workspaceId, currentYear(), { sections })
}

async function workspaceIsActive(firestore, workspaceId) {
  const workspace = await firestore.collection('workspaces').doc(workspaceId).get()
  return workspace.exists && !workspace.data()?.deletionPendingAt
}

module.exports = {
  ensureFinancialYear,
  onAssetModelWritten,
  onExpenseModelWritten,
  onExpenseTrackingWritten,
  onIncomeModelWritten,
  onLiabilityModelWritten,
  onModelConfigWritten,
  refreshFinancialYearTracking,
}
