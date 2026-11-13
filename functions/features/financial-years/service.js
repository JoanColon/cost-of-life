/**
 * Persistence and orchestration layer for financial years. It loads source documents, invokes projection calculations, writes dated positions, and manages monthly close operations.
 */
import { FieldPath, FieldValue } from 'firebase-admin/firestore'
import {
  applyTrackingMonth,
  buildPositionMonth,
  updateFinancialYearProjection,
} from './projection.js'
import { calculatePositionsAt } from './position-calculations.js'

const PROJECTION_SECTIONS = ['assets', 'liabilities', 'income', 'expenses']
/**
 * Loads sources and transactionally creates or refreshes the requested financial-year sections.
 */
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
    if (createOnly && latestSnapshot.exists && latest.months) {
      status = 'existing'
      return
    }
    const affectedSections = latest.months ? normalizeSections(sections) : PROJECTION_SECTIONS
    const config = await loadConfig(workspace, affectedSections, transaction)
    const [assetsSnapshot, liabilitiesSnapshot, incomeSnapshot, expenseSnapshot, trackingSnapshot] =
      await Promise.all([
        affectedSections.includes('assets') ?
          transaction.get(workspace.collection('modelAssets')) :
          null,
        affectedSections.includes('liabilities') || affectedSections.includes('expenses') ?
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
    const positions = calculatePositionsAt({
      assets: documents(assetsSnapshot),
      liabilities: documents(liabilitiesSnapshot),
      asOfDate: madridToday(),
    })
    const source = {
      year,
      config,
      assets: positions.assets,
      liabilities: positions.liabilities,
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

/**
 * Reapplies one persisted tracking period to its materialized financial-year month.
 */
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

/**
 * Writes observed positions into one month without altering closed historical positions.
 */
async function writeFinancialYearPositionMonth(
  firestore,
  workspaceId,
  { period, asOfDate, status },
) {
  assertWorkspaceId(workspaceId)
  assertPeriod(period)
  assertDate(asOfDate)
  if (!['current', 'closed'].includes(status)) {
    throw new Error('A valid financial position status is required')
  }

  const year = Number(period.slice(0, 4))
  const month = period.slice(5, 7)
  const workspace = firestore.collection('workspaces').doc(workspaceId)
  const target = workspace.collection('financialYears').doc(String(year))
  let result = null
  await firestore.runTransaction(async (transaction) => {
    const [workspaceSnapshot, targetSnapshot] = await Promise.all([
      transaction.get(workspace),
      transaction.get(target),
    ])
    if (!workspaceSnapshot.exists || workspaceSnapshot.data()?.deletionPendingAt) {
      result = { status: 'skipped', period }
      return
    }
    if (!targetSnapshot.exists || !targetSnapshot.data()?.months?.[month]) {
      result = { status: 'missing', period }
      return
    }
    const financialYear = targetSnapshot.data()
    if (financialYear.months[month]?.positionStatus === 'closed') {
      result = { status: 'existing', period }
      return
    }
    const [assetsConfig, liabilitiesConfig, assets, liabilities] = await Promise.all([
      transaction.get(workspace.collection('modelConfig').doc('assets')),
      transaction.get(workspace.collection('modelConfig').doc('liabilities')),
      transaction.get(workspace.collection('modelAssets')),
      transaction.get(workspace.collection('modelLiabilities')),
    ])

    const positions = calculatePositionsAt({
      assets: documents(assets),
      liabilities: documents(liabilities),
      asOfDate,
    })
    const assetsPosition = buildPositionMonth(
      assetsConfig.data()?.categories || {},
      positions.assets,
      'currentValue',
    )
    const liabilitiesPosition = buildPositionMonth(
      liabilitiesConfig.data()?.categories || {},
      positions.liabilities,
      'balance',
    )
    const previousMonth = financialYear.months[month]
    transaction.set(target, {
      ...financialYear,
      status: year < currentYear() ? 'closed' : 'active',
      months: {
        ...financialYear.months,
        [month]: {
          ...previousMonth,
          assets: assetsPosition,
          liabilities: liabilitiesPosition,
          positionStatus: status,
          positionAsOf: asOfDate,
          positionCalculatedAt: FieldValue.serverTimestamp(),
        },
      },
      updatedAt: FieldValue.serverTimestamp(),
    })
    result = { status: 'written', period }
  })
  return result || { status: 'skipped', period }
}

/**
 * Backfills eligible observed position months through the requested date.
 */
async function synchronizeFinancialYearPositions(firestore, workspaceId, asOfDate) {
  assertWorkspaceId(workspaceId)
  assertDate(asOfDate)
  const year = Number(asOfDate.slice(0, 4))
  const month = asOfDate.slice(5, 7)
  const workspace = firestore.collection('workspaces').doc(workspaceId)
  const [currentSnapshot, previousSnapshot] = await Promise.all([
    workspace.collection('financialYears').doc(String(year)).get(),
    workspace.collection('financialYears').doc(String(year - 1)).get(),
  ])

  if (
    previousSnapshot.exists &&
    firstObservedPositionMonth(previousSnapshot.data()) &&
    previousSnapshot.data()?.months?.['12']?.positionStatus !== 'closed'
  ) {
    await writeFinancialYearPositionMonth(firestore, workspaceId, {
      period: `${year - 1}-12`,
      asOfDate: `${year - 1}-12-31`,
      status: 'closed',
    })
  }

  if (!currentSnapshot.exists) return { status: 'missing', period: `${year}-${month}` }
  const currentFinancialYear = currentSnapshot.data()
  const firstMonth = firstObservedPositionMonth(currentFinancialYear)
  if (!firstMonth) return { status: 'skipped', period: `${year}-${month}` }

  const currentPeriod = `${year}-${month}`
  for (const period of periodsBetween(`${year}-${firstMonth}`, previousPeriod(currentPeriod))) {
    if (currentFinancialYear.months?.[period.slice(5, 7)]?.positionStatus === 'closed') continue
    await writeFinancialYearPositionMonth(firestore, workspaceId, {
      period,
      asOfDate: lastDateOfPeriod(period),
      status: 'closed',
    })
  }
  return writeFinancialYearPositionMonth(firestore, workspaceId, {
    period: currentPeriod,
    asOfDate,
    status: 'current',
  })
}

/**
 * Finalizes the previous calendar month as a closed financial position.
 */
async function closePreviousFinancialPositionMonth(firestore, workspaceId, today) {
  assertDate(today)
  const period = previousPeriod(today.slice(0, 7))
  const request = {
    period,
    asOfDate: lastDateOfPeriod(period),
    status: 'closed',
  }
  const result = await writeFinancialYearPositionMonth(firestore, workspaceId, request)
  if (result.status !== 'missing') return result

  await rebuildFinancialYear(firestore, workspaceId, Number(period.slice(0, 4)), {
    positionMonth: period.slice(5, 7),
  })
  return writeFinancialYearPositionMonth(firestore, workspaceId, request)
}

/**
 * Recalculates model-driven assets, liabilities, and linked expenses before projection.
 */
async function refreshModeledPositions(
  firestore,
  workspaceId,
  userId,
  asOfDate = madridToday(),
) {
  assertWorkspaceId(workspaceId)
  const workspace = firestore.collection('workspaces').doc(workspaceId)
  const assets = workspace.collection('modelAssets').where('categoryId', '==', 'real_estate')
  const mortgages = workspace
    .collection('modelLiabilities')
    .where('categoryId', '==', 'mortgage')
  const result = {
    assetsUpdated: 0,
    liabilitiesUpdated: 0,
    expensesUpdated: 0,
    mortgagesMigrated: 0,
  }
  await firestore.runTransaction(async (transaction) => {
    const [assetsSnapshot, mortgagesSnapshot] = await Promise.all([
      transaction.get(assets),
      transaction.get(mortgages),
    ])
    const positions = calculatePositionsAt({
      assets: documents(assetsSnapshot),
      liabilities: documents(mortgagesSnapshot),
      asOfDate,
    })
    const assetsById = new Map(positions.assets.map((asset) => [asset.id, asset]))
    const liabilitiesById = new Map(
      positions.liabilities.map((liability) => [liability.id, liability]),
    )
    for (const document of assetsSnapshot.docs || []) {
      const asset = document.data()
      if (asset.detail?.realEstate?.schemaVersion !== 2) continue
      const currentValue = assetsById.get(document.id).currentValue
      if (Number(asset.currentValue) === currentValue && asset.valueSource === 'model') continue
      transaction.update(document.ref, {
        currentValue,
        valueSource: 'model',
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: userId,
      })
      result.assetsUpdated += 1
    }
    for (const document of mortgagesSnapshot.docs || []) {
      const liability = document.data()
      const mortgage = liability.detail?.mortgage
      if (!mortgage) continue
      if (mortgage.schemaVersion === 1) {
        transaction.update(document.ref, {
          'detail.mortgage': {
            ...mortgage,
            schemaVersion: 2,
            balanceAnchor: { amount: Number(liability.balance || 0), date: asOfDate },
          },
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: userId,
        })
        result.mortgagesMigrated += 1
        continue
      }
      if (mortgage.schemaVersion !== 2) continue
      const balance = liabilitiesById.get(document.id).balance
      if (Number(liability.balance) === balance) continue
      transaction.update(document.ref, {
        balance,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: userId,
      })
      result.liabilitiesUpdated += 1
    }
  })
  return result
}

/**
 * Loads config required by the surrounding operation.
 */
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

/**
 * Validates and converts sections into its canonical representation.
 */
function normalizeSections(sections) {
  const normalized = [...new Set(sections)].filter((section) =>
    PROJECTION_SECTIONS.includes(section),
  )
  if (!normalized.length) {
    throw new Error('At least one financial year section is required')
  }
  return normalized
}

/**
 * Converts a Firestore snapshot into plain documents that include their IDs.
 */
function documents(snapshot) {
  return (snapshot?.docs || []).map((document) => ({ id: document.id, ...document.data() }))
}

/**
 * Returns the first observed position month matching the requested boundary.
 */
function firstObservedPositionMonth(financialYear) {
  const months = [
    financialYear?.projectionState?.assetsInitializedMonth,
    financialYear?.projectionState?.liabilitiesInitializedMonth,
  ].filter((value) => /^(0[1-9]|1[0-2])$/.test(String(value || '')))
  if (months.length) return months.sort()[0]
  return (
    Object.entries(financialYear?.months || {})
      .filter(([, month]) =>
        ['assets', 'liabilities'].some(
          (section) => Object.keys(month?.[section]?.categories || {}).length > 0,
        ),
      )
      .map(([month]) => month)
      .sort()[0] || null
  )
}

/**
 * Returns every inclusive monthly period between two YYYY-MM boundaries.
 */
function periodsBetween(first, last) {
  if (first > last) return []
  const periods = []
  let period = first
  while (period <= last) {
    periods.push(period)
    const [year, month] = period.split('-').map(Number)
    period = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7)
  }
  return periods
}

/**
 * Returns the calendar period immediately preceding period.
 */
function previousPeriod(period) {
  const [year, month] = period.split('-').map(Number)
  return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7)
}

/**
 * Returns the canonical last date of a YYYY-MM period.
 */
function lastDateOfPeriod(period) {
  const [year, month] = period.split('-').map(Number)
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
}

/**
 * Returns the earliest month from which a position can be rewritten.
 */
function positionStartMonth(financialYear, section, observedMonth) {
  const initializedMonth = financialYear?.projectionState?.[`${section}InitializedMonth`]
  return !initializedMonth || initializedMonth === observedMonth ? '01' : observedMonth
}

/**
 * Returns current year in the financial calendar.
 */
function currentYear() {
  return Number(
    new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Europe/Madrid' }).format(
      new Date(),
    ),
  )
}

