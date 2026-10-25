import { financialYearMonthCategoryValue, financialYearMonthValue } from './financial-year'

export function buildNetWorthSeries(
  historyDocuments = [],
  { throughPeriod = null, memberId = 'all' } = {},
) {
  return positionPeriods(historyDocuments, throughPeriod).map(({ history, month, period }) => ({
    period,
    value: financialYearMonthValue(history, month, 'netWorth', memberId),
  }))
}

export function buildNetWorthBreakdownSeries(
  historyDocuments = [],
  { throughPeriod = null, memberId = 'all' } = {},
) {
  return positionPeriods(historyDocuments, throughPeriod).map(
    ({ history, month, period, projection }) => ({
      period,
      assets: categoryValues(history, month, projection, 'assets', memberId),
      liabilities: categoryValues(history, month, projection, 'liabilities', memberId, -1),
    }),
  )
}

export function buildAssetAnnualSeries(
  historyDocuments = [],
  { assetId, categoryId = 'investment' } = {},
) {
  if (!assetId) return []

  return historyDocuments
    .map((history) => {
      const year = Number(history.year || history.id)
      if (!Number.isInteger(year)) return null

      const subcategories =
        history.months?.['12']?.assets?.categories?.[categoryId]?.subcategories || {}
      const item = Object.values(subcategories)
        .map((subcategory) => subcategory?.items?.[assetId])
        .find(Boolean)
      const value = Number(item?.total)
      return Number.isFinite(value) ? { year, value } : null
    })
    .filter(Boolean)
    .sort((first, second) => first.year - second.year)
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

function categoryValues(history, month, projection, section, memberId, multiplier = 1) {
  return Object.fromEntries(
    Object.keys(projection?.[section]?.categories || {}).map((categoryId) => [
      categoryId,
      financialYearMonthCategoryValue(history, month, section, categoryId, memberId) * multiplier,
    ]),
  )
}
