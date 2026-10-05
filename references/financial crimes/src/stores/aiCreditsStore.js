import { defineStore } from 'pinia'

let remoteStartupPromise = null
let billingInitializationPromise = null
let billingOperationQueue = Promise.resolve()
let purchasePromise = null

function serializeBillingOperation(operation) {
  const result = billingOperationQueue.catch(() => {}).then(operation)
  billingOperationQueue = result.catch(() => {})
  return result
}

export const useAiCreditsStore = defineStore('aiCredits', {
  state: () => ({
    credits: null,
    unlimited: false,
    loaded: false,
    creditStatus: 'loading',
    balanceRequestSequence: 0,
    appliedBalanceSequence: 0,
    monthlyCreditsGranted: 0,
    purchaseDialogOpen: false,
    creditPacks: [],
    billingAvailable: false,
    billingStatus: 'loading',
    isPurchasing: false,
    purchasingProductId: null,
  }),

  getters: {
    balanceLabel: (state) =>
      state.creditStatus === 'loading'
        ? 'Loading AI credits…'
        : state.unlimited
          ? 'PRO · Extended AI access'
          : state.credits == null
            ? 'AI credits unavailable'
            : `${state.credits} AI Crimes available`,
  },

  actions: {
    async refresh() {
      const requestSequence = this.beginBalanceRequest()
      this.creditStatus = 'loading'

      try {
        const { getAiCredits } = await import('@/services/functions')
        const result = await getAiCredits()
        this.applyServerBalance(result, requestSequence)
        return result
      } catch (error) {
        if (this.credits == null) this.creditStatus = 'unavailable'
        throw error
      } finally {
        this.loaded = true
      }
    },

    beginBalanceRequest() {
      this.balanceRequestSequence += 1
      return this.balanceRequestSequence
    },

    applyServerBalance(result, requestSequence = this.beginBalanceRequest()) {
      if (Number(result?.monthlyCreditsGranted) > 0) {
        this.monthlyCreditsGranted = Math.max(
          this.monthlyCreditsGranted,
          Number(result.monthlyCreditsGranted),
        )
      }

      if (requestSequence < this.appliedBalanceSequence) return false

      if (typeof result?.unlimited === 'boolean') this.unlimited = result.unlimited
      if (Number.isFinite(result?.credits)) this.credits = Math.max(0, result.credits)
      if (Number.isFinite(result?.creditsRemaining)) {
        this.credits = Math.max(0, result.creditsRemaining)
      }
      this.appliedBalanceSequence = requestSequence
      this.creditStatus = this.credits == null && !this.unlimited ? 'unavailable' : 'ready'
      this.loaded = true
      return true
    },

    markExhausted(requestSequence = this.beginBalanceRequest()) {
      if (this.unlimited) return
      if (requestSequence < this.appliedBalanceSequence) return
      this.credits = 0
      this.appliedBalanceSequence = requestSequence
      this.creditStatus = 'ready'
      this.loaded = true
    },

    takeMonthlyGrantNotice() {
      const creditsGranted = this.monthlyCreditsGranted
      this.monthlyCreditsGranted = 0
      return creditsGranted
    },

    openPurchaseDialog() {
      if (this.unlimited) return
      this.purchaseDialogOpen = true
    },

    startRemoteServices() {
      if (remoteStartupPromise) return remoteStartupPromise

      remoteStartupPromise = (async () => {
        try {
          const { ensureRemoteAuthReady } = await import('@/services/remoteReadiness')
          await ensureRemoteAuthReady()
          await this.refresh()
        } catch {
          if (this.credits == null) this.creditStatus = 'unavailable'
          this.loaded = true
        } finally {
          this.initializeBilling().catch(() => {})
        }
      })()

      return remoteStartupPromise
    },

    initializeBilling() {
      if (billingInitializationPromise) return billingInitializationPromise

      this.billingStatus = 'loading'
      billingInitializationPromise = serializeBillingOperation(async () => {
        try {
          const [{ ensureRemoteAuthReady }, { loadAiCreditProducts, recoverAiCreditPurchases }] =
            await Promise.all([
              import('@/services/remoteReadiness'),
              import('@/services/aiPurchases'),
            ])
          await ensureRemoteAuthReady()

          try {
            const requestSequence = this.beginBalanceRequest()
            const recovered = await recoverAiCreditPurchases()
            if (recovered) this.applyServerBalance(recovered, requestSequence)
          } catch {
            // An interrupted purchase remains owned and will be retried on the next launch.
          }

          this.creditPacks = await loadAiCreditProducts()
          this.billingAvailable = this.creditPacks.length > 0
          this.billingStatus = this.billingAvailable ? 'ready' : 'unavailable'
        } catch {
          this.creditPacks = []
          this.billingAvailable = false
          this.billingStatus = 'unavailable'
        }
      })

      return billingInitializationPromise
    },

    async buyCreditPack(productId) {
      if (purchasePromise) return purchasePromise

      this.isPurchasing = true
      this.purchasingProductId = productId
      purchasePromise = (async () => {
        await this.initializeBilling()
        return serializeBillingOperation(async () => {
          const { purchaseAiCredits } = await import('@/services/aiPurchases')
          const requestSequence = this.beginBalanceRequest()
          const result = await purchaseAiCredits(productId)
          if (!result.pending) this.applyServerBalance(result, requestSequence)
          return result
        })
      })()

      try {
        return await purchasePromise
      } finally {
        purchasePromise = null
        this.isPurchasing = false
        this.purchasingProductId = null
      }
    },
  },
})
