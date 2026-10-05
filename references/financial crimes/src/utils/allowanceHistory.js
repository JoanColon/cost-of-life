import { normalizeCurrency } from '../config/currencies.js'
import { getMonthKey } from './timePeriods.js'

const monthKeyPattern = /^\d{4}-\d{2}$/

export function normalizeAllowanceAmount(value) {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

export function normalizeAllowanceHistory(history = [], fallbackAmount = null, currency = 'EUR') {
  const entriesByMonth = new Map()

  if (Array.isArray(history)) {
    for (const entry of history) {
      if (!entry?.month || !monthKeyPattern.test(entry.month)) continue

      entriesByMonth.set(entry.month, {
        month: entry.month,
        amount: normalizeAllowanceAmount(entry.amount),
        currency: normalizeCurrency(entry.currency || currency),
      })
    }
  }

  const normalizedFallback = normalizeAllowanceAmount(fallbackAmount)
  if (!entriesByMonth.size && normalizedFallback != null) {
    const month = getMonthKey(new Date())
    entriesByMonth.set(month, {
      month,
      amount: normalizedFallback,
      currency: normalizeCurrency(currency),
    })
  }

  return [...entriesByMonth.values()].sort((a, b) => b.month.localeCompare(a.month))
}

export function upsertAllowanceForMonth(history, month, amount, currency = 'EUR') {
  return normalizeAllowanceHistory(
    [
      ...(Array.isArray(history) ? history : []),
      {
        month,
        amount: normalizeAllowanceAmount(amount),
        currency: normalizeCurrency(currency),
      },
    ],
    null,
    currency,
  )
}

export function getAllowanceForMonth(history, month, fallbackAmount = null) {
  if (!monthKeyPattern.test(month)) {
    return normalizeAllowanceAmount(fallbackAmount)
  }

  const entries = normalizeAllowanceHistory(history)
  const effectiveEntry = entries
    .filter((entry) => entry.month <= month)
    .sort((a, b) => b.month.localeCompare(a.month))[0]

  if (effectiveEntry) {
    return effectiveEntry.amount
  }

  return normalizeAllowanceAmount(fallbackAmount)
}

export function getAllowanceForPeriod(settings, period) {
  if (period?.type === 'year') {
    let total = 0
    let hasAllowance = false

    for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
      const month = `${period.year}-${String(monthIndex + 1).padStart(2, '0')}`
      const allowance = getAllowanceForMonth(
        settings?.monthlyCrimeAllowanceHistory,
        month,
        settings?.monthlyCrimeAllowance,
      )

      if (allowance != null) {
        total += allowance
        hasAllowance = true
      }
    }

    return hasAllowance ? total : null
  }

  const month =
    period?.type === 'month'
      ? `${period.year}-${String(period.monthIndex + 1).padStart(2, '0')}`
      : getMonthKey(new Date())

  return getAllowanceForMonth(
    settings?.monthlyCrimeAllowanceHistory,
    month,
    settings?.monthlyCrimeAllowance,
  )
}
