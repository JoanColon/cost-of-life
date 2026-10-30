<template>
  <DashboardCard
    class="plan-summary-card"
    :title="t('dashboard.planSummary.title')"
    :subtitle="t('dashboard.planSummary.subtitle')"
    icon="track_changes"
    icon-tone="blue"
  >
    <div v-if="data.state === 'strategy'" class="plan-result strategy-plan-result">
      <div class="strategy-context">
        <span class="result-label">{{ t('dashboard.planSummary.strategyLabel') }}</span>
        <div class="strategy-summary">
          <strong>{{ data.name }}</strong>
          <span>
            {{
              t('dashboard.planSummary.allocatedMonthly', {
                amount: formatCurrency(data.monthlyAmount),
              })
            }}
          </span>
        </div>
      </div>
      <ul class="strategy-outcomes" :aria-label="t('plan.outcomes.label')">
        <li v-for="outcome in data.outcomes" :key="outcome.id" :class="outcome.id">
          <span><i aria-hidden="true" />{{ outcome.label }}</span>
          <strong>{{ outcome.result }}</strong>
        </li>
      </ul>
    </div>

    <div v-else-if="data.state === 'what-if'" class="plan-result">
      <span class="result-label">{{ t('dashboard.planSummary.whatIfLabel') }}</span>
      <strong class="result-value">{{ formatCurrency(data.monthlyAmount) }}</strong>
      <span class="primary-result">
        {{
          t('dashboard.planSummary.simulatedCapacity', {
            amount: formatCurrency(data.monthlyAmount),
          })
        }}
      </span>
      <span class="secondary-result positive">
        {{
          t('dashboard.planSummary.extraSavings', {
            amount: formatCurrency(data.extraSavings),
          })
        }}
      </span>
    </div>

    <div v-else class="plan-empty">
      <span class="empty-icon"><q-icon name="insights" /></span>
      <strong>{{ t('dashboard.planSummary.emptyTitle') }}</strong>
      <p>{{ t('dashboard.planSummary.emptyDescription') }}</p>
    </div>

    <router-link
      class="plan-action"
      :to="data.state === 'empty' ? setupRoute : planRoute"
    >
      <span>
        {{
          data.state === 'empty'
            ? t('dashboard.planSummary.addData')
            : t('dashboard.planSummary.action')
        }}
      </span>
      <q-icon name="arrow_forward" />
    </router-link>
  </DashboardCard>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import DashboardCard from './DashboardCard.vue'
import { formatCurrency } from '@/utils/formatters'

defineProps({
  data: { type: Object, required: true },
  planRoute: { type: Object, required: true },
  setupRoute: { type: Object, required: true },
})

const { t } = useI18n()
</script>

