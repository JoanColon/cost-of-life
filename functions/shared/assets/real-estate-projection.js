/**
 * Projects property value, mortgage balance, and equity over a requested horizon using canonical dates and the shared real-estate valuation rules.
 */
import {
  addCalendarMonthsClamped,
  requireCanonicalDate,
} from '../core/dates.js'
import { roundMoneyOrZero } from '../core/money.js'
import { calculateAnniversaryRealEstateValuation } from './real-estate.js'

const DEFAULT_APPRECIATION_RATE = 2.5

/**
 * Projects property valuation, mortgage balance, and home equity over a monthly horizon.
 * Property appreciation follows completed purchase anniversaries, not monthly compounding.
 */
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
  const purchasedOn = requireCanonicalDate(purchaseDate, 'purchase date')
  const valuedOn = requireCanonicalDate(currentDate, 'current date')

  if (purchasedOn > valuedOn) throw new RangeError('The purchase date cannot be in the future')
  if (appreciationRate < -100 || appreciationRate > 100) {
    throw new RangeError('The annual appreciation rate must be between -100% and 100%')
  }

  const dates = projectionDates(purchasedOn, valuedOn, months)
  const mortgagePoints = normalizedMortgageTimeline(mortgageTimeline)

  return dates.map((date) => {
    const propertyValue = calculateAnniversaryRealEstateValuation(
      {
        purchasePrice: price,
        purchaseDate: purchasedOn,
        annualAppreciationRate: appreciationRate,
      },
      date,
    )
    const mortgageBalance = hasMortgage ? balanceAt(mortgagePoints, date) : 0
    const homeEquity =
      mortgageBalance === null ? null : roundMoneyOrZero(propertyValue - mortgageBalance)

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

/**
 * Builds the ordered dates included in a property projection.
 */
function projectionDates(purchaseDate, currentDate, horizonMonths) {
  const dates = []
  let month = 0
  let date = purchaseDate

  while (date < currentDate) {
    dates.push(date)
    month += 1
    date = addCalendarMonthsClamped(purchaseDate, month)
  }
  if (dates.at(-1) !== currentDate) dates.push(currentDate)

  for (let futureMonth = 1; futureMonth <= horizonMonths; futureMonth += 1) {
    dates.push(addCalendarMonthsClamped(currentDate, futureMonth))
  }
  return dates
}

/**
 * Validates and sorts mortgage points by canonical date.
 */
function normalizedMortgageTimeline(timeline) {
  return timeline
    .map(({ date, balance }) => ({
      date: requireCanonicalDate(date, 'mortgage date'),
      balance: nonNegativeNumber(balance, 'mortgage balance'),
    }))
    .sort((left, right) => left.date.localeCompare(right.date))
}

/**
 * Returns the latest mortgage balance observed on or before a date.
 */
function balanceAt(timeline, date) {
  if (!timeline.length || timeline[0].date > date) return null
  let balance = 0
  for (const point of timeline) {
    if (point.date > date) break
    balance = point.balance
  }
  return roundMoneyOrZero(balance)
}

/**
 * Returns a finite number or throws a labeled validation error.
 */
function finiteNumber(value, label) {
  const number = Number(value)
  if (!Number.isFinite(number)) throw new RangeError(`A valid ${label} is required`)
  return number
}

/**
 * Returns a non-negative number or throws a labeled validation error.
 */
function nonNegativeNumber(value, label) {
  const number = finiteNumber(value, label)
  if (number < 0) throw new RangeError(`A valid ${label} is required`)
  return number
}

/**
 * Returns a non-negative integer or throws a labeled validation error.
 */
function nonNegativeInteger(value, label) {
  const number = Number(value)
  if (!Number.isInteger(number) || number < 0) throw new RangeError(`A valid ${label} is required`)
  return number
}
