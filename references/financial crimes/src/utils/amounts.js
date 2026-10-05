export function normalizeAmount(value) {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' && value.trim() === '') return null

  const amount = Number(value)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

export function isValidRequiredAmount(value) {
  return normalizeAmount(value) !== null
}

export function normalizeOptionalAmount(value) {
  if (value === null || value === undefined) return null

  const amount = normalizeAmount(value)
  if (amount === null) throw new TypeError('Amount must be a finite number greater than zero.')
  return amount
}

export function normalizeRequiredAmount(value) {
  const amount = normalizeAmount(value)
  if (amount === null) throw new TypeError('Amount must be a finite number greater than zero.')
  return amount
}
