import { normalizeMoney } from './money'

export const expenseFrequencies = [
  'weekly',
  'monthly',
  'every_two_months',
  'quarterly',
  'yearly',
  'irregular',
]

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

export function normalizeExpenseAttributes({ variability, recurrence, necessity }) {
  if (!expenseVariabilities.includes(variability)) return null
  if (!expenseRecurrences.includes(recurrence)) return null
  if (necessity != null && !expenseNecessities.includes(necessity)) return null
  return { variability, recurrence, necessity: necessity ?? null }
}
