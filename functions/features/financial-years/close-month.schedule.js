/**
 * Scheduled month-close workflow. It refreshes external portfolios before closing each workspace position and reports individual workspace failures for retry.
 */
import { getFirestore } from 'firebase-admin/firestore'
import * as logger from 'firebase-functions/logger'
import { onSchedule } from 'firebase-functions/scheduler'
import {
  closePreviousFinancialPositionMonth,
  madridToday,
} from './service.js'
import { syncWorkspaceInvestmentPortfolios } from '../investment-portfolios/service.js'

// Portfolios must be synchronized immediately before the month is closed so every persisted
// position uses the latest available external valuation and dividend data.
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
      const startedAt = Date.now()
      try {
        await syncWorkspaceInvestmentPortfolios(firestore, {
          workspaceId: workspace.id,
          force: true,
          throwOnError: true,
        })
        await closePreviousFinancialPositionMonth(firestore, workspace.id, madridToday())
        logger.info('Monthly financial position closed', {
          workspaceId: workspace.id,
          durationMs: Date.now() - startedAt,
        })
      } catch (error) {
        failures.push({ workspaceId: workspace.id, error })
        logger.error('Monthly financial position close failed', {
          workspaceId: workspace.id,
          durationMs: Date.now() - startedAt,
          error: error?.message || String(error),
        })
      }
    }
    if (failures.length) {
      console.error('Failed to close monthly financial positions', failures)
      throw new Error(`Failed to close ${failures.length} monthly financial positions`)
    }
  },
)

export { closeMonthlyFinancialPositions }
