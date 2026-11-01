const { FieldValue } = require('firebase-admin/firestore')
const { buildPositionMonth } = require('../domain/financial-year')
const { calculatePositionsAt } = require('../domain/positions')

async function writePositionSnapshot(
  firestore,
  workspaceId,
  { period, asOfDate, status },
) {
  assertPeriod(period)
  assertDate(asOfDate)
  if (!['current', 'closed'].includes(status)) throw new Error('A valid snapshot status is required')

  const workspace = firestore.collection('workspaces').doc(workspaceId)
  const target = workspace.collection('positionSnapshots').doc(period)
  let result = null
  await firestore.runTransaction(async (transaction) => {
    const [workspaceSnapshot, targetSnapshot, assetsConfig, liabilitiesConfig, assets, liabilities] =
      await Promise.all([
        transaction.get(workspace),
        transaction.get(target),
        transaction.get(workspace.collection('modelConfig').doc('assets')),
        transaction.get(workspace.collection('modelConfig').doc('liabilities')),
        transaction.get(workspace.collection('modelAssets')),
        transaction.get(workspace.collection('modelLiabilities')),
      ])
    if (!workspaceSnapshot.exists || workspaceSnapshot.data()?.deletionPendingAt) return
    if (targetSnapshot.data()?.status === 'closed') {
      result = { status: 'existing', period }
      return
    }

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
    const assetsTotal = positionTotal(assetsPosition)
    const liabilitiesTotal = positionTotal(liabilitiesPosition)
    const snapshot = {
      schemaVersion: 1,
      period,
      asOfDate,
      status,
      assets: assetsPosition,
      liabilities: liabilitiesPosition,
      totals: {
        assets: assetsTotal,
        liabilities: liabilitiesTotal,
        netWorth: roundMoney(assetsTotal - liabilitiesTotal),
      },
      calculatedAt: FieldValue.serverTimestamp(),
    }
    transaction.set(target, snapshot)
    result = { status: 'written', period }
  })
  return result || { status: 'skipped', period }
}

async function synchronizePositionSnapshots(firestore, workspaceId, asOfDate) {
  assertDate(asOfDate)
  const currentPeriod = asOfDate.slice(0, 7)
  const collection = firestore
    .collection('workspaces')
    .doc(workspaceId)
    .collection('positionSnapshots')
  const existing = documents(await collection.get()).sort((left, right) =>
    left.period.localeCompare(right.period),
  )
  const earliest = existing[0]?.period || null
  if (earliest) {
    for (const period of periodsBetween(earliest, previousPeriod(currentPeriod))) {
      const snapshot = existing.find((candidate) => candidate.period === period)
      if (snapshot?.status === 'closed') continue
      await writePositionSnapshot(firestore, workspaceId, {
        period,
        asOfDate: lastDateOfPeriod(period),
        status: 'closed',
      })
    }
  }
  return writePositionSnapshot(firestore, workspaceId, {
    period: currentPeriod,
    asOfDate,
    status: 'current',
  })
}

async function closePreviousPositionMonth(firestore, workspaceId, today) {
  assertDate(today)
  const period = previousPeriod(today.slice(0, 7))
  return writePositionSnapshot(firestore, workspaceId, {
    period,
    asOfDate: lastDateOfPeriod(period),
    status: 'closed',
  })
}

function periodsBetween(first, last) {
  if (first > last) return []
  const periods = []
  let period = first
  while (period <= last) {
    periods.push(period)
    period = nextPeriod(period)
  }
  return periods
}

function nextPeriod(period) {
  const [year, month] = period.split('-').map(Number)
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7)
}

function previousPeriod(period) {
  const [year, month] = period.split('-').map(Number)
  return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7)
}

function lastDateOfPeriod(period) {
  const [year, month] = period.split('-').map(Number)
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
}

function documents(snapshot) {
  return (snapshot?.docs || []).map((document) => ({ id: document.id, ...document.data() }))
}

function positionTotal(position) {
  return roundMoney(
    Object.values(position?.categories || {}).reduce(
      (categoryTotal, category) =>
        categoryTotal +
        Object.values(category?.subcategories || {}).reduce(
          (subcategoryTotal, subcategory) => subcategoryTotal + Number(subcategory?.total || 0),
          0,
        ),
      0,
    ),
  )
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

function assertPeriod(value) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || ''))) {
    throw new Error('A valid snapshot period is required')
  }
}

function assertDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) throw new Error('A valid snapshot date is required')
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() !== Number(match[2]) - 1 ||
    date.getUTCDate() !== Number(match[3])
  ) {
    throw new Error('A valid snapshot date is required')
  }
}

module.exports = {
  closePreviousPositionMonth,
  lastDateOfPeriod,
  synchronizePositionSnapshots,
  writePositionSnapshot,
}
