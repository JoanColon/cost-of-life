const euroFormatter = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export const currencySymbol =
  euroFormatter.formatToParts(0).find((part) => part.type === 'currency')?.value || 'EUR'

export function formatCurrency(value) {
  return euroFormatter.format(value)
}
