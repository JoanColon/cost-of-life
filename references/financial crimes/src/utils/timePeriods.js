import { eventDate } from './eventDates.js'
import { endOfDay, getEffectiveEventsForRange, startOfDay } from './recurringEvents.js'

export const periodTypes = {
  MONTH_TO_DATE: 'monthToDate',
  YEAR_TO_DATE: 'yearToDate',
  MONTH: 'month',
  YEAR: 'year',
  RANGE: 'range',
}

export function formatDateLabel(dateLike) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(dateLike))
}

export function formatMonthLabel(dateLike) {
  return new Intl.DateTimeFormat('en', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(dateLike))
}

export function getMonthKey(dateLike) {
  const date = new Date(dateLike)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function parseMonthKey(monthKey) {
  const [year, month] = monthKey.split('-').map(Number)
  return {
    year,
    monthIndex: month - 1,
  }
}

export function getMonthOptions(events, now = new Date()) {
  const firstEventDate = getTimelineStart(events, now)
  const cursor = new Date(firstEventDate.getFullYear(), firstEventDate.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth(), 1)
  const options = []

  while (cursor <= end) {
    const date = new Date(cursor)
    options.push({
      label: formatMonthLabel(date).toUpperCase(),
      value: getMonthKey(date),
    })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return options.reverse()
}

export function getPeriodKey(range) {
  return `${range.start.toISOString().slice(0, 10)}_${range.end.toISOString().slice(0, 10)}`
}

export function getTimelineStart(events, now = new Date()) {
  if (!events.length) return startOfDay(now)

  const firstTimestamp = Math.min(
    ...events.map((item) => startOfDay(new Date(eventDate(item))).getTime()),
  )

  return new Date(firstTimestamp)
}

export function resolvePeriodRange(period = { type: periodTypes.MONTH_TO_DATE }, now = new Date()) {
  const current = new Date(now)

  if (period.type === periodTypes.YEAR_TO_DATE) {
    return {
      start: startOfDay(new Date(current.getFullYear(), 0, 1)),
      end: endOfDay(current),
    }
  }

  if (period.type === periodTypes.MONTH) {
    return {
      start: startOfDay(new Date(period.year, period.monthIndex, 1)),
      end: endOfDay(new Date(period.year, period.monthIndex + 1, 0)),
    }
  }

  if (period.type === periodTypes.YEAR) {
    return {
      start: startOfDay(new Date(period.year, 0, 1)),
      end: endOfDay(new Date(period.year, 11, 31)),
    }
  }

  if (period.type === periodTypes.RANGE) {
    return {
      start: startOfDay(period.start),
      end: endOfDay(period.end),
    }
  }

  return {
    start: startOfDay(new Date(current.getFullYear(), current.getMonth(), 1)),
    end: endOfDay(current),
  }
}

export function getPeriodLabel(period, range = resolvePeriodRange(period)) {
  if (period.type === periodTypes.MONTH_TO_DATE) return `${formatMonthLabel(range.start)} to date`
  if (period.type === periodTypes.YEAR_TO_DATE) return `${range.start.getFullYear()} to date`
  if (period.type === periodTypes.MONTH) return formatMonthLabel(range.start)
  if (period.type === periodTypes.YEAR) return String(range.start.getFullYear())
  return `${formatDateLabel(range.start)} - ${formatDateLabel(range.end)}`
}

export function getEventsForPeriod(events, period, now = new Date()) {
  const range = resolvePeriodRange(period, now)

  return {
    range,
    label: getPeriodLabel(period, range),
    events: getEffectiveEventsForRange(events, range.start, range.end),
    key: getPeriodKey(range),
  }
}