/**
 * Returns current month in the financial calendar.
 */
function currentMonth() {
  return new Intl.DateTimeFormat('en', {
    month: '2-digit',
    timeZone: 'Europe/Madrid',
  }).format(new Date())
}

/**
 * Returns today’s canonical date in the Europe/Madrid time zone.
 */
function madridToday() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Europe/Madrid',
    })
      .formatToParts(new Date())
      .map(({ type, value }) => [type, value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}

/**
 * Validates workspace id and throws a descriptive error when its contract is not satisfied.
 */
function assertWorkspaceId(value) {
  if (!String(value || '').trim()) throw new Error('A workspace ID is required')
}

/**
 * Validates year and throws a descriptive error when its contract is not satisfied.
 */
function assertYear(value) {
  if (!Number.isInteger(value) || value < 2000 || value > 9999) {
    throw new Error('A valid financial year is required')
  }
}

/**
 * Validates period and throws a descriptive error when its contract is not satisfied.
 */
function assertPeriod(value) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || ''))) {
    throw new Error('A valid financial position period is required')
  }
}

/**
 * Validates date and throws a descriptive error when its contract is not satisfied.
 */
function assertDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) throw new Error('A valid financial position date is required')
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() !== Number(match[2]) - 1 ||
    date.getUTCDate() !== Number(match[3])
  ) {
    throw new Error('A valid financial position date is required')
  }
}

export {
  closePreviousFinancialPositionMonth,
  madridToday,
  currentMonth,
  currentYear,
  positionStartMonth,
  rebuildFinancialYear,
  refreshFinancialYearTrackingMonth,
  refreshModeledPositions,
  synchronizeFinancialYearPositions,
  writeFinancialYearPositionMonth,
}
