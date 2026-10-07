import { normalizeMoney } from './money'

export const recurringIncomeFrequencies = ['weekly', 'monthly', 'quarterly', 'yearly']
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
export const incomeCalculationModes = ['annual_salary', 'monthly_schedule', 'recurring', 'one_time']

const frequencyMultipliers = {
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  yearly: 1,
}

export function normalizeIncomeCalculation(calculation) {
  if (!incomeCalculationModes.includes(calculation?.mode)) return null

  if (calculation.mode === 'annual_salary') {
    const annualAmount = normalizeMoney(calculation.annualAmount)
    const paymentsPerYear = normalizePositiveInteger(calculation.paymentsPerYear)
    if (annualAmount === null || paymentsPerYear === null) return null
    return { mode: 'annual_salary', annualAmount, paymentsPerYear }
  }

  if (calculation.mode === 'monthly_schedule') {
    const monthlyAmount = normalizeMoney(calculation.monthlyAmount)
    if (monthlyAmount === null || !isPlainObject(calculation.extrasByMonth)) return null

    const extrasByMonth = {}
    for (const [month, value] of Object.entries(calculation.extrasByMonth)) {
      const amount = normalizeMoney(value)
      if (!incomeMonths.includes(month) || amount === null) return null
      if (amount > 0) extrasByMonth[month] = amount
    }
    return { mode: 'monthly_schedule', monthlyAmount, extrasByMonth }
  }

  const amount = normalizeMoney(calculation.amount)
  if (amount === null) return null

  if (calculation.mode === 'one_time') return { mode: 'one_time', amount }
  if (!recurringIncomeFrequencies.includes(calculation.frequency)) return null
  return { mode: 'recurring', amount, frequency: calculation.frequency }
}

export function annualIncomeValue(calculation) {
  const normalized = normalizeIncomeCalculation(calculation)
  if (!normalized) return null

  if (normalized.mode === 'annual_salary') return normalized.annualAmount
  if (normalized.mode === 'monthly_schedule') {
    return normalizeMoney(
      normalized.monthlyAmount * 12 +
        Object.values(normalized.extrasByMonth).reduce((total, value) => total + value, 0),
    )
  }
  if (normalized.mode === 'one_time') return normalized.amount
  return normalizeMoney(normalized.amount * frequencyMultipliers[normalized.frequency])
}

export function incomeCalculationBreakdown(calculation) {
  const normalized = normalizeIncomeCalculation(calculation)
  const annualValue = annualIncomeValue(normalized)
  if (!normalized || annualValue === null) return null

  if (normalized.mode === 'annual_salary') {
    return {
      annualValue,
      perPayment: normalizeMoney(annualValue / normalized.paymentsPerYear),
      monthlyAverage: normalizeMoney(annualValue / 12),
    }
  }

  if (normalized.mode === 'monthly_schedule') {
    return {
      annualValue,
      monthlyAverage: normalizeMoney(annualValue / 12),
    }
  }

  return { annualValue, monthlyAverage: normalizeMoney(annualValue / 12) }
}

function normalizePositiveInteger(value) {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : null
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
