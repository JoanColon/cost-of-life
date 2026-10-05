<template>
  <article class="verdict-export-card" :style="{ '--verdict-accent': accentColor }">
    <img class="verdict-export-card__background" :src="backgroundAsset" alt="" />

    <div class="verdict-export-card__shade" />

    <section class="verdict-export-card__content">
      <div class="verdict-export-card__stats">
        <div class="verdict-export-card__stat">
          <q-icon :name="matReceiptLong" aria-label="Crimes" />
          <strong>{{ crimesCommitted }}</strong>
          <small>COMMITTED</small>
        </div>
        <div class="verdict-export-card__stat">
          <q-icon :name="matPaid" aria-label="Damages" />
          <strong>{{ totalDamagesLabel }}</strong>
          <small>TOTAL</small>
        </div>
        <div class="verdict-export-card__stat">
          <q-icon :name="matTrendingUp" aria-label="Budget" />
          <strong>{{ budgetDeltaLabel }}</strong>
          <small>{{ budgetStatusLabel }}</small>
        </div>
      </div>

      <div class="verdict-export-card__verdict">
        <q-icon :name="matGavel" aria-hidden="true" />
        <span>VERDICT - {{ monthLabel }}</span>
        <strong>{{ quote }}</strong>
      </div>
    </section>
  </article>
</template>

<script setup>
import { matGavel, matPaid, matReceiptLong, matTrendingUp } from '@quasar/extras/material-icons'

defineProps({
  backgroundAsset: {
    type: String,
    required: true,
  },
  accentColor: {
    type: String,
    required: true,
  },
  quote: {
    type: String,
    required: true,
  },
  monthLabel: {
    type: String,
    required: true,
  },
  crimesCommitted: {
    type: Number,
    required: true,
  },
  totalDamagesLabel: {
    type: String,
    required: true,
  },
  budgetDeltaLabel: {
    type: String,
    required: true,
  },
  budgetStatusLabel: {
    type: String,
    required: true,
  },
})
</script>
