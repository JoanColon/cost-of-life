<template>
  <DashboardCard
    class="financial-position-card"
    :title="t('dashboard.financialPosition.title')"
    :subtitle="t('dashboard.financialPosition.subtitle')"
    icon="bar_chart"
    icon-tone="green"
    @open="$emit('open')"
  >
    <div class="position-layout">
      <div class="position-summary">
        <div class="net-worth">
          <strong>{{ formatCurrency(data.netWorth) }}</strong>
          <span>{{ t('dashboard.financialPosition.netWorth') }}</span>
        </div>

        <div class="position-breakdown">
          <button class="breakdown-row" type="button" @click="$emit('open-assets')">
            <span class="metric-dot assets" />
            <span class="breakdown-copy">
              <strong>{{ formatCurrency(data.assets) }}</strong>
              <small>{{ t('dashboard.financialPosition.assets') }}</small>
            </span>
          </button>

          <span class="metric-divider" aria-hidden="true" />

          <button class="breakdown-row" type="button" @click="$emit('open-liabilities')">
            <span class="metric-dot liabilities" />
            <span class="breakdown-copy">
              <strong>{{ formatCurrency(data.liabilities) }}</strong>
              <small>{{ t('dashboard.financialPosition.liabilities') }}</small>
            </span>
          </button>
        </div>
      </div>

      <NetWorthHistoryChart
        :points="historyPoints"
        :loading="historyLoading"
        :error="historyError"
      />
    </div>
  </DashboardCard>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import DashboardCard from './DashboardCard.vue'
import NetWorthHistoryChart from './NetWorthHistoryChart.vue'
import { formatCurrency } from '@/utils/formatters'

defineProps({
  data: { type: Object, required: true },
  historyPoints: { type: Array, required: true },
  historyLoading: { type: Boolean, default: false },
  historyError: { type: Boolean, default: false },
})
defineEmits(['open', 'open-assets', 'open-liabilities'])
const { t } = useI18n()
</script>

<style lang="scss">
@use '@/css/mixins' as *;

.financial-position-card {
  .position-layout {
    display: grid;
    grid-template-columns: minmax(18rem, 0.8fr) minmax(25rem, 1.2fr);
    align-items: stretch;
    gap: clamp(2rem, 5vw, 5rem);
  }

  .position-summary {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding-left: 4.5rem;
  }

  .net-worth strong,
  .net-worth span {
    display: block;
  }

  .net-worth strong {
    color: var(--color-ink);
    font-size: clamp(3rem, 5.5vw, 5rem);
    font-weight: 780;
    line-height: 0.95;
    letter-spacing: -0.065em;
    white-space: nowrap;
  }

  .net-worth span {
    margin-top: 0.55rem;
    color: var(--color-copy);
    font-size: 1.08rem;
  }

  .position-breakdown {
    display: flex;
    align-items: center;
    gap: 1.35rem;
    margin-top: 1.75rem;
  }

  .breakdown-row {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    min-width: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--color-ink);
    text-align: left;
    cursor: pointer;
  }

  .breakdown-row:focus-visible {
    border-radius: 0.5rem;
    @include focus-ring;
  }

  .breakdown-row:hover strong {
    color: var(--color-primary);
  }

  .metric-dot {
    flex: 0 0 1.15rem;
    width: 1.15rem;
    height: 1.15rem;
    border-radius: 50%;
  }

  .metric-dot.assets {
    background: var(--color-success);
  }

  .metric-dot.liabilities {
    background: #ff8588;
  }

  .breakdown-copy strong,
  .breakdown-copy small {
    display: block;
  }

  .breakdown-copy strong {
    font-size: 1.18rem;
    white-space: nowrap;
  }

  .breakdown-copy small {
    margin-top: 0.2rem;
    color: var(--color-copy);
    font-size: 0.82rem;
  }

  .metric-divider {
    width: 1px;
    height: 3rem;
    background: var(--color-line);
  }

  @media (max-width: 800px) {
    .position-layout {
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }

    .position-summary {
      padding-left: 0;
    }
  }

  @media (max-width: 599px) {
    .position-layout {
      gap: 1rem;
    }

    .net-worth strong {
      font-size: clamp(2.55rem, 13vw, 3.7rem);
    }

    .position-breakdown {
      gap: 0.8rem;
      margin-top: 1.35rem;
    }

    .breakdown-row {
      gap: 0.55rem;
    }

    .breakdown-copy strong {
      font-size: 1rem;
    }

    .metric-divider {
      height: 2.6rem;
    }
  }
}
</style>
