const { FINANCIAL_HISTORY_SCHEMA_VERSION } = require('../config/financial-history')

function roundMoney(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return 0
  return Math.round((amount + Number.EPSILON) * 100) / 100
}

function isItemizedCategory(category) {
  return Number(category?.itemCount || 0) > 0
}

function categoryValue(category) {
  if (!category?.enabled) return 0
  return roundMoney(isItemizedCategory(category) ? category.itemizedValue : category.manualValue)
}

function buildPosition(summary, documents, valueField) {
  const categories = Object.fromEntries(
    Object.entries(summary?.categories || {})
      .filter(([, category]) => category?.enabled)
      .map(([categoryId, category]) => [categoryId, categoryValue(category)]),
  )

  const items = {}
  const labels = {}

  for (const document of documents || []) {
    const data = document.data || {}
    const category = summary?.categories?.[data.category]
    if (!category?.enabled || !isItemizedCategory(category)) continue

    items[document.id] = roundMoney(data[valueField])
    const label = String(data.name || '').trim()
    if (label) labels[document.id] = label
  }

  return {
    position: {
      total: roundMoney(Object.values(categories).reduce((total, value) => total + value, 0)),
      categories,
      items,
    },
    labels,
  }
}

function buildMonthlyFinancialSnapshot({
  assetsSummary,
  liabilitiesSummary,
  assets = [],
  liabilities = [],
  capturedAt,
}) {
  const assetResult = buildPosition(assetsSummary, assets, 'currentValue')
  const liabilityResult = buildPosition(liabilitiesSummary, liabilities, 'balance')

  return {
    snapshot: {
      assets: assetResult.position,
      liabilities: liabilityResult.position,
      netWorth: roundMoney(assetResult.position.total - liabilityResult.position.total),
      capturedAt,
    },
    itemLabels: {
      assets: assetResult.labels,
      liabilities: liabilityResult.labels,
    },
  }
}

function periodForInstant(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return {
    year: Number(values.year),
    month: values.month,
    day: Number(values.day),
  }
}

function isLastDayOfMonth(instant, timeZone) {
  const period = periodForInstant(instant, timeZone)
  const lastDay = new Date(Date.UTC(period.year, Number(period.month), 0)).getUTCDate()
  return period.day === lastDay
}

function assertValidPeriod(year, month) {
  if (!Number.isInteger(year) || year < 2000 || year > 9999) {
    throw new Error('A valid snapshot year is required')
  }
  if (!/^(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error('A two-digit snapshot month is required')
  }
}

module.exports = {
  FINANCIAL_HISTORY_SCHEMA_VERSION,
  assertValidPeriod,
  buildMonthlyFinancialSnapshot,
  isLastDayOfMonth,
  periodForInstant,
}
