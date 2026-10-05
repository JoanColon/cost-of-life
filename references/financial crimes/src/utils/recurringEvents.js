import { dayMs, sortEventsNewestFirst } from './eventDates.js'

export const recurrenceOptions = [null, 'monthly', 'quarterly', 'yearly']

const recurrenceMonths = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
}

// Date-only boundaries keep spending dates stable in the user's local timezone.
export function startOfDay(dateLike) {
  const date = new Date(dateLike)
  date.setHours(0, 0, 0, 0)
  return date
}

export function endOfDay(dateLike) {
  const date = new Date(dateLike)
  date.setHours(23, 59, 59, 999)
  return date
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

// Anchored month math avoids JS overflow and prevents recurrence drift.
export function addMonthsAnchored(anchorDateLike, monthsToAdd) {
  const anchorDate = new Date(anchorDateLike)
  const targetMonthIndex = anchorDate.getMonth() + monthsToAdd
  const targetYear = anchorDate.getFullYear() + Math.floor(targetMonthIndex / 12)
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12
  const day = Math.min(anchorDate.getDate(), daysInMonth(targetYear, normalizedMonth))

  return new Date(
    targetYear,
    normalizedMonth,
    day,
    anchorDate.getHours(),
    anchorDate.getMinutes(),
    anchorDate.getSeconds(),
    anchorDate.getMilliseconds(),
  )
}

function monthDifference(fromDateLike, toDateLike) {
  const fromDate = new Date(fromDateLike)
  const toDate = new Date(toDateLike)
  return (
    (toDate.getFullYear() - fromDate.getFullYear()) * 12 + toDate.getMonth() - fromDate.getMonth()
  )
}

function dateKey(dateLike) {
  const date = new Date(dateLike)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getRangeStartIndex(anchorDate, recurrence, rangeStart) {
  const stepMonths = recurrenceMonths[recurrence]
  const roughIndex = Math.max(
    0,
    Math.floor(monthDifference(anchorDate, rangeStart) / stepMonths) - 1,
  )
  let index = roughIndex

  while (addMonthsAnchored(anchorDate, index * stepMonths) < startOfDay(rangeStart)) {
    index += 1
  }

  return index
}

function makeVirtualOccurrence(sourceEvent, occurrenceDate) {
  const occurrenceKey = dateKey(occurrenceDate)

  return {
    ...sourceEvent,
    id: `${sourceEvent.id}::${occurrenceKey}`,
    occurredAt: occurrenceDate.toISOString(),
    isVirtualOccurrence: true,
    sourceEventId: sourceEvent.id,
  }
}

function isRecurringEvent(event) {
  return Boolean(event.recurrence && recurrenceMonths[event.recurrence])
}

// Expands only the requested range and leaves persisted source events untouched.
export function expandRecurringEvents(events, rangeStartLike, rangeEndLike) {
  const rangeStart = startOfDay(rangeStartLike)
  const rangeEnd = endOfDay(rangeEndLike)
  const effectiveEvents = []

  events.forEach((event) => {
    const eventDate = new Date(event.occurredAt || event.createdAt)
    const eventEnd = event.recurrenceEndAt ? endOfDay(event.recurrenceEndAt) : null

    if (!isRecurringEvent(event)) {
      if (eventDate >= rangeStart && eventDate <= rangeEnd) {
        effectiveEvents.push(event)
      }
      return
    }

    const stepMonths = recurrenceMonths[event.recurrence]
    let index = getRangeStartIndex(eventDate, event.recurrence, rangeStart)

    while (true) {
      const occurrenceDate = addMonthsAnchored(eventDate, index * stepMonths)
      if (occurrenceDate > rangeEnd) break
      if (eventEnd && occurrenceDate > eventEnd) break

      if (occurrenceDate >= rangeStart && occurrenceDate <= rangeEnd) {
        effectiveEvents.push(index === 0 ? event : makeVirtualOccurrence(event, occurrenceDate))
      }

      index += 1
    }
  })

  return sortEventsNewestFirst(effectiveEvents)
}

// Shared facade for reporting screens so recurrence rules stay centralized.
export function getEffectiveEventsForRange(events, rangeStart, rangeEnd) {
  return expandRecurringEvents(events, rangeStart, rangeEnd)
}

export function getCurrentMonthRange(now = new Date()) {
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  }
}

export function addDays(dateLike, days) {
  return new Date(startOfDay(dateLike).getTime() + days * dayMs)
}
