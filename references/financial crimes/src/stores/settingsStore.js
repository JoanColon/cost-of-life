import { defineStore } from 'pinia'
import { defaultCategoryIds } from '@/config/crimeCategories'
import { normalizeCurrency } from '@/config/currencies'
import { changeGlobalCurrency, deleteAllData, getSettings, saveSettings } from '@/services/database'
import { normalizeAllowanceHistory, upsertAllowanceForMonth } from '@/utils/allowanceHistory'
import { getMonthKey } from '@/utils/timePeriods'
import { useCrimesStore } from '@/stores/crimesStore'
import { usePreventedCrimesStore } from '@/stores/preventedCrimesStore'

const defaultSettings = {
  currency: 'EUR',
  courtStrictness: 'reasonable',
  aiTextEnabled: true,
  monthlyCrimeAllowance: null,
  monthlyCrimeAllowanceHistory: [],
  selectedCategories: defaultCategoryIds,
  onboardingCompleted: false,
}

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    settings: { ...defaultSettings },
    loaded: false,
  }),

  getters: {
    currency: (state) => normalizeCurrency(state.settings.currency),
    selectedCategories: (state) => state.settings.selectedCategories || [],
    onboardingCompleted: (state) => Boolean(state.settings.onboardingCompleted),
  },

  actions: {
    async load() {
      try {
        const saved = await getSettings()
        this.settings = saved ? { ...defaultSettings, ...saved } : { ...defaultSettings }
        this.settings.currency = normalizeCurrency(this.settings.currency)
        this.settings.monthlyCrimeAllowanceHistory = normalizeAllowanceHistory(
          this.settings.monthlyCrimeAllowanceHistory,
          this.settings.monthlyCrimeAllowance,
          this.settings.currency,
        )
      } finally {
        this.loaded = true
      }
    },

    async update(changes) {
      const currency = normalizeCurrency(changes.currency ?? this.settings.currency)
      const currencyChanged = currency !== normalizeCurrency(this.settings.currency)
      const monthlyCrimeAllowance =
        'monthlyCrimeAllowance' in changes
          ? changes.monthlyCrimeAllowance
          : this.settings.monthlyCrimeAllowance
      const baseHistory =
        'monthlyCrimeAllowanceHistory' in changes
          ? changes.monthlyCrimeAllowanceHistory
          : this.settings.monthlyCrimeAllowanceHistory
      let monthlyCrimeAllowanceHistory

      if ('monthlyCrimeAllowanceHistory' in changes) {
        monthlyCrimeAllowanceHistory = normalizeAllowanceHistory(
          baseHistory,
          monthlyCrimeAllowance,
          currency,
        )
      } else if ('monthlyCrimeAllowance' in changes) {
        monthlyCrimeAllowanceHistory = upsertAllowanceForMonth(
          baseHistory,
          getMonthKey(new Date()),
          monthlyCrimeAllowance,
          currency,
        )
      } else {
        monthlyCrimeAllowanceHistory = normalizeAllowanceHistory(
          baseHistory,
          monthlyCrimeAllowance,
          currency,
        )
      }

      const nextSettings = {
        ...this.settings,
        ...changes,
        currency,
        monthlyCrimeAllowance,
        monthlyCrimeAllowanceHistory,
      }

      this.settings = currencyChanged
        ? await changeGlobalCurrency(nextSettings, currency)
        : await saveSettings(nextSettings)

      if (currencyChanged) {
        useCrimesStore().applyCurrency(currency)
        usePreventedCrimesStore().applyCurrency(currency)
      }

      return { settings: this.settings, currencyChanged }
    },

    async completeOnboarding(payload) {
      return this.update({
        ...payload,
        onboardingCompleted: true,
      })
    },

    async resetOnboarding() {
      await this.update({ onboardingCompleted: false })
    },

    async deleteEverything() {
      await deleteAllData()
      this.settings = { ...defaultSettings }
      this.loaded = true
    },
  },
})
