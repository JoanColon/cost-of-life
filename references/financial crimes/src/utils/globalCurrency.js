import { normalizeCurrency } from '../config/currencies.js'
import { normalizeAllowanceHistory } from './allowanceHistory.js'

export function relabelSettingsCurrency(settings, currency) {
  const nextCurrency = normalizeCurrency(currency)

  return {
    ...settings,
    currency: nextCurrency,
    monthlyCrimeAllowanceHistory: normalizeAllowanceHistory(
      settings?.monthlyCrimeAllowanceHistory,
      settings?.monthlyCrimeAllowance,
      nextCurrency,
    ).map((entry) => ({ ...entry, currency: nextCurrency })),
  }
}

export function relabelEventCurrency(event, currency) {
  return {
    ...event,
    currency: normalizeCurrency(currency),
  }
}
