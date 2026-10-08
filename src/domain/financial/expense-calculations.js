import { normalizeMoney } from './money'
import { incomeMonths } from './income-calculations'

export const expenseFrequencies = [
  'weekly',
  'monthly',
  'every_two_months',
  'quarterly',
  'yearly',
  'irregular',
]

export const selectableExpenseFrequencies = ['monthly', 'every_two_months', 'quarterly', 'yearly']

export const expenseVariabilities = ['fixed', 'variable']
export const expenseRecurrences = ['recurring', 'occasional']
export const expenseNecessities = ['essential', 'lifestyle']

const annualMultipliers = {
  weekly: 52,
  monthly: 12,
  every_two_months: 6,
  quarterly: 4,
  yearly: 1,
  irregular: 1,
}

export function normalizeExpenseEstimate(estimate) {
  const amount = normalizeMoney(estimate?.amount)
  if (amount === null || !expenseFrequencies.includes(estimate?.frequency)) return null
  return { amount, frequency: estimate.frequency }
}

export function annualExpenseValue(estimate) {
  const normalized = normalizeExpenseEstimate(estimate)
  if (!normalized) return null
  return normalizeMoney(normalized.amount * annualMultipliers[normalized.frequency])
}

export function monthlyExpenseValue(estimate) {
  const annualValue = annualExpenseValue(estimate)
  return annualValue === null ? null : normalizeMoney(annualValue / 12)
}

export function generateMonthlyExpenseAmounts(estimate) {
  const normalized = normalizeExpenseEstimate(estimate)
  if (!normalized) return null

  const interval = { monthly: 1, every_two_months: 2, quarterly: 3, yearly: 12 }[
    normalized.frequency
  ]
  if (!interval) {
    const monthly = monthlyExpenseValue(normalized)
    return Object.fromEntries(incomeMonths.map((month) => [month, monthly]))
  }

  return Object.fromEntries(
    incomeMonths.map((month, index) => [month, index % interval === 0 ? normalized.amount : 0]),
  )
}

export function normalizeMonthlyExpenseAmounts(amounts) {
  if (!amounts || typeof amounts !== 'object' || Array.isArray(amounts)) return null
  const normalized = {}
  for (const month of incomeMonths) {
    const value = normalizeMoney(amounts[month])
    if (value === null) return null
    normalized[month] = value
  }
  return normalized
}

export function annualMonthlyExpenseValue(amounts, fallbackEstimate = null) {
  const normalized = normalizeMonthlyExpenseAmounts(amounts)
  if (!normalized) return annualExpenseValue(fallbackEstimate)
  return normalizeMoney(incomeMonths.reduce((total, month) => total + normalized[month], 0))
}

export function normalizeExpenseAttributes({ variability, recurrence, necessity }) {
  if (!expenseVariabilities.includes(variability)) return null
  if (!expenseRecurrences.includes(recurrence)) return null
  if (necessity != null && !expenseNecessities.includes(necessity)) return null
  return { variability, recurrence, necessity: necessity ?? null }
}
