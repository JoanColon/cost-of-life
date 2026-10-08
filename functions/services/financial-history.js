const { FieldPath, FieldValue, Timestamp } = require('firebase-admin/firestore')
const {
  FINANCIAL_HISTORY_SCHEMA_VERSION,
  assertValidPeriod,
  buildMonthlyFinancialSnapshot,
} = require('../domain/financial-history')

function documentsFromSnapshot(snapshot) {
  return snapshot.docs.map((document) => ({
    id: document.id,
    data: document.data(),
  }))
}

async function captureMonthlyFinancialSnapshot(
  firestore,
  workspaceId,
  year,
  month,
  { replace = false } = {},
) {
  if (!String(workspaceId || '').trim()) throw new Error('A workspace ID is required')
  assertValidPeriod(year, month)

  const workspaceRef = firestore.collection('workspaces').doc(workspaceId)
  const historyRef = workspaceRef.collection('history').doc(String(year))
  const assetsSummaryRef = workspaceRef.collection('financialPosition').doc('assetsSummary')
  const liabilitiesSummaryRef = workspaceRef
    .collection('financialPosition')
    .doc('liabilitiesSummary')
  const assetsQuery = workspaceRef.collection('assets')
  const liabilitiesQuery = workspaceRef.collection('liabilities')

  return firestore.runTransaction(async (transaction) => {
    const historyDocument = await transaction.get(historyRef)
    const existingHistory = historyDocument.data() || {}

    if (!replace && Object.hasOwn(existingHistory.months || {}, month)) {
      return { status: 'skipped', workspaceId, year, month }
    }

    const [assetsSummary, liabilitiesSummary, assets, liabilities] = await Promise.all([
      transaction.get(assetsSummaryRef),
      transaction.get(liabilitiesSummaryRef),
      transaction.get(assetsQuery),
      transaction.get(liabilitiesQuery),
    ])
    const { snapshot, itemLabels } = buildMonthlyFinancialSnapshot({
      assetsSummary: assetsSummary.data() || null,
      liabilitiesSummary: liabilitiesSummary.data() || null,
      assets: documentsFromSnapshot(assets),
      liabilities: documentsFromSnapshot(liabilities),
      capturedAt: Timestamp.now(),
    })

    if (!historyDocument.exists) {
      transaction.create(historyRef, {
        year,
        schemaVersion: FINANCIAL_HISTORY_SCHEMA_VERSION,
        itemLabels,
        months: { [month]: snapshot },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
    } else {
      transaction.update(
        historyRef,
        new FieldPath('months', month),
        snapshot,
        new FieldPath('itemLabels', 'assets'),
        { ...(existingHistory.itemLabels?.assets || {}), ...itemLabels.assets },
        new FieldPath('itemLabels', 'liabilities'),
        { ...(existingHistory.itemLabels?.liabilities || {}), ...itemLabels.liabilities },
        'schemaVersion',
        FINANCIAL_HISTORY_SCHEMA_VERSION,
        'updatedAt',
        FieldValue.serverTimestamp(),
      )
    }

    return {
      status:
        replace && Object.hasOwn(existingHistory.months || {}, month) ? 'replaced' : 'created',
      workspaceId,
      year,
      month,
    }
  })
}

module.exports = { captureMonthlyFinancialSnapshot }
