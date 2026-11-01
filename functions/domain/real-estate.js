function annualRealEstateValue(model, asOfDate) {
  const purchasePrice = nonNegativeNumber(model?.purchasePrice, 'purchase price')
  const annualAppreciationRate = finiteNumber(
    model?.annualAppreciationRate,
    'annual appreciation rate',
  )
  const purchaseDate = canonicalDate(model?.purchaseDate, 'purchase date')
  const valuationDate = canonicalDate(asOfDate, 'valuation date')
  if (purchaseDate > valuationDate) throw new Error('The purchase date cannot be in the future')
  if (annualAppreciationRate < -100 || annualAppreciationRate > 100) {
    throw new Error('A valid annual appreciation rate is required')
  }

  const years = completedYears(purchaseDate, valuationDate)
  return roundMoney(purchasePrice * Math.pow(1 + annualAppreciationRate / 100, years))
}

function effectiveRealEstateValue(asset, asOfDate) {
  if (asset?.detail?.realEstate?.schemaVersion !== 2) return Number(asset?.currentValue || 0)
  return annualRealEstateValue(asset.detail.realEstate, asOfDate)
}

function completedYears(startDate, endDate) {
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number)
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number)
  const beforeAnniversary = endMonth < startMonth || (endMonth === startMonth && endDay < startDay)
  return endYear - startYear - Number(beforeAnniversary)
}

function canonicalDate(value, label) {
  const date = String(value || '')
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) throw new Error(`A valid ${label} is required`)
  const parsed = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  if (
    parsed.getUTCFullYear() !== Number(match[1]) ||
    parsed.getUTCMonth() !== Number(match[2]) - 1 ||
    parsed.getUTCDate() !== Number(match[3])
  ) {
    throw new Error(`A valid ${label} is required`)
  }
  return date
}

function finiteNumber(value, label) {
  const number = Number(value)
  if (!Number.isFinite(number)) throw new Error(`A valid ${label} is required`)
  return number
}

function nonNegativeNumber(value, label) {
  const number = finiteNumber(value, label)
  if (number < 0) throw new Error(`A valid ${label} is required`)
  return number
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

module.exports = { annualRealEstateValue, effectiveRealEstateValue }
