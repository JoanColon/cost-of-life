import { setGlobalOptions } from 'firebase-functions'
import { initializeApp } from 'firebase-admin/app'

export { mutateFinancialModel } from './features/financial-model/callable.js'
export { ensureFinancialYear } from './features/financial-years/callable.js'
export {
  readInvestmentPortfolioSheet,
  syncWorkspaceInvestmentPortfolios,
  updateInvestmentPortfolio,
} from './features/investment-portfolios/callable.js'
export {
  acceptWorkspaceInvite,
  createWorkspaceInvite,
  deleteWorkspace,
  getWorkspaceInvite,
  updateWorkspaceSettings,
} from './features/workspaces/callable.js'
export { closeMonthlyFinancialPositions } from './features/financial-years/close-month.schedule.js'
export {
  onExpenseTrackingWritten,
  onModelConfigWritten,
} from './features/financial-years/triggers.js'

setGlobalOptions({ maxInstances: 10 })

initializeApp()
