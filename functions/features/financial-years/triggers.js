/**
 * Firestore event entry points that keep financial-year projections synchronized when model configuration or expense tracking changes.
 */
import { getFirestore } from 'firebase-admin/firestore'
import { onDocumentWritten } from 'firebase-functions/firestore'
import {
  currentYear,
  rebuildFinancialYear,
  refreshFinancialYearTrackingMonth,
} from './service.js'

// Both triggers retry transient failures so the materialized financial year eventually matches
// its source model. Keep this option aligned for every financial-year projection trigger.
const triggerOptions = { region: 'europe-west1', retry: true }
const modelSections = new Set(['assets', 'liabilities', 'income', 'expenses'])

/**
 * Rebuilds the affected current-year section after a supported model configuration changes.
 */
const onModelConfigWritten = onDocumentWritten(
  { ...triggerOptions, document: 'workspaces/{workspaceId}/modelConfig/{section}' },
  (event) => {
    const { section, workspaceId } = event.params
    if (!modelSections.has(section)) return
    return rebuildCurrentFinancialYear(workspaceId, [section])
  },
)

/**
 * Reconciles a valid expense-tracking period into its corresponding financial-year month.
 */
const onExpenseTrackingWritten = onDocumentWritten(
  { ...triggerOptions, document: 'workspaces/{workspaceId}/expenseTracking/{period}' },
  async (event) => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(event.params.period))) return
    await refreshFinancialYearTrackingMonth(
      getFirestore(),
      event.params.workspaceId,
      event.params.period,
    )
  },
)

/**
 * Rebuilds selected sections of the current year after a relevant Firestore event.
 */
async function rebuildCurrentFinancialYear(workspaceId, sections) {
  await rebuildFinancialYear(getFirestore(), workspaceId, currentYear(), { sections })
}

export { onExpenseTrackingWritten, onModelConfigWritten }
