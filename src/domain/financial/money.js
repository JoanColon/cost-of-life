export function normalizeMoney(value) {
  if (value === '' || value == null) return null
  const amount = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(amount) || amount < 0) return null
  return Math.round((amount + Number.EPSILON) * 100) / 100
}
