<template>
  <q-dialog v-model="aiCreditsStore.purchaseDialogOpen">
    <q-card class="edit-dialog">
      <q-card-section class="dialog-header">
        <div>
          <div class="section-kicker">COMEDY SENTENCE SERVED</div>
          <h2>Get AI Crimes</h2>
        </div>
        <q-btn flat round dense color="white" icon="close" aria-label="Close" v-close-popup />
      </q-card-section>

      <q-card-section>
        <p>Choose a credit pack or upgrade to PRO for extended AI access.</p>
        <p class="credit-installation-notice">
          <q-icon name="info" color="warning" aria-hidden="true" />
          AI purchases are tied to this anonymous app installation. Uninstalling, clearing app data,
          or changing devices can permanently remove credits or unlimited access.
        </p>
        <div v-if="aiCreditsStore.billingStatus === 'loading'" class="billing-loading">
          <q-spinner color="warning" size="24px" />
          <span>Connecting to Google Play…</span>
        </div>
        <div v-else-if="aiCreditsStore.creditPacks.length" class="credit-pack-list">
          <q-btn
            v-for="pack in aiCreditsStore.creditPacks"
            :key="pack.productId"
            outline
            color="warning"
            no-caps
            :icon="matLocalFireDepartment"
            :label="`${pack.unlimited ? 'PRO · Extended AI access' : `${pack.credits} AI Crimes`} · ${pack.product.priceString}`"
            :loading="aiCreditsStore.purchasingProductId === pack.productId"
            :disable="aiCreditsStore.isPurchasing"
            @click="buy(pack.productId)"
          />
        </div>
        <span v-else>Unavailable from Google Play</span>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat color="white" no-caps label="Not now" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { useQuasar } from 'quasar'
import { matLocalFireDepartment } from '@quasar/extras/material-icons'

import { logAnalyticsEvent } from '@/services/analytics'
import { useAiCreditsStore } from '@/stores/aiCreditsStore'

const aiCreditsStore = useAiCreditsStore()
const $q = useQuasar()

async function buy(productId) {
  logAnalyticsEvent('ai_purchase_started', { product_id: productId })
  try {
    const result = await aiCreditsStore.buyCreditPack(productId)
    if (result.pending) {
      $q.notify({
        type: 'info',
        message: 'Purchase pending',
        caption: 'Google Play is processing it.',
      })
      return
    }
    aiCreditsStore.purchaseDialogOpen = false
    logAnalyticsEvent('ai_purchase_completed', {
      product_id: productId,
      credits_granted: result.creditsGranted,
      unlimited_granted: result.unlimited ? 1 : 0,
    })
    $q.notify({
      type: 'positive',
      message: result.unlimited ? 'PRO UPGRADE UNLOCKED' : 'AI CRIMES GRANTED',
      caption: result.unlimited
        ? 'Extended AI access is now active.'
        : `${result.credits} AI Crimes are now available.`,
    })
  } catch (error) {
    const cancelled = /cancel/i.test(String(error?.message || error))
    logAnalyticsEvent(cancelled ? 'ai_purchase_cancelled' : 'ai_purchase_verification_failed', {
      product_id: productId,
    })
    if (!cancelled) {
      $q.notify({
        type: 'negative',
        message: 'Purchase could not be completed.',
        caption: 'It will be recovered automatically if Google Play charged it.',
      })
    }
  }
}
</script>

<style scoped>
.credit-pack-list {
  display: grid;
  gap: 10px;
  margin-top: 16px;
}

.billing-loading {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-top: 16px;
}

.credit-pack-list :deep(.q-btn) {
  min-height: 48px;
}

.credit-installation-notice {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  font-size: 0.85rem;
  opacity: 0.8;
}

.credit-installation-notice .q-icon {
  flex: 0 0 auto;
  margin-top: 2px;
}
</style>
