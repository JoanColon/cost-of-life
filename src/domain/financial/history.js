import {
  financialYearAvailableIncomeValue,
  financialYearFlowValue,
  financialYearMonthAvailableIncomeValue,
  financialYearMonthCategoryValue,
  financialYearMonthValue,
} from '../../../functions/shared/positions/annual-projection.js'
import { investableWealthAt } from './investable-wealth'

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

export function buildProgressSeries(
  historyDocuments = [],
  { throughPeriod = null, memberId = 'all', excludedLiabilityIds = new Set() } = {},
) {
  return positionPeriods(historyDocuments, throughPeriod).map(({ history, month, period }) => {
    const year = Number(history.year || history.id)
    const annualFinancialYear =
      historyDocuments.find((document) => Number(document?.year || document?.id) === year) ||
      history
    const costOfLife = financialYearFlowValue(annualFinancialYear, 'expenses', memberId)
    const income = financialYearAvailableIncomeValue(annualFinancialYear, memberId)
    const investableWealth = investableWealthAt(history, month, {
      memberId,
      excludedLiabilityIds,
    })

    return {
      period,
      netWorth: financialYearMonthValue(history, month, 'netWorth', memberId),
      assets: financialYearMonthValue(history, month, 'assets', memberId),
      liabilities: financialYearMonthValue(history, month, 'liabilities', memberId),
      investmentAssets: financialYearMonthCategoryValue(
        history,
        month,
        'assets',
        'investment',
        memberId,
      ),
      mortgageBalance: financialYearMonthCategoryValue(
        history,
        month,
        'liabilities',
        'mortgage',
        memberId,
      ),
      costOfLife,
      income,
      savingsCapacity: income - costOfLife,
      investableWealth,
      yearsFunded: costOfLife > 0 ? Math.max(0, investableWealth / costOfLife) : 0,
    }
  })
}

export function buildMonthlyFlowSeries(
  historyDocuments = [],
  { throughPeriod = null, memberId = 'all' } = {},
) {
  return positionPeriods(historyDocuments, throughPeriod).map(({ history, month, period }) => {
    const income = financialYearMonthAvailableIncomeValue(history, month, memberId)
    const costOfLife = financialYearMonthValue(history, month, 'expenses', memberId)
    return {
      period,
      income,
      costOfLife,
      savingsCapacity: income - costOfLife,
      coverage: expenseCoverage(history?.months?.[month]?.expenses),
    }
  })
}

export function buildNetWorthBridge(startPoint, endPoint) {
  if (!startPoint || !endPoint) return []
  return [
    ...sectionBridge(startPoint.assets, endPoint.assets, 'assets'),
    ...sectionBridge(startPoint.liabilities, endPoint.liabilities, 'liabilities'),
  ]
    .filter(({ value }) => Math.abs(value) >= 0.01)
    .sort((first, second) => Math.abs(second.value) - Math.abs(first.value))
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

function expenseCoverage(expenses) {
  const sources = new Set(
    Object.values(expenses?.categories || {}).flatMap((category) =>
      Object.values(category?.subcategories || {}).map(({ source }) => source || 'model'),
    ),
  )
  if (!sources.size || (sources.size === 1 && sources.has('model'))) return 'model'
  if (sources.size === 1 && sources.has('tracked')) return 'tracked'
  return 'mixed'
}

function sectionBridge(start = {}, end = {}, section) {
  const categoryIds = new Set([...Object.keys(start || {}), ...Object.keys(end || {})])
  return [...categoryIds].map((categoryId) => ({
    key: `${section}:${categoryId}`,
    section,
    categoryId,
    value: Number(end?.[categoryId] || 0) - Number(start?.[categoryId] || 0),
  }))
}
