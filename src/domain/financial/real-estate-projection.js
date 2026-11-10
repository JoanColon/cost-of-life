import {
  addCalendarMonths,
  annualRealEstateValue,
  canonicalDate,
  roundMoney,
} from '../../../functions/shared/financial-core.js'

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
  if (appreciationRate < -100 || appreciationRate > 100) {
    throw new RangeError('The annual appreciation rate must be between -100% and 100%')
  }

  const dates = projectionDates(purchasedOn, valuedOn, months)
  const mortgagePoints = normalizedMortgageTimeline(mortgageTimeline)

  return dates.map((date) => {
    const propertyValue = annualRealEstateValue(
      {
        purchasePrice: price,
        purchaseDate: purchasedOn,
        annualAppreciationRate: appreciationRate,
      },
      date,
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
    date = addCalendarMonths(purchaseDate, month)
  }
  if (dates.at(-1) !== currentDate) dates.push(currentDate)

  for (let futureMonth = 1; futureMonth <= horizonMonths; futureMonth += 1) {
    dates.push(addCalendarMonths(currentDate, futureMonth))
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
