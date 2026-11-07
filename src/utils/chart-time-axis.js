export function calendarYearAtMonth(startYear, month) {
  return Number(startYear) + Math.floor(Math.max(0, Number(month) || 0) / 12)
}

export function calendarYearTickIndices(periods, maxLabels = 7) {
  const years = []

  periods.forEach((period, index) => {
    const year = String(period || '').slice(0, 4)
    if (!/^\d{4}$/.test(year)) return

    const existing = years.at(-1)
    if (existing?.year === year) {
      existing.lastIndex = index
      return
    }

    years.push({ year, firstIndex: index, lastIndex: index })
  })

  if (!years.length) return new Map()

  const labelCount = Math.max(2, Math.min(Number(maxLabels) || 7, years.length))
  const selectedYearIndexes = new Set()

  if (years.length <= labelCount) {
    years.forEach((_, index) => selectedYearIndexes.add(index))
  } else {
    for (let index = 0; index < labelCount; index += 1) {
      selectedYearIndexes.add(Math.round((index * (years.length - 1)) / (labelCount - 1)))
    }
  }

  const labels = new Map()
  ;[...selectedYearIndexes]
    .sort((left, right) => left - right)
    .forEach((yearIndex) => {
      const item = years[yearIndex]
      const periodIndex = yearIndex === years.length - 1 ? item.lastIndex : item.firstIndex
      labels.set(periodIndex, item.year)
    })

  return labels
}
