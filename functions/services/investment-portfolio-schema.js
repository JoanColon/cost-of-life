const PORTFOLIO_SCHEMA_V1 = {
  version: 1,
  sheets: {
    portfolio: 'Portfolio',
    summary: 'Summary',
  },
  summary: {
    baseCurrency: ['base currency', 'currency'],
    totalPortfolioValue: [
      'portfolio value',
      'total portfolio value',
      'total portofolio value',
    ],
    totalDividendsReceived: ['dividends received', 'total dividends received'],
    annualDividendIncome: ['net dividends received'],
  },
  holdings: [
    { name: 'ticker', aliases: ['ticker'], type: 'text' },
    { name: 'country', aliases: ['country'], type: 'text' },
    { name: 'currency', aliases: ['currency'], type: 'text' },
    { name: 'shares', aliases: ['shares'], type: 'number' },
    { name: 'priceLocal', aliases: ['price local'], type: 'number' },
    {
      name: 'dayChangePercent',
      aliases: ['day change', 'day change percent'],
      type: 'number',
    },
    {
      name: 'dividendYieldPercent',
      aliases: ['dividend yield local', 'dividend yield'],
      type: 'number',
    },
    { name: 'marketValueBase', aliases: ['market value base'], type: 'number' },
    {
      name: 'portfolioWeightPercent',
      aliases: ['portfolio percent', 'portfolio'],
      type: 'number',
    },
    {
      name: 'annualDividendBase',
      aliases: ['annual dividend base', 'annual dividend'],
      type: 'number',
    },
    {
      name: 'incomeWeightPercent',
      aliases: ['income percent', 'income'],
      type: 'number',
    },
  ],
}

function normalizeInvestmentPortfolio(portfolioRows, summaryRows) {
  return {
    schemaVersion: PORTFOLIO_SCHEMA_V1.version,
    summary: normalizeSummary(summaryRows),
    holdings: normalizeHoldings(portfolioRows),
  }
}

function normalizeSummary(rows) {
  const values = {}
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!Array.isArray(row)) continue
    const label = normalizeLabel(row[0])
    for (const [name, aliases] of Object.entries(PORTFOLIO_SCHEMA_V1.summary)) {
      if (aliases.includes(label)) values[name] = row[1]
    }
  }

  const summary = {
    baseCurrency: parseBaseCurrency(
      values.baseCurrency,
      values.totalPortfolioValue,
      values.totalDividendsReceived,
    ),
    totalPortfolioValue: parseLocalizedNumber(values.totalPortfolioValue),
    totalDividendsReceived: parseLocalizedNumber(values.totalDividendsReceived),
    annualDividendIncome: parseLocalizedNumber(values.annualDividendIncome),
  }
  const invalidFields = []
  if (!/^[A-Z]{3}$/.test(summary.baseCurrency)) invalidFields.push('base currency')
  if (!isNonNegativeNumber(summary.totalPortfolioValue)) invalidFields.push('portfolio value')
  if (!isNonNegativeNumber(summary.totalDividendsReceived)) {
    invalidFields.push('dividends received')
  }
  if (!isNonNegativeNumber(summary.annualDividendIncome)) invalidFields.push('annual dividends')
  if (invalidFields.length) {
    throw new Error(`The Google Sheet returned an invalid Summary: ${invalidFields.join(', ')}`)
  }

  return {
    ...summary,
    totalPortfolioValue: roundMoney(summary.totalPortfolioValue),
    totalDividendsReceived: roundMoney(summary.totalDividendsReceived),
    annualDividendIncome: roundMoney(summary.annualDividendIncome),
  }
}

function normalizeHoldings(rows) {
  if (!Array.isArray(rows) || !rows.length) {
    throw new Error('The Google Sheet returned an empty Portfolio')
  }
  const headers = rows[0].map(normalizeLabel)
  const indexes = {}
  const missingColumns = []
  for (const field of PORTFOLIO_SCHEMA_V1.holdings) {
    const index = headers.findIndex((header) =>
      field.aliases.some((alias) => header === alias || header.endsWith(` ${alias}`)),
    )
    if (index < 0) missingColumns.push(field.aliases[0])
    indexes[field.name] = index
  }
  if (missingColumns.length) {
    throw new Error(
      `The Google Sheet Portfolio is missing columns: ${missingColumns.join(', ')}`,
    )
  }

  return rows.slice(1).reduce((holdings, row, rowIndex) => {
    if (!Array.isArray(row) || row.every((value) => !String(value ?? '').trim())) return holdings
    const ticker = String(row[indexes.ticker] ?? '').trim()
    if (!ticker) return holdings

    const holding = { id: `portfolio-${rowIndex}`, ticker }
    for (const field of PORTFOLIO_SCHEMA_V1.holdings) {
      if (field.name === 'ticker') continue
      const value = row[indexes[field.name]]
      holding[field.name] =
        field.type === 'number' ? parseLocalizedNumber(value) : String(value ?? '').trim()
    }
    holdings.push(holding)
    return holdings
  }, [])
}

function parseLocalizedNumber(value) {
  const input = String(value ?? '')
    .trim()
    .replace(/[^0-9,.-]/g, '')
  if (!input) return null

  const lastComma = input.lastIndexOf(',')
  const lastDot = input.lastIndexOf('.')
  let normalized = input
  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.'
    normalized = normalized.replaceAll(decimalSeparator === ',' ? '.' : ',', '')
    const decimalIndex = normalized.lastIndexOf(decimalSeparator)
    normalized =
      normalized.slice(0, decimalIndex).replaceAll(decimalSeparator, '') +
      '.' +
      normalized.slice(decimalIndex + 1)
  } else {
    const separator = lastComma >= 0 ? ',' : lastDot >= 0 ? '.' : null
    if (separator) {
      const parts = normalized.split(separator)
      const grouping = parts.length > 2 || (parts.length === 2 && parts[1].length === 3)
      normalized = grouping ? parts.join('') : `${parts[0]}.${parts[1]}`
    }
  }

  const number = Number(normalized)
  return Number.isFinite(number) ? number : null
}

function parseCsv(value) {
  const csv = String(value || '').replace(/^\uFEFF/, '')
  if (!csv) return []

  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index]
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        field += character
      }
    } else if (character === '"' && field === '') {
      quoted = true
    } else if (character === ',') {
      row.push(field)
      field = ''
    } else if (character === '\n' || character === '\r') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      if (character === '\r' && csv[index + 1] === '\n') index += 1
    } else {
      field += character
    }
  }
  if (quoted) throw new Error('The Google Sheet returned an invalid response')
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function parseBaseCurrency(...values) {
  const inputs = values.map((value) => String(value ?? '').trim()).filter(Boolean)
  for (const input of inputs) {
    const code = input.toUpperCase().match(/(?:^|[^A-Z])([A-Z]{3})(?:[^A-Z]|$)/)?.[1]
    if (code) return code
  }
  const combined = inputs.join(' ')
  if (combined.includes('€')) return 'EUR'
  if (combined.includes('£')) return 'GBP'
  if (combined.includes('₹')) return 'INR'
  if (combined.includes('₩')) return 'KRW'
  if (combined.includes('¥')) return 'JPY'
  if (combined.includes('$')) return 'USD'
  return ''
}

function normalizeLabel(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[()%]/g, ' ')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
}

function isNonNegativeNumber(value) {
  return Number.isFinite(value) && value >= 0
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

module.exports = {
  PORTFOLIO_SCHEMA_V1,
  normalizeInvestmentPortfolio,
  normalizeSummary,
  normalizeHoldings,
  parseCsv,
  parseLocalizedNumber,
}