<style lang="scss">
.plan-summary-card {
  display: flex;
  flex-direction: column;

  .plan-result,
  .plan-empty {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 11rem;
    text-align: center;
  }

  .plan-result {
    justify-content: flex-start;
    padding-top: 0.25rem;
  }

  .strategy-plan-result {
    align-items: stretch;
    padding-bottom: 0.5rem;
    text-align: left;
  }

  .strategy-context {
    display: grid;
    gap: 0.2rem;
  }

  .strategy-summary {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.6rem;
  }

  .strategy-summary strong {
    overflow: hidden;
    color: var(--color-ink);
    font-size: 1rem;
    line-height: 1.15;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .strategy-summary span {
    flex: 0 0 auto;
    color: var(--color-copy);
    font-size: 0.72rem;
    font-weight: 650;
  }

  .result-label {
    color: var(--color-primary);
    font-size: 0.78rem;
    font-weight: 750;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .strategy-name,
  .result-value {
    margin-top: 0.45rem;
    font-size: clamp(1.7rem, 3vw, 2.5rem);
    line-height: 1.05;
    letter-spacing: -0.04em;
  }

  .primary-result {
    margin-top: 0.7rem;
    color: var(--color-ink-soft);
    font-weight: 650;
  }

  .secondary-result {
    margin-top: 0.25rem;
    color: var(--color-copy);
    font-size: 0.82rem;
  }

  .secondary-result.positive {
    color: var(--color-success-dark);
  }

  .strategy-outcomes {
    display: grid;
    width: 100%;
    gap: 0.35rem;
    margin: 0.55rem 0 0;
    padding: 0;
    list-style: none;
  }

  .strategy-outcomes li,
  .strategy-outcomes li > span {
    display: flex;
    align-items: center;
  }

  .strategy-outcomes li {
    justify-content: space-between;
    gap: 0.55rem;
    min-height: 2.15rem;
    padding: 0.38rem 0.5rem;
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--color-green-soft) 65%, var(--color-surface));
    color: var(--color-copy);
    font-size: 0.72rem;
    text-align: left;
  }

  .strategy-outcomes li.invest {
    background: color-mix(in srgb, var(--color-purple-soft) 58%, var(--color-surface));
  }

  .strategy-outcomes li.debt {
    background: color-mix(in srgb, #fff0e8 72%, var(--color-surface));
  }

  .strategy-outcomes li > span {
    gap: 0.38rem;
  }

  .strategy-outcomes i {
    width: 0.42rem;
    height: 0.42rem;
    flex: 0 0 auto;
    border-radius: 50%;
    background: var(--color-chart-cash);
  }

  .strategy-outcomes .invest i {
    background: var(--color-chart-investments);
  }

  .strategy-outcomes .debt i {
    background: var(--color-chart-lifestyle);
  }

  .strategy-outcomes strong {
    color: var(--color-ink);
    font-size: 0.74rem;
    font-weight: 750;
    line-height: 1.15;
    text-align: right;
  }

  .empty-icon {
    display: grid;
    place-items: center;
    width: 3.5rem;
    height: 3.5rem;
    margin-bottom: 0.75rem;
    border-radius: 50%;
    background: var(--color-blue-soft);
    color: var(--color-primary);
    font-size: 1.6rem;
  }

  .plan-empty p {
    max-width: 22rem;
    margin: 0.4rem 0 0;
    color: var(--color-copy);
    font-size: 0.85rem;
  }

  .plan-action {
    display: inline-flex;
    align-items: center;
    align-self: flex-end;
    flex: 0 0 auto;
    gap: 0.35rem;
    margin-top: 0.75rem;
    color: var(--color-primary);
    font-size: 0.85rem;
    font-weight: 700;
    text-decoration: none;
  }

  .plan-action:hover {
    text-decoration: underline;
  }

  .plan-action:focus-visible {
    border-radius: 0.2rem;
    outline: 2px solid var(--color-primary);
    outline-offset: 3px;
  }

  @media (min-width: 1024px) {
    height: 100%;
    padding-bottom: 0.75rem;

    .card-header {
      margin-bottom: 0;
    }

    .card-heading {
      gap: 0.65rem;
    }

    .card-heading p {
      display: none;
    }

    .card-icon {
      width: 2.5rem;
      height: 2.5rem;
      flex-basis: 2.5rem;
      font-size: 1.15rem;
    }

    .plan-result,
    .plan-empty {
      min-height: 0;
    }

    .strategy-plan-result {
      flex: 0 0 auto;
      padding-top: 0;
      padding-bottom: 0.25rem;
    }

    .strategy-context {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.1rem;
      text-align: center;
      transform: none;
    }

    .strategy-summary {
      flex-direction: column;
      align-items: center;
      gap: 0.05rem;
    }

    .strategy-context .result-label {
      font-size: 0.75rem;
    }

    .strategy-summary strong {
      font-size: 1.45rem;
      line-height: 1.05;
      letter-spacing: -0.035em;
    }

    .strategy-summary span {
      font-size: 0.78rem;
    }

    .strategy-name,
    .result-value {
      margin-top: 0.2rem;
      font-size: clamp(1.45rem, 2.6vw, 2.1rem);
    }

    .strategy-name {
      font-size: clamp(1.35rem, 2.1vw, 1.75rem);
    }

    .primary-result {
      margin-top: 0.2rem;
      font-size: 0.78rem;
    }

    .strategy-outcomes {
      gap: 0.28rem;
      margin-top: 0.65rem;
    }

    .strategy-outcomes li {
      min-height: 1.7rem;
      padding: 0.22rem 0.4rem;
      font-size: 0.68rem;
    }

    .strategy-outcomes strong {
      font-size: 0.7rem;
    }

    .secondary-result {
      font-size: 0.75rem;
    }

    .empty-icon {
      width: 2.75rem;
      height: 2.75rem;
      margin-bottom: 0.5rem;
      font-size: 1.25rem;
    }

    .plan-action {
      margin-top: auto;
      min-height: 1.25rem;
      padding-top: 0.45rem;
      font-size: 0.76rem;
    }
  }
}
</style>
