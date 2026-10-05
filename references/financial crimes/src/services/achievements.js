import { achievementDefinitions, achievementEvaluationModes } from '../config/achievements.js'
import { getAllowanceForPeriod } from '../utils/allowanceHistory.js'
import { getPeriodMetrics } from '../utils/crimeStats.js'
import { eventDate } from '../utils/eventDates.js'
import { endOfDay, getEffectiveEventsForRange, startOfDay } from '../utils/recurringEvents.js'
import { getMonthKey, parseMonthKey, periodTypes } from '../utils/timePeriods.js'

function periodForMonth(monthKey) {
  const { year, monthIndex } = parseMonthKey(monthKey)
  return {
    type: periodTypes.MONTH,
    year,
    monthIndex,
  }
}

function addMonthsToKey(monthKey, offset) {
  const { year, monthIndex } = parseMonthKey(monthKey)
  return getMonthKey(new Date(year, monthIndex + offset, 1))
}

function previousMonthKey(monthKey, offset = 1) {
  return addMonthsToKey(monthKey, -offset)
}

function nextMonthKey(monthKey) {
  return addMonthsToKey(monthKey, 1)
}

function currentMonthKey(now = new Date()) {
  return getMonthKey(now)
}

function latestCompletedMonthKey(now = new Date()) {
  return previousMonthKey(currentMonthKey(now))
}

