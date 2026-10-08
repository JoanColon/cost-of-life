const { getFirestore } = require('firebase-admin/firestore')
const { logger } = require('firebase-functions')
const { onSchedule } = require('firebase-functions/scheduler')
const { FINANCIAL_HISTORY_TIME_ZONE } = require('../config/financial-history')
const { isLastDayOfMonth, periodForInstant } = require('../domain/financial-history')
const { captureMonthlyFinancialSnapshot } = require('../services/financial-history')

const scheduledFinancialHistory = onSchedule(
  {
    schedule: '55 23 * * *',
    timeZone: FINANCIAL_HISTORY_TIME_ZONE,
    region: 'europe-west1',
    retryCount: 3,
  },
  async (event) => {
    const scheduledAt = new Date(event.scheduleTime)
    if (!isLastDayOfMonth(scheduledAt, FINANCIAL_HISTORY_TIME_ZONE)) {
      logger.info('Financial history skipped because today is not the last day of the month')
      return
    }

    const { year, month } = periodForInstant(scheduledAt, FINANCIAL_HISTORY_TIME_ZONE)
    const firestore = getFirestore()
    const workspaces = await firestore.collection('workspaces').get()
    const results = { created: 0, skipped: 0, failed: 0 }

    for (const workspace of workspaces.docs) {
      try {
        const result = await captureMonthlyFinancialSnapshot(firestore, workspace.id, year, month)
        results[result.status] += 1
      } catch (error) {
        results.failed += 1
        logger.error('Financial history capture failed', {
          workspaceId: workspace.id,
          year,
          month,
          error,
        })
      }
    }

    logger.info('Financial history capture completed', { year, month, ...results })
    if (results.failed > 0) {
      throw new Error(`Financial history failed for ${results.failed} workspaces`)
    }
  },
)

module.exports = { scheduledFinancialHistory }
