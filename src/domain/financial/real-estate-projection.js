const DEFAULT_APPRECIATION_RATE = 2.5

export function projectRealEstate({
  purchasePrice,
  purchaseDate,
  currentDate,
  annualAppreciationRate = DEFAULT_APPRECIATION_RATE,
  mortgageTimeline = [],
  hasMortgage = false,
  horizonMonths,
}) {
  const price = nonNegativeNumber(purchasePrice, 'purchase price')
  const appreciationRate = finiteNumber(annualAppreciationRate, 'annual appreciation rate')
  const months = nonNegativeInteger(horizonMonths, 'projection horizon')
  const purchasedOn = canonicalDate(purchaseDate, 'purchase date')
  const valuedOn = canonicalDate(currentDate, 'current date')

  if (purchasedOn > valuedOn) throw new RangeError('The purchase date cannot be in the future')
  if (appreciationRate < -100) {
    throw new RangeError('The annual appreciation rate cannot be below -100%')
  }

  const dates = projectionDates(purchasedOn, valuedOn, months)
  const mortgagePoints = normalizedMortgageTimeline(mortgageTimeline)

  return dates.map((date) => {
    const propertyValue = roundMoney(
      price * Math.pow(1 + appreciationRate / 100, completedYears(purchasedOn, date)),
    )
    const mortgageBalance = hasMortgage ? balanceAt(mortgagePoints, date) : 0
    const homeEquity = mortgageBalance === null ? null : roundMoney(propertyValue - mortgageBalance)

    return {
      date,
      isCurrent: date === valuedOn,
      propertyValue,
      mortgageBalance,
      homeEquity,
    }
  })
}

export { DEFAULT_APPRECIATION_RATE }

function projectionDates(purchaseDate, currentDate, horizonMonths) {
  const dates = []
  let month = 0
  let date = purchaseDate

  while (date < currentDate) {
    dates.push(date)
    month += 1
    date = addMonths(purchaseDate, month)
  }
  if (dates.at(-1) !== currentDate) dates.push(currentDate)

  for (let futureMonth = 1; futureMonth <= horizonMonths; futureMonth += 1) {
    dates.push(addMonths(currentDate, futureMonth))
  }
  return dates
}

function normalizedMortgageTimeline(timeline) {
  return timeline
    .map(({ date, balance }) => ({
      date: canonicalDate(date, 'mortgage date'),
      balance: nonNegativeNumber(balance, 'mortgage balance'),
    }))
    .sort((left, right) => left.date.localeCompare(right.date))
}

function balanceAt(timeline, date) {
  if (!timeline.length || timeline[0].date > date) return null
  let balance = 0
  for (const point of timeline) {
    if (point.date > date) break
    balance = point.balance
  }
  return roundMoney(balance)
}

function completedYears(startDate, endDate) {
  const start = dateParts(startDate)
  const end = dateParts(endDate)
  let years = end.year - start.year
  if (end.month < start.month || (end.month === start.month && end.day < start.day)) years -= 1
  return Math.max(0, years)
}

function addMonths(value, months) {
  const { year, month, day } = dateParts(value)
  const targetMonth = month - 1 + months
  const lastDay = new Date(Date.UTC(year, targetMonth + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, targetMonth, Math.min(day, lastDay))).toISOString().slice(0, 10)
}

function dateParts(value) {
  const [year, month, day] = value.split('-').map(Number)
  return { year, month, day }
}

function canonicalDate(value, label) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) throw new RangeError(`A valid ${label} is required`)
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() !== Number(match[2]) - 1 ||
    date.getUTCDate() !== Number(match[3])
  ) {
    throw new RangeError(`A valid ${label} is required`)
  }
  return date.toISOString().slice(0, 10)
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

function nonNegativeInteger(value, label) {
  const number = Number(value)
  if (!Number.isInteger(number) || number < 0) throw new RangeError(`A valid ${label} is required`)
  return number
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}
