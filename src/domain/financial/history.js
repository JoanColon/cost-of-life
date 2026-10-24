import { financialYearMonthCategoryValue, financialYearMonthValue } from './financial-year'

export function buildNetWorthSeries(historyDocuments = [], { throughPeriod = null } = {}) {
  return positionPeriods(historyDocuments, throughPeriod).map(({ history, month, period }) => ({
    period,
    value: financialYearMonthValue(history, month, 'netWorth'),
  }))
}

export function buildNetWorthBreakdownSeries(historyDocuments = [], { throughPeriod = null } = {}) {
  return positionPeriods(historyDocuments, throughPeriod).map(
    ({ history, month, period, projection }) => ({
      period,
      assets: categoryValues(history, month, projection, 'assets'),
      liabilities: categoryValues(history, month, projection, 'liabilities', -1),
    }),
  )
}

function positionPeriods(historyDocuments, throughPeriod) {
  return historyDocuments
    .flatMap((history) => {
      const year = Number(history.year || history.id)
      if (!Number.isInteger(year)) return []

      return Object.entries(history.months || {}).map(([month, projection]) => ({
        history,
        month,
        period: `${year}-${month}`,
        projection,
      }))
    })
    .filter(
      ({ period, projection }) =>
        /^\d{4}-(0[1-9]|1[0-2])$/.test(period) &&
        projection?.assets &&
        projection?.liabilities &&
        (!throughPeriod || period <= throughPeriod),
    )
    .sort((first, second) => first.period.localeCompare(second.period))
}

function categoryValues(history, month, projection, section, multiplier = 1) {
  return Object.fromEntries(
    Object.keys(projection?.[section]?.categories || {}).map((categoryId) => [
      categoryId,
      financialYearMonthCategoryValue(history, month, section, categoryId) * multiplier,
    ]),
  )
}
