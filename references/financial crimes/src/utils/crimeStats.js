import { crimeCategories } from '../config/crimeCategories.js'
import { normalizeCurrency } from '../config/currencies.js'
import { getAllowanceForPeriod } from './allowanceHistory.js'
import { cleanStreakDays, crimesInLastDays, isThisMonth } from './dateGroups.js'
import { getCurrentMonthRange, getEffectiveEventsForRange } from './recurringEvents.js'
import {
  formatMonthLabel,
  getEventsForPeriod,
  getMonthKey,
  getTimelineStart,
  parseMonthKey,
  periodTypes,
} from './timePeriods.js'

export function formatMoney(amount, currency = 'EUR') {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency: normalizeCurrency(currency),
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount || 0)
}

// Monthly totals include virtual subscription occurrences for the current month.
export function monthlyCrimes(crimes) {
  const range = getCurrentMonthRange()
  return getEffectiveEventsForRange(crimes, range.start, range.end).filter((crime) =>
    isThisMonth(crime.occurredAt || crime.createdAt),
  )
}

export function sumAmounts(items) {
  return items.reduce((total, item) => total + (Number(item.amount) || 0), 0)
}

export function getPeriodMetrics({
  crimes,
  preventedCrimes = [],
  period = { type: periodTypes.MONTH_TO_DATE },
  allowance = null,
  now = new Date(),
}) {
  const crimePeriod = getEventsForPeriod(crimes, period, now)
  const preventedPeriod = getEventsForPeriod(preventedCrimes, period, now)
  const completeCrimes = crimePeriod.events.filter((crime) => crime.amount != null)
  const totalDamages = sumAmounts(completeCrimes)
  const damagesPrevented = sumAmounts(preventedPeriod.events)
  const crimesCommitted = crimePeriod.events.length
  const biggestCrime = completeCrimes.reduce(
    (biggest, crime) => Math.max(biggest, Number(crime.amount) || 0),
    0,
  )

  const categoryTotals = crimeCategories
    .map((category) => {
      const categoryCrimes = crimePeriod.events.filter((crime) => crime.categoryId === category.id)
      const amount = sumAmounts(categoryCrimes.filter((crime) => crime.amount != null))

      return {
        ...category,
        amount,
        count: categoryCrimes.length,
        crimes: categoryCrimes,
        pendingCount: categoryCrimes.filter((crime) => crime.status === 'pendingAmount').length,
      }
    })
    .filter((category) => category.amount > 0 || category.count > 0)
    .sort((a, b) => b.amount - a.amount || b.count - a.count)

  const preventedCategoryTotals = crimeCategories
    .map((category) => {
      const categoryCrimes = preventedPeriod.events.filter(
        (crime) => crime.categoryId === category.id,
      )
      const amount = sumAmounts(categoryCrimes)

      return {
        ...category,
        amount,
        count: categoryCrimes.length,
        crimes: categoryCrimes,
      }
    })
    .filter((category) => category.amount > 0 || category.count > 0)
    .sort((a, b) => b.amount - a.amount || b.count - a.count)

  const allowanceAmount = Number(allowance) || 0
  const allowanceRemaining = allowanceAmount ? allowanceAmount - totalDamages : null
  const allowanceConsumed = allowanceAmount ? totalDamages / allowanceAmount : null

  return {
    period: {
      key: crimePeriod.key,
      label: crimePeriod.label,
      range: crimePeriod.range,
    },
    crimes: crimePeriod.events,
    preventedCrimes: preventedPeriod.events,
    completeCrimes,
    totalDamages,
    crimesCommitted,
    averageCrime: completeCrimes.length ? totalDamages / completeCrimes.length : 0,
    biggestCrime,
    mostWantedCategory: categoryTotals[0] || null,
    unreportedDamages: crimePeriod.events.filter((crime) => crime.status === 'pendingAmount')
      .length,
    cleanStreak: cleanStreakDays(crimePeriod.events),
    damagesPrevented,
    net: damagesPrevented - totalDamages,
    allowance: allowanceAmount || null,
    allowanceRemaining,
    allowanceConsumed,
    allowanceExceededBy: allowanceRemaining != null ? Math.max(0, -allowanceRemaining) : null,
    categoryTotals,
    preventedCategoryTotals,
  }
}

function getTimelineEntry({ crimes, settings, period, key, label, axisLabel }) {
  const allowance = getAllowanceForPeriod(settings, period)
  const metrics = getPeriodMetrics({ crimes, period, allowance })

  return {
    key,
    label,
    axisLabel,
    amount: metrics.totalDamages,
    allowance,
    count: metrics.crimesCommitted,
    exceeded: allowance != null && metrics.totalDamages > allowance,
  }
}

export function getMonthlyCrimeTimeline({ crimes, settings, endMonthKey, count = 12 }) {
  const { year, monthIndex } = parseMonthKey(endMonthKey)

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(year, monthIndex - (count - index - 1), 1)
    const period = {
      type: periodTypes.MONTH,
      year: date.getFullYear(),
      monthIndex: date.getMonth(),
    }

    return getTimelineEntry({
      crimes,
      settings,
      period,
      key: getMonthKey(date),
      label: formatMonthLabel(date),
      axisLabel: new Intl.DateTimeFormat('en', {
        month: 'short',
        year: '2-digit',
      }).format(date),
    })
  })
}

export function getYearlyCrimeTimeline({ crimes, settings, now = new Date() }) {
  if (!crimes.length) return []

  const firstYear = getTimelineStart(crimes, now).getFullYear()
  const currentYear = now.getFullYear()

  return Array.from({ length: currentYear - firstYear + 1 }, (_, index) => {
    const year = firstYear + index
    const period = { type: periodTypes.YEAR, year }

    return getTimelineEntry({
      crimes,
      settings,
      period,
      key: String(year),
      label: String(year),
      axisLabel: String(year),
    })
  }).filter((entry) => entry.count > 0)
}

export function getCitizenStatus(crimes) {
  const effectiveCrimes = getEffectiveEventsForRange(
    crimes,
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    new Date(),
  )
  const recentCount = crimesInLastDays(effectiveCrimes, 7).length

  if (recentCount === 0) return { label: 'LAW-ABIDING CITIZEN', color: 'positive', icon: '🟢' }
  if (recentCount <= 2) return { label: 'SUSPECT', color: 'warning', icon: '🟡' }
  if (recentCount <= 4) return { label: 'REPEAT OFFENDER', color: 'orange', icon: '🟠' }
  if (recentCount <= 7) return { label: 'ON PROBATION', color: 'negative', icon: '🔴' }
  return { label: 'SERIAL OFFENDER', color: 'negative', icon: '☠️' }
}