function eventDayKey(item) {
  const date = new Date(eventDate(item))
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function firstHistoryMonth(events) {
  if (!events.length) return null

  const firstTimestamp = Math.min(...events.map((event) => startOfDay(eventDate(event)).getTime()))
  return getMonthKey(new Date(firstTimestamp))
}

function firstCrimeDate(crimes) {
  if (!crimes.length) return null

  const firstTimestamp = Math.min(...crimes.map((crime) => startOfDay(eventDate(crime)).getTime()))
  return new Date(firstTimestamp)
}

function getMonthContext({ monthKey, crimes, preventedCrimes, settings }) {
  const period = periodForMonth(monthKey)
  const allowance = getAllowanceForPeriod(settings, period)
  const metrics = getPeriodMetrics({
    crimes,
    preventedCrimes,
    period,
    allowance,
  })

  return {
    monthKey,
    period,
    allowance,
    hasAllowance: allowance != null,
    metrics,
  }
}

function getCurrentMonthContext({ crimes, preventedCrimes, settings, now }) {
  const monthKey = currentMonthKey(now)
  const monthPeriod = periodForMonth(monthKey)
  const allowance = getAllowanceForPeriod(settings, monthPeriod)
  const metrics = getPeriodMetrics({
    crimes,
    preventedCrimes,
    // Immediate checks must never project the rest of the active month.
    period: { type: periodTypes.MONTH_TO_DATE },
    allowance,
    now,
  })

  return {
    monthKey,
    period: monthPeriod,
    allowance,
    hasAllowance: allowance != null,
    metrics,
  }
}

function getMonthContexts({ monthKey, crimes, preventedCrimes, settings }) {
  return {
    current: getMonthContext({ monthKey, crimes, preventedCrimes, settings }),
    previous: getMonthContext({
      monthKey: previousMonthKey(monthKey),
      crimes,
      preventedCrimes,
      settings,
    }),
    twoBack: getMonthContext({
      monthKey: previousMonthKey(monthKey, 2),
      crimes,
      preventedCrimes,
      settings,
    }),
  }
}

function isMonthInHistory(monthKey, historyStartMonth, evaluatedMonth) {
  return Boolean(historyStartMonth && monthKey >= historyStartMonth && monthKey <= evaluatedMonth)
}

function hasValidAllowance(context) {
  return context.hasAllowance
}

function hasPositiveAllowance(context) {
  return hasValidAllowance(context) && Number(context.allowance) > 0
}

function hasPreviousCrimeData(context) {
  return context.metrics.crimesCommitted > 0 || context.metrics.totalDamages > 0
}

function maxCrimeFreeStreak({ crimes, historyStartDate, rangeEnd }) {
  if (!historyStartDate) return 0

  const crimeDays = new Set(
    getEffectiveEventsForRange(crimes, historyStartDate, rangeEnd).map((crime) =>
      eventDayKey(crime),
    ),
  )
  let streak = 0
  let maxStreak = 0
  const cursor = startOfDay(historyStartDate)
  const end = endOfDay(rangeEnd)

  while (cursor <= end) {
    if (crimeDays.has(eventDayKey({ occurredAt: cursor.toISOString() }))) {
      streak = 0
    } else {
      streak += 1
      maxStreak = Math.max(maxStreak, streak)
    }

    cursor.setDate(cursor.getDate() + 1)
  }

  return maxStreak
}

function repeatCrimeKey(crime) {
  if (crime.categoryId === 'subscriptions' && crime.metadata?.subscriptionProviderId) {
    return `subscription:${crime.metadata.subscriptionProviderId}`
  }

  return `category:${crime.categoryId || 'other'}`
}

function hasCountAtLeast(items, getKey, threshold) {
  const counts = new Map()

  for (const item of items) {
    const key = getKey(item)
    const nextCount = (counts.get(key) || 0) + 1
    if (nextCount >= threshold) return true
    counts.set(key, nextCount)
  }

  return false
}

function threeMonthContexts(contexts, historyStartMonth) {
  const keys = [
    previousMonthKey(contexts.current.monthKey, 2),
    previousMonthKey(contexts.current.monthKey),
    contexts.current.monthKey,
  ]

  if (
    !keys.every((monthKey) =>
      isMonthInHistory(monthKey, historyStartMonth, contexts.current.monthKey),
    )
  ) {
    return null
  }

  return [contexts.twoBack, contexts.previous, contexts.current]
}

const achievementRules = {
  'under-control': ({ contexts, historyStartMonth }) =>
    isMonthInHistory(contexts.previous.monthKey, historyStartMonth, contexts.current.monthKey) &&
    hasPreviousCrimeData(contexts.previous) &&
    contexts.current.metrics.totalDamages < contexts.previous.metrics.totalDamages,

  'clean-record': ({ contexts, historyStartMonth }) => {
    const months = threeMonthContexts(contexts, historyStartMonth)
    return Boolean(
      months &&
      months.every(
        (context) =>
          hasValidAllowance(context) && context.metrics.totalDamages <= Number(context.allowance),
      ),
    )
  },

  'crime-preventer': ({ contexts }) => contexts.current.metrics.preventedCrimes.length >= 5,

  'reformed-criminal': ({ contexts, historyStartMonth }) => {
    const months = threeMonthContexts(contexts, historyStartMonth)
    return Boolean(
      months &&
      months[2].metrics.totalDamages < months[1].metrics.totalDamages &&
      months[1].metrics.totalDamages < months[0].metrics.totalDamages,
    )
  },

  'zero-crime-day': ({ contexts, crimes }) =>
    maxCrimeFreeStreak({
      crimes,
      historyStartDate: firstCrimeDate(crimes),
      rangeEnd: contexts.current.metrics.period.range.end,
    }) >= 7,

  'probation-completed': ({ contexts, historyStartMonth }) =>
    isMonthInHistory(contexts.previous.monthKey, historyStartMonth, contexts.current.monthKey) &&
    hasValidAllowance(contexts.previous) &&
    hasValidAllowance(contexts.current) &&
    contexts.previous.metrics.totalDamages > Number(contexts.previous.allowance) &&
    contexts.current.metrics.totalDamages <= Number(contexts.current.allowance),

  'repeat-offender': ({ contexts }) =>
    hasCountAtLeast(contexts.current.metrics.crimes, repeatCrimeKey, 5),

  'crime-spree': ({ contexts }) => hasCountAtLeast(contexts.current.metrics.crimes, eventDayKey, 5),

  'budget-killer': ({ contexts }) =>
    hasPositiveAllowance(contexts.current) &&
    contexts.current.metrics.totalDamages >= Number(contexts.current.allowance) * 1.25,

  'no-remorse': ({ contexts, historyStartMonth }) => {
    const months = threeMonthContexts(contexts, historyStartMonth)
    return Boolean(
      months &&
      months[2].metrics.totalDamages > months[1].metrics.totalDamages &&
      months[1].metrics.totalDamages > months[0].metrics.totalDamages,
    )
  },

  'serial-offender': ({ contexts }) =>
    hasCountAtLeast(contexts.current.metrics.crimes, (crime) => crime.categoryId || 'other', 10),

  'beyond-rehabilitation': ({ contexts, historyStartMonth }) => {
    const months = threeMonthContexts(contexts, historyStartMonth)
    return Boolean(
      months &&
      months.every(
        (context) =>
          hasValidAllowance(context) && context.metrics.totalDamages > Number(context.allowance),
      ),
    )
  },
}

function canEvaluateImmediately(achievement) {
  return [achievementEvaluationModes.IMMEDIATE, achievementEvaluationModes.BOTH].includes(
    achievement.evaluationMode,
  )
}

function canEvaluateMonthly(achievement) {
  return [achievementEvaluationModes.MONTHLY, achievementEvaluationModes.BOTH].includes(
    achievement.evaluationMode,
  )
}

export function getPendingCompletedAchievementMonths({
  crimes,
  preventedCrimes,
  evaluatedMonths = [],
  now = new Date(),
}) {
  const events = [...crimes, ...preventedCrimes]
  const firstMonth = firstHistoryMonth(events)
  const lastMonth = latestCompletedMonthKey(now)
  const evaluated = new Set(evaluatedMonths)
  const pendingMonths = []

  if (!firstMonth || firstMonth > lastMonth) return pendingMonths

  let cursor = firstMonth
  while (cursor <= lastMonth) {
    if (!evaluated.has(cursor)) {
      pendingMonths.push(cursor)
    }

    cursor = nextMonthKey(cursor)
  }

  return pendingMonths
}

export function evaluateAchievementsForMonth({
  monthKey,
  crimes,
  preventedCrimes,
  settings,
  now = new Date(),
}) {
  if (monthKey >= currentMonthKey(now)) return []

  const historyStartMonth = firstHistoryMonth([...crimes, ...preventedCrimes])
  const contexts = getMonthContexts({ monthKey, crimes, preventedCrimes, settings })
  const evaluationContext = {
    contexts,
    crimes,
    preventedCrimes,
    settings,
    historyStartMonth,
  }

  return achievementDefinitions
    .filter(canEvaluateMonthly)
    .filter((achievement) => achievementRules[achievement.id]?.(evaluationContext))
    .map((achievement) => achievement.id)
}

export function evaluateImmediateAchievements({
  crimes,
  preventedCrimes,
  settings,
  now = new Date(),
}) {
  const monthKey = currentMonthKey(now)
  const contexts = {
    current: getCurrentMonthContext({ crimes, preventedCrimes, settings, now }),
    previous: getMonthContext({
      monthKey: previousMonthKey(monthKey),
      crimes,
      preventedCrimes,
      settings,
    }),
    twoBack: getMonthContext({
      monthKey: previousMonthKey(monthKey, 2),
      crimes,
      preventedCrimes,
      settings,
    }),
  }
  const evaluationContext = {
    contexts,
    crimes,
    preventedCrimes,
    settings,
    historyStartMonth: firstHistoryMonth([...crimes, ...preventedCrimes]),
  }

  return achievementDefinitions
    .filter(canEvaluateImmediately)
    .filter((achievement) => achievementRules[achievement.id]?.(evaluationContext))
    .map((achievement) => achievement.id)
}

export async function processImmediateAchievements({
  crimes,
  preventedCrimes,
  settings,
  now = new Date(),
}) {
  const matchedAchievementIds = evaluateImmediateAchievements({
    crimes,
    preventedCrimes,
    settings,
    now,
  })

  // Immediate unlocks do not mark a month as evaluated. That table is reserved
  // for completed-month processing so the monthly engine remains idempotent.
  if (!matchedAchievementIds.length) {
    return []
  }

  const { saveAchievementUnlocks } = await import('./database.js')
  return saveAchievementUnlocks(matchedAchievementIds, currentMonthKey(now))
}

export async function processPendingCompletedAchievementMonths({
  crimes,
  preventedCrimes,
  settings,
  evaluatedMonths = [],
  now = new Date(),
}) {
  const pendingMonths = getPendingCompletedAchievementMonths({
    crimes,
    preventedCrimes,
    evaluatedMonths,
    now,
  })
  const newUnlocks = []
  const { saveAchievementEvaluation } = await import('./database.js')

  for (const monthKey of pendingMonths) {
    const matchedAchievementIds = evaluateAchievementsForMonth({
      monthKey,
      crimes,
      preventedCrimes,
      settings,
      now,
    })
    const savedUnlocks = await saveAchievementEvaluation(monthKey, matchedAchievementIds)
    newUnlocks.push(...savedUnlocks)
  }

  return {
    processedMonths: pendingMonths,
    newUnlocks,
  }
}
