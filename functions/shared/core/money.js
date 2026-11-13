/**
 * Foundational money normalization helpers. Values are converted to finite two-decimal amounts without introducing domain-specific policy.
 */
/**
 * Rounds a numeric value to currency precision and returns zero for non-finite input.
 * Use this when an absent amount is financially equivalent to zero.
 */
export function roundMoneyOrZero(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.round((number + Number.EPSILON) * 100) / 100 : 0
}

/**
 * Coerces and rounds a value to currency precision, returning null for a non-finite result.
 * Number-compatible empty values retain the established JavaScript coercion to zero; use
 * normalizeNonNegativeMoneyOrNull when null, undefined, or an empty string must be rejected.
 */
export function roundMoneyOrNull(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.round((number + Number.EPSILON) * 100) / 100 : null
}

/**
 * Normalizes a non-negative monetary input to currency precision.
 * Returns null so validation callers can distinguish invalid data from a legitimate zero balance.
 */
export function normalizeNonNegativeMoneyOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0) return null
  return roundMoneyOrZero(amount)
}
