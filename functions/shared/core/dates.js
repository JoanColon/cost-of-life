/**
 * Portable date utilities for canonical ISO dates, calendar-safe month arithmetic, financial time-zone conversion, and anniversary calculations.
 */
/** Validates and returns a calendar date in YYYY-MM-DD form without a time-zone shift. */
export function requireCanonicalDate(value, label = 'date') {
  const date = String(value || '')
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) throw new RangeError(`A valid ${label} is required`)
  const parsed = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  if (
    parsed.getUTCFullYear() !== Number(match[1]) ||
    parsed.getUTCMonth() !== Number(match[2]) - 1 ||
    parsed.getUTCDate() !== Number(match[3])
  ) {
    throw new RangeError(`A valid ${label} is required`)
  }
  return date
}

/** Adds whole calendar months and clamps the day to the last valid day of the target month. */
export function addCalendarMonthsClamped(value, months) {
  const date = requireCanonicalDate(value)
  const offset = Number(months)
  if (!Number.isInteger(offset)) throw new RangeError('A valid month offset is required')
  const [year, month, day] = date.split('-').map(Number)
  const targetMonth = month - 1 + offset
  const lastDay = new Date(Date.UTC(year, targetMonth + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, targetMonth, Math.min(day, lastDay))).toISOString().slice(0, 10)
}

/** Converts an instant into YYYY-MM-DD in the requested financial time zone. */
export function dateInFinancialTimeZone(value = new Date(), timeZone = 'Europe/Madrid') {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new RangeError('A valid date is required')
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone,
    })
      .formatToParts(date)
      .map(({ type, value: part }) => [type, part]),
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}

/** Counts full anniversary years completed between two canonical calendar dates. */
export function completedAnniversaryYears(startDate, endDate) {
  const canonicalStart = requireCanonicalDate(startDate, 'start date')
  const canonicalEnd = requireCanonicalDate(endDate, 'end date')
  const [startYear, startMonth, startDay] = canonicalStart.split('-').map(Number)
  const [endYear, endMonth, endDay] = canonicalEnd.split('-').map(Number)
  const beforeAnniversary = endMonth < startMonth || (endMonth === startMonth && endDay < startDay)
  return endYear - startYear - Number(beforeAnniversary)
}
