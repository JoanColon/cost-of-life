const PORTFOLIO_SCHEMA = {
  version: 2,
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
    { name: 'sector', aliases: ['sector'], type: 'text', required: false },
    { name: 'industry', aliases: ['industry'], type: 'text', required: false },
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
  const normalizedSummary = normalizeSummary(summaryRows, { allowPartial: true })
  const normalizedHoldings = normalizeHoldings(portfolioRows, { collectWarnings: true })
  return {
    schemaVersion: PORTFOLIO_SCHEMA.version,
    summary: normalizedSummary.summary,
    holdings: normalizedHoldings.holdings,
    warnings: [...normalizedSummary.warnings, ...normalizedHoldings.warnings],
  }
}

function normalizeSummary(rows, { allowPartial = false } = {}) {
  const values = {}
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!Array.isArray(row)) continue
    const label = normalizeLabel(row[0])
    for (const [name, aliases] of Object.entries(PORTFOLIO_SCHEMA.summary)) {
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
  if (invalidFields.length && !allowPartial) {
    throw new Error(`The Google Sheet returned an invalid Summary: ${invalidFields.join(', ')}`)
  }

  const normalized = {
    ...summary,
    totalPortfolioValue: nullableMoney(summary.totalPortfolioValue),
    totalDividendsReceived: nullableMoney(summary.totalDividendsReceived),
    annualDividendIncome: nullableMoney(summary.annualDividendIncome),
  }
  if (!allowPartial) return normalized
  return {
    summary: normalized,
    warnings: invalidFields.map((field) => ({
      scope: 'summary',
      field: summaryFieldName(field),
      code: spreadsheetError(values[summaryFieldName(field)]) ? 'formula_error' : 'invalid_value',
    })),
  }
}

function normalizeHoldings(rows, { collectWarnings = false } = {}) {
  if (!Array.isArray(rows) || !rows.length) {
    throw new Error('The Google Sheet returned an empty Portfolio')
  }
  const headers = rows[0].map(normalizeLabel)
  const indexes = {}
  const missingColumns = []
  for (const field of PORTFOLIO_SCHEMA.holdings) {
    const index = headers.findIndex((header) =>
      field.aliases.some((alias) => header === alias || header.endsWith(` ${alias}`)),
    )
    if (index < 0 && field.required !== false) missingColumns.push(field.aliases[0])
    indexes[field.name] = index
  }
  if (missingColumns.length) {
    throw new Error(
      `The Google Sheet Portfolio is missing columns: ${missingColumns.join(', ')}`,
    )
  }

  const warnings = []
  const holdings = rows.slice(1).reduce((result, row, rowIndex) => {
    if (!Array.isArray(row) || row.every((value) => !String(value ?? '').trim())) return result
    const ticker = String(row[indexes.ticker] ?? '').trim()
    if (!ticker || spreadsheetError(ticker)) {
      if (String(row[indexes.ticker] ?? '').trim()) {
        warnings.push({ scope: 'holding', row: rowIndex + 2, field: 'ticker', code: 'formula_error' })
      }
      return result
    }

    const holding = { id: `portfolio-${rowIndex}`, ticker }
    for (const field of PORTFOLIO_SCHEMA.holdings) {
      if (field.name === 'ticker') continue
      const value = indexes[field.name] < 0 ? null : row[indexes[field.name]]
      const sourceError = spreadsheetError(value)
      holding[field.name] = field.type === 'number' ? parseLocalizedNumber(value) : sourceError ? '' : String(value ?? '').trim()
      const missingRequired =
        field.required !== false && (holding[field.name] == null || holding[field.name] === '')
      if (
        sourceError ||
        missingRequired ||
        (field.type === 'number' && holding[field.name] === null && String(value ?? '').trim())
      ) {
        warnings.push({
          scope: 'holding',
          row: rowIndex + 2,
          ticker,
          field: field.name,
          code: sourceError ? 'formula_error' : missingRequired ? 'missing_value' : 'invalid_value',
        })
      }
    }
    result.push(holding)
    return result
  }, [])
  return collectWarnings ? { holdings, warnings } : holdings
}

function parseLocalizedNumber(value) {
  if (spreadsheetError(value)) return null
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

function spreadsheetError(value) {
  return /^#(?:N\/A|ERROR!?|REF!?|DIV\/0!?|VALUE!?|NAME\??|NUM!?|NULL!?|SPILL!?|CALC!?|LOADING)(?:\b|$)/i.test(
    String(value ?? '').trim(),
  )
}

function nullableMoney(value) {
  return isNonNegativeNumber(value) ? roundMoney(value) : null
}

function summaryFieldName(label) {
  return {
    'base currency': 'baseCurrency',
    'portfolio value': 'totalPortfolioValue',
    'dividends received': 'totalDividendsReceived',
    'annual dividends': 'annualDividendIncome',
  }[label]
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

const investmentPortfolioSchema = {
  PORTFOLIO_SCHEMA,
  normalizeInvestmentPortfolio,
  normalizeSummary,
  normalizeHoldings,
  parseCsv,
  parseLocalizedNumber,
  spreadsheetError,
}

export {
  PORTFOLIO_SCHEMA,
  normalizeInvestmentPortfolio,
  normalizeSummary,
  normalizeHoldings,
  parseCsv,
  parseLocalizedNumber,
  spreadsheetError,
}
export default investmentPortfolioSchema
