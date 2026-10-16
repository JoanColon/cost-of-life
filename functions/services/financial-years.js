const { FieldPath, FieldValue } = require('firebase-admin/firestore')
const { applyTrackingMonth, updateFinancialYearProjection } = require('../domain/financial-year')

const PROJECTION_SECTIONS = ['assets', 'liabilities', 'income', 'expenses']

async function rebuildFinancialYear(
  firestore,
  workspaceId,
  year,
  { createOnly = false, sections = PROJECTION_SECTIONS, positionMonth = currentMonth() } = {},
) {
  assertWorkspaceId(workspaceId)
  assertYear(year)
  const workspace = firestore.collection('workspaces').doc(workspaceId)
  const target = workspace.collection('financialYears').doc(String(year))
  let status = 'rebuilt'
  await firestore.runTransaction(async (transaction) => {
    const [workspaceSnapshot, latestSnapshot] = await Promise.all([
      transaction.get(workspace),
      transaction.get(target),
    ])
    if (!workspaceSnapshot.exists || workspaceSnapshot.data()?.deletionPendingAt) {
      status = 'skipped'
      return
    }
    const latest = latestSnapshot.data() || {}
    if (createOnly && latestSnapshot.exists && latest.totals) {
      status = 'existing'
      return
    }
    const affectedSections = latest.totals ? normalizeSections(sections) : PROJECTION_SECTIONS
    const config = await loadConfig(workspace, affectedSections, transaction)
    const [assetsSnapshot, liabilitiesSnapshot, incomeSnapshot, expenseSnapshot, trackingSnapshot] =
      await Promise.all([
        affectedSections.includes('assets') ?
          transaction.get(workspace.collection('modelAssets')) :
          null,
        affectedSections.includes('liabilities') ?
          transaction.get(workspace.collection('modelLiabilities')) :
          null,
        affectedSections.includes('income') ?
          transaction.get(workspace.collection('modelIncome')) :
          null,
        affectedSections.includes('expenses') ?
          transaction.get(workspace.collection('modelExpenses')) :
          null,
        affectedSections.includes('expenses') ?
          transaction.get(
              workspace
                .collection('expenseTracking')
                .where(FieldPath.documentId(), '>=', `${year}-01`)
                .where(FieldPath.documentId(), '<=', `${year}-12`),
            ) :
          null,
      ])
    const source = {
      year,
      config,
      assets: documents(assetsSnapshot),
      liabilities: documents(liabilitiesSnapshot),
      income: documents(incomeSnapshot),
      expenses: documents(expenseSnapshot),
      trackingMonths: Object.fromEntries(
        documents(trackingSnapshot).map((item) => [item.id, item]),
      ),
      sections: affectedSections,
      positionFromMonths: {
        assets: positionStartMonth(latest, 'assets', positionMonth),
        liabilities: positionStartMonth(latest, 'liabilities', positionMonth),
      },
      positionObservedMonth: positionMonth,
    }
    transaction.set(target, {
      ...updateFinancialYearProjection(latest, source),
      status: year === currentYear() ? 'active' : 'closed',
      generatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  })
  return { status, workspaceId, year }
}

async function refreshFinancialYearTrackingMonth(firestore, workspaceId, period) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('A valid period is required')
  const year = Number(period.slice(0, 4))
  const workspace = firestore.collection('workspaces').doc(workspaceId)
  const target = workspace.collection('financialYears').doc(String(year))
  const tracking = workspace.collection('expenseTracking').doc(period)
  let status = 'updated'
  await firestore.runTransaction(async (transaction) => {
    const [workspaceSnapshot, financialYearSnapshot, trackingSnapshot] = await Promise.all([
      transaction.get(workspace),
      transaction.get(target),
      transaction.get(tracking),
    ])
    if (!workspaceSnapshot.exists || workspaceSnapshot.data()?.deletionPendingAt) {
      status = 'skipped'
      return
    }
    if (!financialYearSnapshot.exists) {
      status = 'missing'
      return
    }
    const next = applyTrackingMonth(
      financialYearSnapshot.data(),
      period.slice(5, 7),
      trackingSnapshot.data() || {},
    )
    transaction.set(target, { ...next, updatedAt: FieldValue.serverTimestamp() })
  })
  if (status === 'skipped') return { status, workspaceId, year }
  if (status === 'missing' && year === currentYear()) {
    return rebuildFinancialYear(firestore, workspaceId, year)
  }
  if (status === 'missing') return { status, workspaceId, year }
  return { status: 'updated', workspaceId, year }
}

async function loadConfig(workspace, sections, transaction) {
  const configs = await Promise.all(
    PROJECTION_SECTIONS.map((section) =>
      sections.includes(section) ?
        transaction.get(workspace.collection('modelConfig').doc(section)) :
        null,
    ),
  )
  return Object.fromEntries(
    PROJECTION_SECTIONS.map((section, index) => [section, configs[index]?.data() || {}]),
  )
}

function normalizeSections(sections) {
  const normalized = [...new Set(sections)].filter((section) =>
    PROJECTION_SECTIONS.includes(section),
  )
  if (!normalized.length) {
    throw new Error('At least one financial year section is required')
  }
  return normalized
}

function documents(snapshot) {
  return (snapshot?.docs || []).map((document) => ({ id: document.id, ...document.data() }))
}

function positionStartMonth(financialYear, section, observedMonth) {
  const initializedMonth = financialYear?.projectionState?.[`${section}InitializedMonth`]
  return !initializedMonth || initializedMonth === observedMonth ? '01' : observedMonth
}

function currentYear() {
  return Number(
    new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Europe/Madrid' }).format(
      new Date(),
    ),
  )
}

function currentMonth() {
  return new Intl.DateTimeFormat('en', {
    month: '2-digit',
    timeZone: 'Europe/Madrid',
  }).format(new Date())
}

function assertWorkspaceId(value) {
  if (!String(value || '').trim()) throw new Error('A workspace ID is required')
}

function assertYear(value) {
  if (!Number.isInteger(value) || value < 2000 || value > 9999) {
    throw new Error('A valid financial year is required')
  }
}

module.exports = {
  currentMonth,
  currentYear,
  rebuildFinancialYear,
  refreshFinancialYearTrackingMonth,
}
