import { dayMs, eventDate } from './eventDates.js'
import { startOfDay } from './recurringEvents.js'

export function isThisMonth(dateString) {
  const date = new Date(dateString)
  const now = new Date()
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
}

export function formatTime(dateString) {
  return new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString))
}

export function formatDay(dateString) {
  return new Intl.DateTimeFormat('en', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(new Date(dateString))
}

export function relativeCrimeDate(dateString) {
  const date = new Date(dateString)
  const today = startOfDay(new Date())
  const crimeDay = startOfDay(date)
  const diff = Math.round((today - crimeDay) / dayMs)

  if (diff === 0) return `Today · ${formatTime(dateString)}`
  if (diff === 1) return `Yesterday · ${formatTime(dateString)}`
  return `${formatDay(dateString)} · ${formatTime(dateString)}`
}

export function cleanStreakDays(crimes) {
  if (!crimes.length) return 0

  const lastCrimeDay = startOfDay(new Date(eventDate(crimes[0])))
  const today = startOfDay(new Date())
  return Math.max(0, Math.floor((today - lastCrimeDay) / dayMs))
}

export function crimesInLastDays(crimes, days) {
  const cutoff = Date.now() - days * dayMs
  return crimes.filter((crime) => new Date(eventDate(crime)).getTime() >= cutoff)
}
