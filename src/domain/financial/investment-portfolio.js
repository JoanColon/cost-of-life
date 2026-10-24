const PORTFOLIO_COLUMNS = [
  { name: 'ticker', aliases: ['ticker'], fallbackIndex: 0 },
  { name: 'country', aliases: ['country'], fallbackIndex: 2 },
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

export function portfolioTableRows(sheetRows) {
  if (!Array.isArray(sheetRows) || sheetRows.length < 2) return []

  const headers = sheetRows[0].map(normalizeHeader)
  const columnIndexes = Object.fromEntries(
    PORTFOLIO_COLUMNS.map(({ name, aliases, fallbackIndex }) => {
      const matchedIndex = headers.findIndex((header) =>
        aliases.some((alias) => header === alias || header.endsWith(` ${alias}`)),
      )
      return [name, matchedIndex >= 0 ? matchedIndex : fallbackIndex]
    }),
  )

  return sheetRows.slice(1).reduce((rows, sheetRow, rowIndex) => {
    if (!Array.isArray(sheetRow) || sheetRow.every((value) => !String(value ?? '').trim())) {
      return rows
    }

    const row = { id: `portfolio-${rowIndex}` }
    for (const { name } of PORTFOLIO_COLUMNS) {
      row[name] = String(sheetRow[columnIndexes[name]] ?? '').trim()
    }
    rows.push(row)
    return rows
  }, [])
}

export function changeTone(value) {
  const normalized = String(value ?? '')
    .trim()
    .replace(',', '.')
    .replace('%', '')
  const numericValue = Number(normalized)
  if (!Number.isFinite(numericValue) || numericValue === 0) return 'neutral'
  return numericValue < 0 ? 'negative' : 'positive'
}

function normalizeHeader(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[()%]/g, ' ')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
}
