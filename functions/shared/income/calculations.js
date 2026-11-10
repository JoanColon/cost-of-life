import { CALENDAR_MONTH_IDS } from '../core/calendar-months.js'
import { normalizeNonNegativeMoneyOrNull, roundMoneyOrZero } from '../core/money.js'

export const RECURRING_INCOME_FREQUENCIES = Object.freeze(['monthly', 'quarterly', 'yearly'])
const INCOME_CALCULATION_MODES = Object.freeze([
  'annual_salary',
  'monthly_schedule',
  'recurring',
  'one_time',
])
const FREQUENCY_MULTIPLIERS = Object.freeze({ monthly: 12, quarterly: 4, yearly: 1 })

/** Normalizes the percentage of an income amount that is available for household planning. */
export function normalizeDisposableIncomePercent(value, fallback = null) {
  if (value == null || value === '') return fallback
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0 || number > 100) return null
  return Math.round((number + Number.EPSILON) * 1000) / 1000
}

/** Applies a disposable percentage to an income amount, returning null for invalid inputs. */
export function calculateDisposableIncomeAmount(value, percentage = 100) {
  const amount = normalizeNonNegativeMoneyOrNull(value)
  const normalizedPercentage = normalizeDisposableIncomePercent(percentage, 100)
  if (amount === null || normalizedPercentage === null) return null
  return normalizeNonNegativeMoneyOrNull((amount * normalizedPercentage) / 100)
}

/** Validates and canonicalizes one supported income calculation model. */
export function normalizeIncomeCalculationModel(calculation) {
  if (!INCOME_CALCULATION_MODES.includes(calculation?.mode)) return null
  if (calculation.mode === 'annual_salary') {
    const annualAmount = normalizeNonNegativeMoneyOrNull(calculation.annualAmount)
    const paymentsPerYear = normalizePositiveInteger(calculation.paymentsPerYear)
    return annualAmount === null || paymentsPerYear === null ?
      null :
      { mode: 'annual_salary', annualAmount, paymentsPerYear }
  }
  if (calculation.mode === 'monthly_schedule') {
    const monthlyAmount = normalizeNonNegativeMoneyOrNull(calculation.monthlyAmount)
    if (monthlyAmount === null || !isPlainObject(calculation.extrasByMonth)) return null
    const extrasByMonth = {}
    for (const [month, value] of Object.entries(calculation.extrasByMonth)) {
      const amount = normalizeNonNegativeMoneyOrNull(value)
      if (!CALENDAR_MONTH_IDS.includes(month) || amount === null) return null
      if (amount > 0) extrasByMonth[month] = amount
    }
    return { mode: 'monthly_schedule', monthlyAmount, extrasByMonth }
  }
  const amount = normalizeNonNegativeMoneyOrNull(calculation.amount)
  if (amount === null) return null
  if (calculation.mode === 'one_time') {
    const month = CALENDAR_MONTH_IDS.includes(calculation.month) ? calculation.month : 'january'
    return { mode: 'one_time', amount, month }
  }
  if (!RECURRING_INCOME_FREQUENCIES.includes(calculation.frequency)) return null
  return { mode: 'recurring', amount, frequency: calculation.frequency }
}

/** Calculates the annual amount represented by a validated income model. */
export function calculateAnnualIncomeAmount(calculation) {
  const normalized = normalizeIncomeCalculationModel(calculation)
  if (!normalized) return null
  if (normalized.mode === 'annual_salary') return normalized.annualAmount
  if (normalized.mode === 'monthly_schedule') {
    return normalizeNonNegativeMoneyOrNull(
      normalized.monthlyAmount * 12 +
        Object.values(normalized.extrasByMonth).reduce((total, value) => total + value, 0),
    )
  }
  if (normalized.mode === 'one_time') return normalized.amount
  return normalizeNonNegativeMoneyOrNull(
    normalized.amount * FREQUENCY_MULTIPLIERS[normalized.frequency],
  )
}

/** Returns annual, per-payment, and monthly-average values useful for presenting an income model. */
export function calculateIncomeBreakdown(calculation) {
  const normalized = normalizeIncomeCalculationModel(calculation)
  const annualValue = calculateAnnualIncomeAmount(normalized)
  if (!normalized || annualValue === null) return null
  if (normalized.mode === 'annual_salary') {
    return {
      annualValue,
      perPayment: normalizeNonNegativeMoneyOrNull(annualValue / normalized.paymentsPerYear),
      monthlyAverage: normalizeNonNegativeMoneyOrNull(annualValue / 12),
    }
  }
  return { annualValue, monthlyAverage: normalizeNonNegativeMoneyOrNull(annualValue / 12) }
}

/**
 * Calculates the projected amount for a specific zero-based calendar month.
 * Annual values are distributed in cents, with the remainder assigned to the earliest months.
 */
export function calculateIncomeAmountForMonth(calculation, monthIndex) {
  if (calculation?.mode === 'monthly_schedule') {
    return roundMoneyOrZero(
      (Number(calculation.monthlyAmount) || 0) +
        (Number(calculation.extrasByMonth?.[CALENDAR_MONTH_IDS[monthIndex]]) || 0),
    )
  }
  if (calculation?.mode === 'annual_salary') {
    return distributeAnnualAmountByMonth(calculation.annualAmount, monthIndex)
  }
  if (calculation?.mode === 'one_time') {
    const month = CALENDAR_MONTH_IDS.includes(calculation.month) ? calculation.month : 'january'
    return month === CALENDAR_MONTH_IDS[monthIndex] ? roundMoneyOrZero(calculation.amount) : 0
  }
  const multiplier = FREQUENCY_MULTIPLIERS[calculation?.frequency] || 0
  return distributeAnnualAmountByMonth((Number(calculation?.amount) || 0) * multiplier, monthIndex)
}

/** Splits an annual amount across twelve months while preserving the exact annual cents total. */
export function distributeAnnualAmountByMonth(value, monthIndex) {
  const annualCents = Math.round(roundMoneyOrZero(value) * 100)
  const monthlyCents = Math.floor(annualCents / 12)
  const remainder = annualCents % 12
  return roundMoneyOrZero((monthlyCents + (monthIndex < remainder ? 1 : 0)) / 100)
}

function normalizePositiveInteger(value) {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : null
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
