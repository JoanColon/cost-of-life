import { normalizeNonNegativeMoney } from './money'

export const recurringIncomeFrequencies = ['monthly', 'quarterly', 'yearly']
export const incomeMonths = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
]
const incomeCalculationModes = ['annual_salary', 'monthly_schedule', 'recurring', 'one_time']

const frequencyMultipliers = {
  monthly: 12,
  quarterly: 4,
  yearly: 1,
}

export function normalizeDisposablePercentage(value, fallback = null) {
  if (value == null || value === '') return fallback
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0 || number > 100) return null
  return Math.round((number + Number.EPSILON) * 1000) / 1000
}

export function disposableIncomeValue(value, percentage = 100) {
  const amount = normalizeNonNegativeMoney(value)
  const normalizedPercentage = normalizeDisposablePercentage(percentage, 100)
  if (amount === null || normalizedPercentage === null) return null
  return normalizeNonNegativeMoney((amount * normalizedPercentage) / 100)
}

export function normalizeIncomeCalculation(calculation) {
  if (!incomeCalculationModes.includes(calculation?.mode)) return null

  if (calculation.mode === 'annual_salary') {
    const annualAmount = normalizeNonNegativeMoney(calculation.annualAmount)
    const paymentsPerYear = normalizePositiveInteger(calculation.paymentsPerYear)
    if (annualAmount === null || paymentsPerYear === null) return null
    return { mode: 'annual_salary', annualAmount, paymentsPerYear }
  }

  if (calculation.mode === 'monthly_schedule') {
    const monthlyAmount = normalizeNonNegativeMoney(calculation.monthlyAmount)
    if (monthlyAmount === null || !isPlainObject(calculation.extrasByMonth)) return null

    const extrasByMonth = {}
    for (const [month, value] of Object.entries(calculation.extrasByMonth)) {
      const amount = normalizeNonNegativeMoney(value)
      if (!incomeMonths.includes(month) || amount === null) return null
      if (amount > 0) extrasByMonth[month] = amount
    }
    return { mode: 'monthly_schedule', monthlyAmount, extrasByMonth }
  }

  const amount = normalizeNonNegativeMoney(calculation.amount)
  if (amount === null) return null

  if (calculation.mode === 'one_time') {
    const month = incomeMonths.includes(calculation.month) ? calculation.month : 'january'
    return { mode: 'one_time', amount, month }
  }
  if (!recurringIncomeFrequencies.includes(calculation.frequency)) return null
  return { mode: 'recurring', amount, frequency: calculation.frequency }
}

export function annualIncomeValue(calculation) {
  const normalized = normalizeIncomeCalculation(calculation)
  if (!normalized) return null

  if (normalized.mode === 'annual_salary') return normalized.annualAmount
  if (normalized.mode === 'monthly_schedule') {
    return normalizeNonNegativeMoney(
      normalized.monthlyAmount * 12 +
        Object.values(normalized.extrasByMonth).reduce((total, value) => total + value, 0),
    )
  }
  if (normalized.mode === 'one_time') return normalized.amount
  return normalizeNonNegativeMoney(normalized.amount * frequencyMultipliers[normalized.frequency])
}

export function incomeCalculationBreakdown(calculation) {
  const normalized = normalizeIncomeCalculation(calculation)
  const annualValue = annualIncomeValue(normalized)
  if (!normalized || annualValue === null) return null

  if (normalized.mode === 'annual_salary') {
    return {
      annualValue,
      perPayment: normalizeNonNegativeMoney(annualValue / normalized.paymentsPerYear),
      monthlyAverage: normalizeNonNegativeMoney(annualValue / 12),
    }
  }

  if (normalized.mode === 'monthly_schedule') {
    return {
      annualValue,
      monthlyAverage: normalizeNonNegativeMoney(annualValue / 12),
    }
  }

  return { annualValue, monthlyAverage: normalizeNonNegativeMoney(annualValue / 12) }
}

function normalizePositiveInteger(value) {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : null
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
