const { getFirestore } = require('firebase-admin/firestore')
const { onDocumentWritten } = require('firebase-functions/firestore')
const { HttpsError, onCall } = require('firebase-functions/https')
const { onSchedule } = require('firebase-functions/scheduler')
const { syncWorkspaceInvestmentPortfolios } = require('./services/investment-portfolios')
const {
  closePreviousFinancialPositionMonth,
  madridToday,
  currentYear,
  rebuildFinancialYear,
  refreshFinancialYearTrackingMonth,
  refreshModeledPositions,
  synchronizeFinancialYearPositions,
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

const closeMonthlyFinancialPositions = onSchedule(
  {
    schedule: '5 0 1 * *',
    timeZone: 'Europe/Madrid',
    region: 'europe-west1',
    timeoutSeconds: 540,
    retryCount: 3,
  },
  async () => {
    const firestore = getFirestore()
    const workspaces = await firestore.collection('workspaces').get()
    const failures = []
    for (const workspace of workspaces.docs || []) {
      if (workspace.data()?.deletionPendingAt) continue
      try {
        await syncWorkspaceInvestmentPortfolios(firestore, {
          workspaceId: workspace.id,
          force: true,
          throwOnError: true,
        })
        await closePreviousFinancialPositionMonth(firestore, workspace.id, madridToday())
      } catch (error) {
        failures.push({ workspaceId: workspace.id, error })
      }
    }
    if (failures.length) {
      console.error('Failed to close monthly financial positions', failures)
      throw new Error(`Failed to close ${failures.length} monthly financial positions`)
    }
  },
)

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
  closeMonthlyFinancialPositions,
  ensureFinancialYear,
  onExpenseTrackingWritten,
  onModelConfigWritten,
}
