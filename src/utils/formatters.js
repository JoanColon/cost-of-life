import { computed, ref } from 'vue'

const DEFAULT_CURRENCY = 'EUR'
const activeCurrency = ref(DEFAULT_CURRENCY)
const formatterCache = new Map()

export const workspaceCurrency = computed(() => activeCurrency.value)
export const currencySymbol = computed(
  () =>
    currencyFormatter(activeCurrency.value)
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value || activeCurrency.value,
)

export function setWorkspaceCurrency(currency) {
  const normalized = String(currency || '')
    .trim()
    .toUpperCase()
  activeCurrency.value = /^[A-Z]{3}$/.test(normalized) ? normalized : DEFAULT_CURRENCY
}

export function formatCurrency(value) {
  return currencyFormatter(activeCurrency.value).format(value)
}

function currencyFormatter(currency) {
  if (!formatterCache.has(currency)) {
    formatterCache.set(
      currency,
      new Intl.NumberFormat('en-IE', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
    )
  }
  return formatterCache.get(currency)
}
