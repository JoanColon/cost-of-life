import { defineStore } from 'pinia'
import { listAchievementMonthEvaluations, listAchievementUnlocks } from '@/services/database'
import {
  processImmediateAchievements,
  processPendingCompletedAchievementMonths,
} from '@/services/achievements'

export const useAchievementsStore = defineStore('achievements', {
  state: () => ({
    unlocks: [],
    monthEvaluations: [],
    loaded: false,
    processing: false,
    processingImmediate: false,
    unlockQueue: [],
    unlockDialogOpen: false,
  }),

  getters: {
    unlockedIds: (state) => new Set(state.unlocks.map((unlock) => unlock.achievementId)),
    evaluatedMonths: (state) => state.monthEvaluations.map((evaluation) => evaluation.month),
  },

  actions: {
    async load() {
      try {
        const [unlocks, monthEvaluations] = await Promise.all([
          listAchievementUnlocks(),
          listAchievementMonthEvaluations(),
        ])

        this.unlocks = unlocks
        this.monthEvaluations = monthEvaluations
      } finally {
        this.loaded = true
      }
    },

    async processPendingMonths({ crimes, preventedCrimes, settings }) {
      if (this.processing) {
        return []
      }

      this.processing = true

      try {
        const result = await processPendingCompletedAchievementMonths({
          crimes,
          preventedCrimes,
          settings,
          evaluatedMonths: this.evaluatedMonths,
        })

        if (result.newUnlocks.length) {
          this.unlocks = [...this.unlocks, ...result.newUnlocks]
          this.enqueueUnlocks(result.newUnlocks)
        }

        if (result.processedMonths.length) {
          const evaluatedAt = new Date().toISOString()
          const existingMonths = new Set(this.evaluatedMonths)
          const newEvaluations = result.processedMonths
            .filter((month) => !existingMonths.has(month))
            .map((month) => ({ month, evaluatedAt }))

          this.monthEvaluations = [...this.monthEvaluations, ...newEvaluations]
        }

        return result.newUnlocks
      } finally {
        this.processing = false
      }
    },

    async processImmediate({ crimes, preventedCrimes, settings }) {
      if (this.processingImmediate) {
        return []
      }

      this.processingImmediate = true

      try {
        const newUnlocks = await processImmediateAchievements({
          crimes,
          preventedCrimes,
          settings,
        })

        if (newUnlocks.length) {
          this.unlocks = [...this.unlocks, ...newUnlocks]
          this.enqueueUnlocks(newUnlocks)
        }

        return newUnlocks
      } finally {
        this.processingImmediate = false
      }
    },

    clearLocal() {
      this.unlocks = []
      this.monthEvaluations = []
      this.loaded = true
      this.processing = false
      this.processingImmediate = false
      this.unlockQueue = []
      this.unlockDialogOpen = false
    },

    enqueueUnlocks(unlocks) {
      const queuedIds = new Set(this.unlockQueue.map((unlock) => unlock.achievementId))
      const uniqueUnlocks = unlocks.filter((unlock) => !queuedIds.has(unlock.achievementId))

      if (!uniqueUnlocks.length) return

      this.unlockQueue = [...this.unlockQueue, ...uniqueUnlocks]
      this.unlockDialogOpen = true
    },

    clearUnlockQueue() {
      this.unlockQueue = []
      this.unlockDialogOpen = false
    },
  },
})
