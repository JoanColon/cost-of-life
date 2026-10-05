export const dayMs = 24 * 60 * 60 * 1000

export function eventDate(item) {
  return item.occurredAt || item.createdAt
}

export function getPersistedEventId(item) {
  if (typeof item === 'string') return item
  return item?.sourceEventId || item?.id
}

export function sortEventsNewestFirst(items) {
  return [...items].sort(
    (a, b) => new Date(eventDate(b)).getTime() - new Date(eventDate(a)).getTime(),
  )
}

export function formatDateInput(dateLike) {
  const date = new Date(dateLike)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function mergeDateInputWithEventTime(dateValue, originalDateLike) {
  const originalDate = new Date(originalDateLike)
  const [year, month, day] = dateValue.split('-').map(Number)

  return new Date(
    year,
    month - 1,
    day,
    originalDate.getHours(),
    originalDate.getMinutes(),
    originalDate.getSeconds(),
    originalDate.getMilliseconds(),
  ).toISOString()
}
