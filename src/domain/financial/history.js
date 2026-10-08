export function buildNetWorthSeries(historyDocuments = []) {
  return historyDocuments
    .flatMap((history) => {
      const year = Number(history.year || history.id)
      if (!Number.isInteger(year)) return []

      return Object.entries(history.months || {}).map(([month, snapshot]) => ({
        period: `${year}-${month}`,
        value: snapshot?.netWorth == null ? Number.NaN : Number(snapshot.netWorth),
      }))
    })
    .filter(({ period, value }) => /^\d{4}-(0[1-9]|1[0-2])$/.test(period) && Number.isFinite(value))
    .sort((first, second) => first.period.localeCompare(second.period))
}
