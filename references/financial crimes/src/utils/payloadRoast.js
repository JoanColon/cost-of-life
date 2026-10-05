import { getAllowanceForMonth } from './allowanceHistory.js'
import { crimeCategories } from '../config/crimeCategories.js'
import { eventDate } from './eventDates.js'
import { getEffectiveEventsForRange, startOfDay } from './recurringEvents.js'
import { getMonthKey, getTimelineStart } from './timePeriods.js'

function numericAmount(value) {
  if (value === null || value === undefined || value === '') return null

  const amount = Number(value)
  return Number.isFinite(amount) ? amount : null
}

function sumKnownAmounts(events) {
  return events.reduce((total, item) => total + (numericAmount(item.amount) ?? 0), 0)
}

function startOfCalendarWeek(dateLike) {
  const date = startOfDay(dateLike)
  const daysSinceMonday = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - daysSinceMonday)
  return date
}

function calendarDayDifference(laterDateLike, earlierDateLike) {
  const later = startOfDay(laterDateLike)
  const earlier = startOfDay(earlierDateLike)
  return Math.max(0, Math.round((later - earlier) / (24 * 60 * 60 * 1000)))
}

function roundPercentage(value) {
  return Math.round(value * 100) / 100
}

function getHistoryThroughEvent(crimes, occurredAt) {
  if (!Array.isArray(crimes) || !crimes.length) return []

  const eventTimestamp = occurredAt.getTime()
  const historyStart = getTimelineStart(crimes, occurredAt)

  return getEffectiveEventsForRange(crimes, historyStart, occurredAt).filter(
    (item) => new Date(eventDate(item)).getTime() <= eventTimestamp,
  )
}

export function buildRoastPayload({ crime, crimes, settings, currency }) {
  const occurredAt = new Date(eventDate(crime))
  const categoryLabel =
    crimeCategories.find((category) => category.id === crime.categoryId)?.label ||
    crime.categoryId ||
    'Unknown'
  const history = getHistoryThroughEvent(crimes, occurredAt)
  const monthStart = new Date(occurredAt.getFullYear(), occurredAt.getMonth(), 1)
  const weekStart = startOfCalendarWeek(occurredAt)
  const categoryHistory = history.filter((item) => item.categoryId === crime.categoryId)
  const categoryWeek = categoryHistory.filter(
    (item) => new Date(eventDate(item)).getTime() >= weekStart.getTime(),
  )
  const categoryMonth = categoryHistory.filter(
    (item) => new Date(eventDate(item)).getTime() >= monthStart.getTime(),
  )
  const monthHistory = history.filter(
    (item) => new Date(eventDate(item)).getTime() >= monthStart.getTime(),
  )
  const previousCrime = history.find(
    (item) => new Date(eventDate(item)).getTime() < occurredAt.getTime(),
  )
  const previousCategoryCrime = categoryHistory.find(
    (item) => new Date(eventDate(item)).getTime() < occurredAt.getTime(),
  )
  const allowanceLimit = getAllowanceForMonth(
    settings?.monthlyCrimeAllowanceHistory,
    getMonthKey(occurredAt),
    settings?.monthlyCrimeAllowance,
  )
  const allowanceSpent = sumKnownAmounts(monthHistory)

  return {
    event: {
      category: categoryLabel || crime.categoryId || 'Unknown',
      amount: numericAmount(crime.amount),
      currency,
      user_notes: crime.notes || '',
      occurred_at: occurredAt.toISOString(),
      day_of_week: new Intl.DateTimeFormat('en', { weekday: 'long' }).format(occurredAt),
      time_of_day: new Intl.DateTimeFormat('en', {
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(occurredAt),
      event_type: crime.eventType || 'crime',
      recurrence: crime.recurrence || null,
    },
    record: {
      category_week_count: categoryWeek.length,
      category_month_count: categoryMonth.length,
      category_month_total: sumKnownAmounts(categoryMonth),
      allowance_spent: allowanceSpent,
      allowance_limit: allowanceLimit,
      allowance_consumed_pct:
        allowanceLimit > 0 ? roundPercentage((allowanceSpent / allowanceLimit) * 100) : null,
      clean_streak_before_event_days: previousCrime
        ? calendarDayDifference(occurredAt, eventDate(previousCrime))
        : null,
      days_since_previous_category_event: previousCategoryCrime
        ? calendarDayDifference(occurredAt, eventDate(previousCategoryCrime))
        : null,
    },
  }
}
