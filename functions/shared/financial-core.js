export function roundMoney(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.round((number + Number.EPSILON) * 100) / 100 : 0
}

export function normalizeAnnualPercent(value, fallback = null) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : fallback
}

export function effectiveMonthlyRate(annualPercent = 0) {
  const annualRate = (normalizeAnnualPercent(annualPercent, 0) || 0) / 100
  return Math.pow(1 + annualRate, 1 / 12) - 1
}

export function effectiveGrowthFactor(annualPercent = 0, months = 0) {
  return Math.pow(1 + effectiveMonthlyRate(annualPercent), Math.max(0, Number(months) || 0))
}

export function nominalMonthlyRate(annualPercent = 0) {
  const annualRate = normalizeAnnualPercent(annualPercent)
  if (annualRate == null) throw new RangeError('A valid annual interest rate is required')
  return annualRate / 100 / 12
}

export function frenchMortgagePaymentStep({
  balance,
  annualInterestRate,
  monthlyPayment,
  extraMonthlyPayment = 0,
}) {
  const currentBalance = nonNegativeNumber(balance, 'mortgage balance')
  const regularPayment = nonNegativeNumber(monthlyPayment, 'monthly payment')
  const extraPayment = nonNegativeNumber(extraMonthlyPayment, 'extra monthly payment')
  const interest = roundMoney(currentBalance * nominalMonthlyRate(annualInterestRate))
  const payment = roundMoney(
    Math.min(roundMoney(regularPayment + extraPayment), currentBalance + interest),
  )
  const principal = roundMoney(Math.min(currentBalance, payment - interest))
  if (currentBalance > 0 && principal <= 0) {
    throw new RangeError('The monthly payment does not cover the accrued interest')
  }
  return {
    payment,
    interest,
    principal,
    remainingBalance: roundMoney(Math.max(0, currentBalance - principal)),
  }
}

export function allocateValueByOwnership(value, ownership, memberIds = []) {
  const amountInCents = Math.round(Math.max(0, roundMoney(value)) * 100)
  const shares = (ownership?.shares || []).filter((share) => Number(share.percentage) > 0)
  const values = Object.fromEntries(memberIds.filter(Boolean).map((memberId) => [memberId, 0]))
  let assignedCents = 0

  shares.forEach((share, index) => {
    const cents =
      index === shares.length - 1 ?
        amountInCents - assignedCents :
        Math.round((amountInCents * Number(share.percentage)) / 100)
    assignedCents += cents
    values[share.memberId] = roundMoney((values[share.memberId] || 0) + cents / 100)
  })

  return values
}

export function annualRealEstateValue(model, asOfDate) {
  const purchasePrice = nonNegativeNumber(model?.purchasePrice, 'purchase price')
  const annualAppreciationRate = finiteNumber(
    model?.annualAppreciationRate,
    'annual appreciation rate',
  )
  const purchaseDate = canonicalDate(model?.purchaseDate, 'purchase date')
  const valuationDate = canonicalDate(asOfDate, 'valuation date')
  if (purchaseDate > valuationDate) throw new RangeError('The purchase date cannot be in the future')
  if (annualAppreciationRate < -100 || annualAppreciationRate > 100) {
    throw new RangeError('A valid annual appreciation rate is required')
  }

  const years = completedYears(purchaseDate, valuationDate)
  return roundMoney(purchasePrice * Math.pow(1 + annualAppreciationRate / 100, years))
}

export function completedYears(startDate, endDate) {
  const canonicalStart = canonicalDate(startDate, 'start date')
  const canonicalEnd = canonicalDate(endDate, 'end date')
  const [startYear, startMonth, startDay] = canonicalStart.split('-').map(Number)
  const [endYear, endMonth, endDay] = canonicalEnd.split('-').map(Number)
  const beforeAnniversary = endMonth < startMonth || (endMonth === startMonth && endDay < startDay)
  return endYear - startYear - Number(beforeAnniversary)
}

export function canonicalDate(value, label = 'date') {
  const date = String(value || '')
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) throw new RangeError(`A valid ${label} is required`)
  const parsed = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  if (
    parsed.getUTCFullYear() !== Number(match[1]) ||
    parsed.getUTCMonth() !== Number(match[2]) - 1 ||
    parsed.getUTCDate() !== Number(match[3])
  ) {
    throw new RangeError(`A valid ${label} is required`)
  }
  return date
}

export function addCalendarMonths(value, months) {
  const date = canonicalDate(value)
  const offset = Number(months)
  if (!Number.isInteger(offset)) throw new RangeError('A valid month offset is required')
  const [year, month, day] = date.split('-').map(Number)
  const targetMonth = month - 1 + offset
  const lastDay = new Date(Date.UTC(year, targetMonth + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, targetMonth, Math.min(day, lastDay))).toISOString().slice(0, 10)
}

export function financialDate(value = new Date(), timeZone = 'Europe/Madrid') {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new RangeError('A valid date is required')
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone,
    })
      .formatToParts(date)
      .map(({ type, value: part }) => [type, part]),
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}

function finiteNumber(value, label) {
  const number = Number(value)
  if (!Number.isFinite(number)) throw new RangeError(`A valid ${label} is required`)
  return number
}

function nonNegativeNumber(value, label) {
  const number = finiteNumber(value, label)
  if (number < 0) throw new RangeError(`A valid ${label} is required`)
  return number
}
