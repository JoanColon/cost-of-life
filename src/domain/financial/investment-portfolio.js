const NUMBER_LOCALE = 'en-IE'

export function portfolioTableRows(holdings, baseCurrency = '') {
  if (!Array.isArray(holdings)) return []
  return holdings.map((holding, index) => ({
    id: holding.id || `portfolio-${index}`,
    ticker: textValue(holding.ticker),
    country: textValue(holding.country),
    currency: textValue(holding.currency),
    shares: formatNumberValue(holding.shares, 0, 4),
    priceLocal: formatCurrencyValue(holding.priceLocal, holding.currency, 2),
    dayChange: formatPercentageValue(holding.dayChangePercent, 2),
    dayChangeTone: numberTone(holding.dayChangePercent),
    dividendYield: formatPercentageValue(holding.dividendYieldPercent, 2),
    marketValueBase: formatCurrencyValue(holding.marketValueBase, baseCurrency, 0),
    portfolioWeight: formatPercentageValue(holding.portfolioWeightPercent, 1),
    annualDividendBase: formatCurrencyValue(holding.annualDividendBase, baseCurrency, 0),
    incomeWeight: formatPercentageValue(holding.incomeWeightPercent, 1),
  }))
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
