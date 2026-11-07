import { describe, expect, it } from 'vitest'
import { calendarYearAtMonth, calendarYearTickIndices } from '@/utils/chart-time-axis'

describe('chart time axis', () => {
  it('converts projection months into calendar years', () => {
    expect(calendarYearAtMonth(2026, 0)).toBe(2026)
    expect(calendarYearAtMonth(2026, 12)).toBe(2027)
    expect(calendarYearAtMonth(2026, 360)).toBe(2056)
  })

  it('distributes labels across a dated timeline even when it does not start in January', () => {
    const periods = Array.from({ length: 31 }, (_, offset) => `${2022 + offset}-04-01`)
    const labels = calendarYearTickIndices(periods, 7)

    expect([...labels.values()]).toEqual(['2022', '2027', '2032', '2037', '2042', '2047', '2052'])
    expect(labels.get(0)).toBe('2022')
    expect(labels.get(30)).toBe('2052')
  })

  it('uses the final period for the final year label', () => {
    const labels = calendarYearTickIndices(
      ['2024-04-01', '2025-04-01', '2025-08-01', '2025-12-01'],
      7,
    )

    expect(labels.get(0)).toBe('2024')
    expect(labels.get(3)).toBe('2025')
    expect(labels.has(1)).toBe(false)
  })
})
