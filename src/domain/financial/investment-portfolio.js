const PORTFOLIO_COLUMNS = [
  { name: 'ticker', aliases: ['ticker'], fallbackIndex: 0 },
  { name: 'country', aliases: ['country'], fallbackIndex: 2 },
  { name: 'currency', aliases: ['currency'], fallbackIndex: 5 },
  { name: 'shares', aliases: ['shares'], fallbackIndex: 6 },
  { name: 'priceLocal', aliases: ['price local'], fallbackIndex: 7 },
  { name: 'dayChange', aliases: ['day change', 'day change percent'], fallbackIndex: 8 },
  {
    name: 'dividendYield',
    aliases: ['dividend yield local', 'dividend yield'],
    fallbackIndex: 14,
  },
  { name: 'marketValueBase', aliases: ['market value base'], fallbackIndex: 16 },
  { name: 'portfolioWeight', aliases: ['portfolio percent', 'portfolio'], fallbackIndex: 17 },
  {
    name: 'annualDividendBase',
    aliases: ['annual dividend base', 'annual dividend'],
    fallbackIndex: 18,
  },
  { name: 'incomeWeight', aliases: ['income percent', 'income'], fallbackIndex: 19 },
]
const NUMBER_LOCALE = 'en-IE'

export function portfolioTableRows(sheetRows, baseCurrency = '') {
  if (!Array.isArray(sheetRows) || sheetRows.length < 2) return []

  const columnIndexes = portfolioColumnIndexes(sheetRows[0])

  return sheetRows.slice(1).reduce((rows, sheetRow, rowIndex) => {
    if (!Array.isArray(sheetRow) || sheetRow.every((value) => !String(value ?? '').trim())) {
      return rows
    }

    const row = { id: `portfolio-${rowIndex}` }
    for (const { name } of PORTFOLIO_COLUMNS) {
      row[name] = String(sheetRow[columnIndexes[name]] ?? '').trim()
    }
    row.shares = formatNumberValue(row.shares, 0, 4)
    row.priceLocal = formatCurrencyValue(row.priceLocal, row.currency, 2)
    row.dayChange = formatPercentageValue(row.dayChange, 2)
    row.dividendYield = formatPercentageValue(row.dividendYield, 2)
    row.marketValueBase = formatCurrencyValue(row.marketValueBase, baseCurrency, 0)
    row.portfolioWeight = formatPercentageValue(row.portfolioWeight, 1)
    row.annualDividendBase = formatCurrencyValue(row.annualDividendBase, baseCurrency, 0)
    row.incomeWeight = formatPercentageValue(row.incomeWeight, 1)
    rows.push(row)
    return rows
  }, [])
}

export function portfolioKpis(sheetRows, summary = {}) {
  const baseCurrency = String(summary?.baseCurrency || '').trim()
  const totalPortfolioValue = parseLocalizedNumber(summary?.totalPortfolioValue)
  let annualDividendIncome = null

  if (Array.isArray(sheetRows) && sheetRows.length >= 2) {
    const { annualDividendBase } = portfolioColumnIndexes(sheetRows[0])
    const dividendValues = sheetRows
      .slice(1)
      .map((row) => parseLocalizedNumber(Array.isArray(row) ? row[annualDividendBase] : null))
      .filter((value) => value !== null)

    if (dividendValues.length) {
      annualDividendIncome = dividendValues.reduce((total, value) => total + value, 0)
    }
  }

  const dividendYield =
    totalPortfolioValue !== null && totalPortfolioValue > 0 && annualDividendIncome !== null
      ? (annualDividendIncome / totalPortfolioValue) * 100
      : null

  return {
    totalPortfolioValue:
      totalPortfolioValue === null
        ? '—'
        : formatCurrencyValue(totalPortfolioValue, baseCurrency, 0),
    annualDividendIncome:
      annualDividendIncome === null
        ? '—'
        : formatCurrencyValue(annualDividendIncome, baseCurrency, 0),
    dividendYield: dividendYield === null ? '—' : formatPercentageValue(dividendYield, 1),
  }
}

export function formatCurrencyValue(value, currency, fractionDigits = 2) {
  const amount = parseLocalizedNumber(value)
  const currencyCode = String(currency ?? '')
    .trim()
    .toUpperCase()
  if (amount === null) return String(value ?? '').trim()
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
  const number = parseLocalizedNumber(value)
  if (number === null) return String(value ?? '').trim()
  return formatNumber(number, minimumFractionDigits, maximumFractionDigits)
}

export function formatPercentageValue(value, fractionDigits) {
  const number = parseLocalizedNumber(value)
  if (number === null) return String(value ?? '').trim()
  return `${formatNumber(number, fractionDigits, fractionDigits)}%`
}

export function changeTone(value) {
  const numericValue = parseLocalizedNumber(value)
  if (numericValue === null || numericValue === 0) return 'neutral'
  return numericValue < 0 ? 'negative' : 'positive'
}

export function countryFlag(value) {
  const code = String(value || '')
    .trim()
    .toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return ''
  return String.fromCodePoint(...[...code].map((letter) => 127397 + letter.charCodeAt(0)))
}

function parseLocalizedNumber(value) {
  const input = String(value ?? '')
    .trim()
    .replace(/[^0-9,.-]/g, '')
  if (!input) return null

  const lastComma = input.lastIndexOf(',')
  const lastDot = input.lastIndexOf('.')
  const decimalSeparator = lastComma > lastDot ? ',' : lastDot >= 0 ? '.' : null
  let normalized = input
  if (decimalSeparator) {
    const groupingSeparator = decimalSeparator === ',' ? '.' : ','
    normalized = normalized.replaceAll(groupingSeparator, '')
    const decimalIndex = normalized.lastIndexOf(decimalSeparator)
    normalized =
      normalized.slice(0, decimalIndex).replaceAll(decimalSeparator, '') +
      '.' +
      normalized.slice(decimalIndex + 1)
  }

  const number = Number(normalized)
  return Number.isFinite(number) ? number : null
}

function formatNumber(value, minimumFractionDigits, maximumFractionDigits) {
  return new Intl.NumberFormat(NUMBER_LOCALE, {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value)
}

function portfolioColumnIndexes(headerRow) {
  const headers = (Array.isArray(headerRow) ? headerRow : []).map(normalizeHeader)
  return Object.fromEntries(
    PORTFOLIO_COLUMNS.map(({ name, aliases, fallbackIndex }) => {
      const matchedIndex = headers.findIndex((header) =>
        aliases.some((alias) => header === alias || header.endsWith(` ${alias}`)),
      )
      return [name, matchedIndex >= 0 ? matchedIndex : fallbackIndex]
    }),
  )
}

function normalizeHeader(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[()%]/g, ' ')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
}
