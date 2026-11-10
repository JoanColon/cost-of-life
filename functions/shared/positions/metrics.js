import { roundMoneyOrZero } from '../core/money.js'

/** Calculates net worth as total assets minus total liabilities at the same valuation date. */
export function calculateNetWorth(totalAssets, totalLiabilities) {
  return roundMoneyOrZero((Number(totalAssets) || 0) - (Number(totalLiabilities) || 0))
}

/** Calculates annual savings capacity from disposable income and annual cost of life. */
export function calculateAnnualSavingsCapacity(availableIncome, annualExpenses) {
  return roundMoneyOrZero((Number(availableIncome) || 0) - (Number(annualExpenses) || 0))
}

/** Calculates how many months of annual cost of life can be funded by a cash balance. */
export function calculateSafetyCoverageMonths(cash, annualExpenses) {
  const cost = Number(annualExpenses) || 0
  return cost > 0 ? (Number(cash) || 0) / (cost / 12) : 0
}

/** Calculates how many years of annual cost of life can be funded by investable wealth. */
export function calculateFundedYears(investableWealth, annualExpenses) {
  const cost = Number(annualExpenses) || 0
  return cost > 0 ? Math.max(0, (Number(investableWealth) || 0) / cost) : 0
}
