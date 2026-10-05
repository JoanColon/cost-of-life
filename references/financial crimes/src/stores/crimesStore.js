import { defineStore } from 'pinia'
import {
  cancelSubscription,
  createCrime,
  deleteCrime,
  listCrimes,
  replaceActiveSubscriptionTerms,
  updateCrime,
} from '@/services/database'
import { getCategory } from '@/config/crimeCategories'
import { sortEventsNewestFirst } from '@/utils/eventDates'

export const useCrimesStore = defineStore('crimes', {
  state: () => ({
    crimes: [],
    loaded: false,
  }),

  getters: {
    pendingCrimes: (state) => state.crimes.filter((crime) => crime.status === 'pendingAmount'),
  },

  actions: {
    // Initial load hydrates the store with only persisted source events.
    async load() {
      try {
        this.crimes = await listCrimes()
      } finally {
        this.loaded = true
      }
    },

    // Generic category flow keeps the existing quick amount behavior intact.
    async reportCrime(categoryId, amount = null) {
      const category = getCategory(categoryId)
      const crime = await createCrime({
        categoryId,
        title: category.crimeName,
        amount,
        status: amount == null ? 'pendingAmount' : 'complete',
      })

      this.crimes = [crime, ...this.crimes]
      return crime
    },

    // Subscriptions persist one source event plus recurrence metadata.
    async reportSubscriptionCrime({ provider, recurrence, amount }) {
      const crime = await createCrime({
        categoryId: 'subscriptions',
        title: provider.label,
        amount,
        recurrence,
        recurrenceEndAt: null,
        status: amount == null ? 'pendingAmount' : 'complete',
        metadata: {
          subscriptionProviderId: provider.id,
        },
      })

      this.crimes = [crime, ...this.crimes]
      return crime
    },

    async updateCrime(id, changes) {
      const updated = await updateCrime(id, changes)
      this.crimes = sortEventsNewestFirst(
        this.crimes.map((crime) => (crime.id === id ? updated : crime)),
      )
      return updated
    },

    async cancelSubscription(id) {
      const updated = await cancelSubscription(id)
      this.crimes = this.crimes.map((crime) => (crime.id === id ? updated : crime))
      return updated
    },

    async replaceActiveSubscriptionTerms(id, changes) {
      const { closedEvent, newEvent } = await replaceActiveSubscriptionTerms(id, changes)
      const nextCrimes = closedEvent
        ? this.crimes.map((crime) => (crime.id === id ? closedEvent : crime)).concat(newEvent)
        : this.crimes.map((crime) => (crime.id === id ? newEvent : crime))

      this.crimes = sortEventsNewestFirst(nextCrimes)
      return newEvent
    },

    async deleteCrime(id) {
      await deleteCrime(id)
      this.crimes = this.crimes.filter((crime) => crime.id !== id)
    },

    applyCurrency(currency) {
      this.crimes = this.crimes.map((crime) => ({ ...crime, currency }))
    },

    clearLocal() {
      this.crimes = []
      this.loaded = true
    },
  },
})
