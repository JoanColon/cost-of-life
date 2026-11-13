/**
 * Small deterministic metrics derived from financial positions, including net worth, savings capacity, safety coverage, and funded years.
 */
import { roundMoneyOrZero } from '../core/money.js'

/** Calculates net worth as total assets minus total liabilities at the same valuation date. */
export function calculateNetWorth(totalAssets, totalLiabilities) {
  return roundMoneyOrZero((Number(totalAssets) || 0) - (Number(totalLiabilities) || 0))
}

/**
 * Calculates savings capacity as disposable income minus cost of life for the same period.
 * The result is intentionally not rounded: each consumer retains its existing precision policy.
 */
export function calculateSavingsCapacity(disposableIncome, costOfLife) {
  return (Number(disposableIncome) || 0) - (Number(costOfLife) || 0)
}

/** Calculates the whole-percentage share of disposable income retained as savings capacity. */
export function calculateSavingsRatePercent(savingsCapacity, disposableIncome) {
  const income = Number(disposableIncome) || 0
  return income > 0 ? Math.round(((Number(savingsCapacity) || 0) / income) * 100) : 0
}

/** Calculates the whole-percentage share of disposable income consumed by cost of life. */
export function calculateCostOfLifeRatioPercent(costOfLife, disposableIncome) {
  const income = Number(disposableIncome) || 0
  return income > 0 ? Math.round(((Number(costOfLife) || 0) / income) * 100) : 0
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
