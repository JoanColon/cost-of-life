/**
 * Canonical expense-model normalization and calculations for frequencies, monthly schedules, classifications, and monthly projected amounts.
 */
import { CALENDAR_MONTH_IDS } from '../core/calendar-months.js'
import { normalizeNonNegativeMoneyOrNull } from '../core/money.js'

export const EXPENSE_FREQUENCIES = Object.freeze([
  'monthly',
  'every_two_months',
  'quarterly',
  'yearly',
])
export const EXPENSE_VARIABILITIES = Object.freeze(['fixed', 'variable'])
export const EXPENSE_RECURRENCES = Object.freeze(['recurring', 'occasional'])
export const EXPENSE_NECESSITIES = Object.freeze(['essential', 'lifestyle'])
const ANNUAL_MULTIPLIERS = Object.freeze({
  monthly: 12,
  every_two_months: 6,
  quarterly: 4,
  yearly: 1,
})

/** Validates and canonicalizes an amount-frequency expense estimate. */
export function normalizeExpenseEstimateModel(estimate) {
  const amount = normalizeNonNegativeMoneyOrNull(estimate?.amount)
  if (amount === null || !EXPENSE_FREQUENCIES.includes(estimate?.frequency)) return null
  return { amount, frequency: estimate.frequency }
}

/** Calculates the annual amount represented by an expense estimate. */
export function calculateAnnualExpenseAmount(estimate) {
  const normalized = normalizeExpenseEstimateModel(estimate)
  if (!normalized) return null
  return normalizeNonNegativeMoneyOrNull(normalized.amount * ANNUAL_MULTIPLIERS[normalized.frequency])
}

/** Calculates the average monthly amount represented by an expense estimate. */
export function calculateAverageMonthlyExpenseAmount(estimate) {
  const annualValue = calculateAnnualExpenseAmount(estimate)
  return annualValue === null ? null : normalizeNonNegativeMoneyOrNull(annualValue / 12)
}

/** Expands a recurring estimate into its twelve scheduled calendar-month amounts. */
export function buildMonthlyExpenseSchedule(estimate) {
  const normalized = normalizeExpenseEstimateModel(estimate)
  if (!normalized) return null
  const interval = { monthly: 1, every_two_months: 2, quarterly: 3, yearly: 12 }[
    normalized.frequency
  ]
  return Object.fromEntries(
    CALENDAR_MONTH_IDS.map((month, index) => [
      month,
      index % interval === 0 ? normalized.amount : 0,
    ]),
  )
}

/** Preserves manual month overrides while replacing amounts that still match the old estimate. */
export function updateMonthlyExpenseSchedule(amounts, previousEstimate, nextEstimate) {
  const current = normalizeMonthlyExpenseSchedule(amounts)
  const previousBaseline = buildMonthlyExpenseSchedule(previousEstimate)
  const nextBaseline = buildMonthlyExpenseSchedule(nextEstimate)
  if (!nextBaseline) return null
  if (!current || !previousBaseline) return nextBaseline
  return Object.fromEntries(
    CALENDAR_MONTH_IDS.map((month) => [
      month,
      current[month] === previousBaseline[month] ? nextBaseline[month] : current[month],
    ]),
  )
}

/** Validates and rounds all twelve values in an explicit monthly expense schedule. */
export function normalizeMonthlyExpenseSchedule(amounts) {
  if (!amounts || typeof amounts !== 'object' || Array.isArray(amounts)) return null
  const normalized = {}
  for (const month of CALENDAR_MONTH_IDS) {
    const value = normalizeNonNegativeMoneyOrNull(amounts[month])
    if (value === null) return null
    normalized[month] = value
  }
  return normalized
}

/** Sums an explicit monthly schedule, falling back to an amount-frequency estimate. */
export function calculateAnnualExpenseScheduleAmount(amounts, fallbackEstimate = null) {
  const normalized = normalizeMonthlyExpenseSchedule(amounts)
  if (!normalized) return calculateAnnualExpenseAmount(fallbackEstimate)
  return normalizeNonNegativeMoneyOrNull(
    CALENDAR_MONTH_IDS.reduce((total, month) => total + normalized[month], 0),
  )
}

/** Validates the behavioral attributes attached to an expense. */
export function normalizeExpenseClassification({ variability, recurrence, necessity }) {
  if (!EXPENSE_VARIABILITIES.includes(variability)) return null
  if (!EXPENSE_RECURRENCES.includes(recurrence)) return null
  if (necessity != null && !EXPENSE_NECESSITIES.includes(necessity)) return null
  return { variability, recurrence, necessity: necessity ?? null }
}

/** Resolves an expense's projected amount for a named month, honoring explicit month overrides. */
export function calculateExpenseAmountForMonth(expense, monthName) {
  if (expense?.monthlyAmounts && Object.hasOwn(expense.monthlyAmounts, monthName)) {
    return normalizeNonNegativeMoneyOrNull(expense.monthlyAmounts[monthName]) || 0
  }
  const schedule = buildMonthlyExpenseSchedule(expense?.estimate)
  return schedule?.[monthName] || 0
}
