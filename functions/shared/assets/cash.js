/**
 * Pure Cash asset projections and portfolio return aggregation.
 * Recorded balances remain observations; these functions only model future values.
 */
import { roundMoneyOrZero } from '../core/money.js'
import {
  compoundReturnFactorForMonths,
  normalizeAnnualReturnPercent,
} from '../core/rates.js'

/** Projects a recorded Cash balance using an effective annual compound return. */
export function projectCashValue({ currentBalance = 0, annualReturnPercent = 0, months = 0 } = {}) {
  return roundMoneyOrZero(
    compoundCashBalance({ currentBalance, annualReturnPercent, months }),
  )
}

/** Compounds a Cash balance without intermediate currency rounding. */
export function compoundCashBalance({
  currentBalance = 0,
  annualReturnPercent = 0,
  months = 0,
} = {}) {
  const balance = nonNegativeBalance(currentBalance)
  const rate = requireAnnualReturn(annualReturnPercent)
  const horizon = nonNegativeMonths(months)
  return balance * compoundReturnFactorForMonths(rate, horizon)
}

/**
 * Calculates the balance-weighted annual return for normalized Cash positions.
 * Missing or invalid returns contribute zero; invalid or negative balances are ignored.
 */
export function calculateWeightedCashAnnualReturn(positions = []) {
  let totalBalance = 0
  let weightedReturn = 0

  for (const position of Array.isArray(positions) ? positions : []) {
    const balance = Number(position?.balance)
    if (!Number.isFinite(balance) || balance <= 0) continue
    const annualReturnPercent = normalizeAnnualReturnPercent(position?.annualReturnPercent, 0) || 0
    totalBalance += balance
    weightedReturn += balance * annualReturnPercent
  }

  return totalBalance > 0 ? weightedReturn / totalBalance : 0
}

function nonNegativeBalance(value) {
  const balance = Number(value)
  if (!Number.isFinite(balance) || balance < 0) {
    throw new RangeError('A valid Cash balance is required')
  }
  return balance
}

function requireAnnualReturn(value) {
  const rate = normalizeAnnualReturnPercent(value)
  if (rate == null) throw new RangeError('A valid annual Cash return is required')
  return rate
}

function nonNegativeMonths(value) {
  const months = Number(value)
  if (!Number.isFinite(months) || months < 0) {
    throw new RangeError('A valid Cash projection horizon is required')
  }
  return months
}
