const NUMBER_LOCALE = 'en-IE'
const ALLOCATION_DIMENSIONS = new Set(['ticker', 'country', 'currency', 'sector', 'industry'])
const ALLOCATION_VALUES = new Set(['marketValueBase', 'annualDividendBase'])

export function portfolioAllocationGroups(
  holdings,
  dimension,
  valueField,
  unknownLabel = 'Unknown',
) {
  if (
    !Array.isArray(holdings) ||
    !ALLOCATION_DIMENSIONS.has(dimension) ||
    !ALLOCATION_VALUES.has(valueField)
  ) {
    return []
  }

  const grouped = new Map()
  for (const holding of holdings) {
    const value = numericValue(holding?.[valueField])
    if (value === null || value <= 0) continue
    const name = textValue(holding?.[dimension]) || unknownLabel
    const group = grouped.get(name) || { name, value: 0, holdings: [] }
    group.value += value
    group.holdings.push(holding)
    grouped.set(name, group)
  }

  const total = [...grouped.values()].reduce((sum, group) => sum + group.value, 0)
  return [...grouped.values()]
    .map((group) => ({
      ...group,
      percentage: total > 0 ? (group.value / total) * 100 : 0,
    }))
    .sort((left, right) => right.value - left.value || left.name.localeCompare(right.name))
}

export function portfolioTableRows(holdings, baseCurrency = '') {
  if (!Array.isArray(holdings)) return []
  return holdings.map((holding, index) => {
    const sharesValue = numericValue(holding.shares)
    const priceLocalValue = numericValue(holding.priceLocal)
    const dayChangeValue = numericValue(holding.dayChangePercent)
    const dividendYieldValue = numericValue(holding.dividendYieldPercent)
    const marketValueBaseValue = numericValue(holding.marketValueBase)
    const portfolioWeightValue = numericValue(holding.portfolioWeightPercent)
    const annualDividendBaseValue = numericValue(holding.annualDividendBase)
    const incomeWeightValue = numericValue(holding.incomeWeightPercent)

    return {
      id: holding.id || `portfolio-${index}`,
      ticker: textValue(holding.ticker),
      country: textValue(holding.country),
      currency: textValue(holding.currency),
      shares: formatNumberValue(sharesValue, 0, 4),
      sharesValue,
      priceLocal: formatCurrencyValue(priceLocalValue, holding.currency, 2),
      priceLocalValue,
      dayChange: formatPercentageValue(dayChangeValue, 2),
      dayChangeValue,
      dayChangeTone: numberTone(dayChangeValue),
      dividendYield: formatPercentageValue(dividendYieldValue, 2),
      dividendYieldValue,
      marketValueBase: formatCurrencyValue(marketValueBaseValue, baseCurrency, 0),
      marketValueBaseValue,
      portfolioWeight: formatPercentageValue(portfolioWeightValue, 1),
      portfolioWeightValue,
      annualDividendBase: formatCurrencyValue(annualDividendBaseValue, baseCurrency, 0),
      annualDividendBaseValue,
      incomeWeight: formatPercentageValue(incomeWeightValue, 1),
      incomeWeightValue,
    }
  })
}

export function portfolioKpis(summary = {}) {
  const baseCurrency = textValue(summary?.baseCurrency)
  const totalPortfolioValue = numericValue(summary?.totalPortfolioValue)
  const grossDividendIncome = numericValue(summary?.totalDividendsReceived)
  const annualDividendIncome = numericValue(summary?.annualDividendIncome)
  const dividendYield =
    totalPortfolioValue !== null && totalPortfolioValue > 0 && annualDividendIncome !== null
      ? (annualDividendIncome / totalPortfolioValue) * 100
      : null

  return {
    totalPortfolioValue: formatCurrencyValue(totalPortfolioValue, baseCurrency, 0) || '—',
    annualDividendIncome: formatCurrencyValue(annualDividendIncome, baseCurrency, 0) || '—',
    grossDividendIncome: formatCurrencyValue(grossDividendIncome, baseCurrency, 0) || '—',
    dividendYield: formatPercentageValue(dividendYield, 1) || '—',
  }
}

export function formatCurrencyValue(value, currency, fractionDigits = 2) {
  const amount = numericValue(value)
  const currencyCode = textValue(currency).toUpperCase()
  if (amount === null) return ''
  if (!currencyCode) return formatNumber(amount, 0, fractionDigits)
  try {
    return new Intl.NumberFormat(NUMBER_LOCALE, {
      style: 'currency',
      currency: currencyCode,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(amount)
  } catch {
    return `${formatNumber(amount, 0, fractionDigits)} ${currencyCode}`
  }
}

export function formatNumberValue(value, minimumFractionDigits = 0, maximumFractionDigits = 2) {
  const number = numericValue(value)
  return number === null ? '' : formatNumber(number, minimumFractionDigits, maximumFractionDigits)
}

export function formatPercentageValue(value, fractionDigits) {
  const number = numericValue(value)
  return number === null ? '' : `${formatNumber(number, fractionDigits, fractionDigits)}%`
}

export function countryFlag(value) {
  const code = textValue(value).toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return ''
  return String.fromCodePoint(...[...code].map((letter) => 127397 + letter.charCodeAt(0)))
}

function numberTone(value) {
  const number = numericValue(value)
  if (number === null || number === 0) return 'neutral'
  return number < 0 ? 'negative' : 'positive'
}

function numericValue(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function textValue(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function formatNumber(value, minimumFractionDigits, maximumFractionDigits) {
  return new Intl.NumberFormat(NUMBER_LOCALE, {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value)
}
