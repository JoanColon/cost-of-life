import { defineStore } from 'pinia'
import {
  createPreventedCrime,
  deletePreventedCrime,
  listPreventedCrimes,
  updatePreventedCrime,
} from '@/services/database'
import { sortEventsNewestFirst } from '@/utils/eventDates'

export const usePreventedCrimesStore = defineStore('preventedCrimes', {
  state: () => ({
    preventedCrimes: [],
    loaded: false,
  }),

  actions: {
    async load() {
      try {
        this.preventedCrimes = await listPreventedCrimes()
      } finally {
        this.loaded = true
      }
    },

    async addPreventedCrime(payload) {
      const preventedCrime = await createPreventedCrime(payload)
      this.preventedCrimes = [preventedCrime, ...this.preventedCrimes]
      return preventedCrime
    },

    async deletePreventedCrime(id) {
      await deletePreventedCrime(id)
      this.preventedCrimes = this.preventedCrimes.filter((crime) => crime.id !== id)
    },

    async updatePreventedCrime(id, changes) {
      const updatedCrime = await updatePreventedCrime(id, changes)
      this.preventedCrimes = sortEventsNewestFirst(
        this.preventedCrimes.map((crime) => (crime.id === id ? updatedCrime : crime)),
      )
      return updatedCrime
    },

    applyCurrency(currency) {
      this.preventedCrimes = this.preventedCrimes.map((crime) => ({ ...crime, currency }))
    },

    clearLocal() {
      this.preventedCrimes = []
      this.loaded = true
    },
  },
})
