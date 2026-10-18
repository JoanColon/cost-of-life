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
  return rebuildFinancialYear(firestore, workspaceId, year, {
    createOnly: !refresh,
    sections: refresh ? ['income', 'expenses'] : undefined,
  })
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

const onExpenseTrackingWritten = onDocumentWritten(
  { ...options, document: 'workspaces/{workspaceId}/expenseTracking/{period}' },
  async (event) => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(event.params.period))) return
    const firestore = getFirestore()
    await refreshFinancialYearTrackingMonth(
      firestore,
      event.params.workspaceId,
      event.params.period,
    )
  },
)

async function rebuildCurrent(workspaceId, sections) {
  await rebuildFinancialYear(getFirestore(), workspaceId, currentYear(), { sections })
}

module.exports = {
  ensureFinancialYear,
  onExpenseTrackingWritten,
  onModelConfigWritten,
}
