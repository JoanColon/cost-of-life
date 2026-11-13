/**
 * Deterministic real-estate valuation rules based on completed purchase anniversaries and an annual appreciation percentage.
 */
import { completedAnniversaryYears, requireCanonicalDate } from '../core/dates.js'
import { roundMoneyOrZero } from '../core/money.js'

/**
 * Calculates a property valuation using one appreciation step per completed purchase anniversary.
 * This is deliberately not monthly compounding: a value changes only when an anniversary passes.
 */
export function calculateAnniversaryRealEstateValuation(model, asOfDate) {
  const purchasePrice = requireNonNegativeNumber(model?.purchasePrice, 'purchase price')
  const annualAppreciationPercent = requireFiniteNumber(
    model?.annualAppreciationRate,
    'annual appreciation rate',
  )
  const purchaseDate = requireCanonicalDate(model?.purchaseDate, 'purchase date')
  const valuationDate = requireCanonicalDate(asOfDate, 'valuation date')
  if (purchaseDate > valuationDate) throw new RangeError('The purchase date cannot be in the future')
  if (annualAppreciationPercent < -100 || annualAppreciationPercent > 100) {
    throw new RangeError('A valid annual appreciation rate is required')
  }

  const completedYears = completedAnniversaryYears(purchaseDate, valuationDate)
  return roundMoneyOrZero(
    purchasePrice * Math.pow(1 + annualAppreciationPercent / 100, completedYears),
  )
}

/**
 * Returns validated finite number or throws when the supplied value is invalid.
 */
function requireFiniteNumber(value, label) {
  const number = Number(value)
  if (!Number.isFinite(number)) throw new RangeError(`A valid ${label} is required`)
  return number
}

/**
 * Returns validated non negative number or throws when the supplied value is invalid.
 */
function requireNonNegativeNumber(value, label) {
  const number = requireFiniteNumber(value, label)
  if (number < 0) throw new RangeError(`A valid ${label} is required`)
  return number
}
