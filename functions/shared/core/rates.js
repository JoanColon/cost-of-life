/**
 * Converts annual percentages into effective or nominal monthly rates and compound growth factors used by financial projections.
 */
/** Normalizes an annual percentage in the inclusive 0-100 range. */
export function normalizeAnnualPercent(value, fallback = null) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : fallback
}

/** Converts an effective annual percentage into its equivalent monthly decimal rate. */
export function effectiveMonthlyRateFromAnnualPercent(annualPercent = 0) {
  const annualRate = (normalizeAnnualPercent(annualPercent, 0) || 0) / 100
  return Math.pow(1 + annualRate, 1 / 12) - 1
}

/** Returns the compound growth factor for a number of months using an effective annual rate. */
export function compoundGrowthFactorForMonths(annualPercent = 0, months = 0) {
  return Math.pow(
    1 + effectiveMonthlyRateFromAnnualPercent(annualPercent),
    Math.max(0, Number(months) || 0),
  )
}

/**
 * Converts a nominal annual mortgage percentage into a monthly decimal rate.
 * This intentionally differs from an effective monthly rate: French mortgage amortization uses
 * the contractual nominal annual rate divided by twelve.
 */
export function nominalMonthlyRateFromAnnualPercent(annualPercent = 0) {
  const annualRate = normalizeAnnualPercent(annualPercent)
  if (annualRate == null) throw new RangeError('A valid annual interest rate is required')
  return annualRate / 100 / 12
}
