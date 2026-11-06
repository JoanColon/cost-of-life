import { financialYearMonthCategoryValue, financialYearMonthValue } from './financial-year'

export function withCurrentPosition(historyDocuments, financialYear, month) {
  if (!financialYear || !/^\d{2}$/.test(String(month || '')))
    return historyDocuments.filter(Boolean)
  const year = Number(financialYear.year || financialYear.id)
  const existing = historyDocuments.find(
    (document) => Number(document?.year || document?.id) === year,
  )
  const current = financialYear.months?.[month]
  return [
    ...historyDocuments.filter((document) => Number(document?.year || document?.id) !== year),
    {
      id: String(year),
      year,
      months: {
        ...(existing?.months || {}),
        ...(current
          ? {
              [month]: {
                assets: current.assets,
                liabilities: current.liabilities,
                positionStatus: 'current',
              },
            }
          : {}),
      },
    },
  ]
}

export function buildNetWorthSeries(
  historyDocuments = [],
  { throughPeriod = null, memberId = 'all' } = {},
) {
  return positionPeriods(historyDocuments, throughPeriod).map(({ history, month, period }) => ({
    period,
    value: financialYearMonthValue(history, month, 'netWorth', memberId),
  }))
}

export function positionHistoryDocuments(historyDocuments = [], { throughPeriod = null } = {}) {
  return historyDocuments
    .map((history) => {
      const year = Number(history?.year || history?.id)
      if (!Number.isInteger(year)) return null
      const months = Object.fromEntries(
        Object.entries(history.months || {}).filter(([month, projection]) =>
          isHistoricalPositionMonth(history, month, projection, throughPeriod),
        ),
      )
      return { ...history, id: history.id || String(year), year, months }
    })
    .filter(Boolean)
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
  return positionHistoryDocuments(historyDocuments, { throughPeriod })
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

function isHistoricalPositionMonth(history, month, projection, throughPeriod) {
  const year = Number(history?.year || history?.id)
  const period = `${year}-${month}`
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return false
  if (!projection?.assets || !projection?.liabilities) return false
  if (throughPeriod && period > throughPeriod) return false
  if (['unobserved', 'projected'].includes(projection.positionStatus)) return false
  const initializedMonths = [
    history.projectionState?.assetsInitializedMonth,
    history.projectionState?.liabilitiesInitializedMonth,
  ].filter((value) => /^(0[1-9]|1[0-2])$/.test(String(value || '')))
  const firstObservedMonth = initializedMonths.sort()[0] || '01'
  return month >= firstObservedMonth
}

function categoryValues(history, month, projection, section, memberId, multiplier = 1) {
  return Object.fromEntries(
    Object.keys(projection?.[section]?.categories || {}).map((categoryId) => [
      categoryId,
      financialYearMonthCategoryValue(history, month, section, categoryId, memberId) * multiplier,
    ]),
  )
}
