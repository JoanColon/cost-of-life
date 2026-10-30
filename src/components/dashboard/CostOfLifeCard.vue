<template>
  <DashboardCard
    class="cost-card"
    :title="t('dashboard.costOfLife.title')"
    :subtitle="t('dashboard.costOfLife.subtitle')"
    icon="account_balance_wallet"
    icon-tone="blue"
  >
    <template #action>
      <div
        class="period-switch desktop-period-switch"
        role="group"
        :aria-label="t('dashboard.costOfLife.period')"
      >
        <button
          type="button"
          :class="{ selected: period === 'annual' }"
          :aria-pressed="period === 'annual'"
          @click="period = 'annual'"
        >
          {{ t('dashboard.costOfLife.annual') }}
        </button>
        <button
          type="button"
          :class="{ selected: period === 'monthly' }"
          :aria-pressed="period === 'monthly'"
          @click="period = 'monthly'"
        >
          {{ t('dashboard.costOfLife.monthly') }}
        </button>
      </div>
    </template>

    <template #default>
      <div
        class="period-switch body-period-switch"
        role="group"
        :aria-label="t('dashboard.costOfLife.period')"
      >
        <button
          type="button"
          :class="{ selected: period === 'annual' }"
          :aria-pressed="period === 'annual'"
          @click="period = 'annual'"
        >
          {{ t('dashboard.costOfLife.annual') }}
        </button>
        <button
          type="button"
          :class="{ selected: period === 'monthly' }"
          :aria-pressed="period === 'monthly'"
          @click="period = 'monthly'"
        >
          {{ t('dashboard.costOfLife.monthly') }}
        </button>
      </div>

      <div class="cost-equation">
        <button type="button" class="equation-card income" @click="emit('open-income')">
          <div class="equation-icon"><q-icon name="payments" /></div>
          <strong>{{ formatCurrency(values.income) }}</strong>
          <span>{{ t('dashboard.costOfLife.income') }}</span>
          <small>{{ periodLabel }}</small>
        </button>

        <div
          class="equation-card costs"
          role="button"
          tabindex="0"
          @click="emit('open-expenses')"
          @keydown.enter.self="emit('open-expenses')"
          @keydown.space.self.prevent="emit('open-expenses')"
        >
          <div class="equation-icon"><q-icon name="credit_card" /></div>
          <strong>{{ formatCurrency(values.cost) }}</strong>
          <span>{{ t('dashboard.costOfLife.lifeCosts') }}</span>
          <small>{{ periodLabel }}</small>
        </div>

        <div class="equation-card available">
          <div class="equation-icon"><q-icon name="savings" /></div>
          <strong>{{ formatCurrency(values.savingsCapacity) }}</strong>
          <span>{{ t('dashboard.costOfLife.savingsCapacity') }}</span>
          <small>{{ periodLabel }}</small>
        </div>
      </div>
    </template>
  </DashboardCard>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import DashboardCard from './DashboardCard.vue'
import { formatCurrency } from '@/utils/formatters'

const props = defineProps({ data: { type: Object, required: true } })
const emit = defineEmits(['open-expenses', 'open-income'])
const { t } = useI18n()
const $q = useQuasar()
const period = ref($q.screen.lt.md ? 'monthly' : 'annual')

const values = computed(() => {
  if (period.value === 'monthly') {
    return {
      income: props.data.monthlyIncome,
      cost: props.data.monthlyCost,
      savingsCapacity: props.data.monthlySavingsCapacity,
    }
  }

  return {
    income: props.data.income,
    cost: props.data.annualCost,
    savingsCapacity: props.data.savingsCapacity,
  }
})

const periodLabel = computed(() =>
  period.value === 'annual'
    ? t('dashboard.costOfLife.perYear')
    : t('dashboard.costOfLife.perMonth'),
)
</script>

<style lang="scss">
@use '@/css/mixins' as *;

.cost-card {
  position: relative;

  .period-switch {
    position: static;
    display: flex;
    width: 100%;
    margin: -0.25rem 0 1rem;
    padding: 0.22rem;
    overflow: hidden;
    border: 1px solid var(--color-ink);
    border-radius: 999px !important;
    background: var(--color-ink);
  }

  .period-switch button {
    flex: 1;
    padding: 0.45rem 0.8rem;
    border: 0;
    border-radius: 999px !important;
    background: transparent;
    color: var(--color-inverse-muted);
    font-size: 0.8rem;
    font-weight: 650;
    cursor: pointer;
  }

  .period-switch button.selected {
    background: var(--color-surface);
    color: var(--color-ink);
    box-shadow: var(--shadow-control);
  }

  .period-switch button:focus-visible {
    @include focus-ring;
  }

  .desktop-period-switch {
    display: none;
  }

  .cost-equation {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-items: center;
    gap: 0.7rem;
  }

  .equation-card {
    display: grid;
    justify-items: center;
    min-width: 0;
    min-height: 9.75rem;
    padding: 1rem 0.65rem;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    color: var(--color-ink);
    text-align: center;
  }

  button.equation-card {
    cursor: pointer;
  }

  button.equation-card:hover {
    border-color: var(--color-ink-border);
  }

  button.equation-card:focus-visible {
    @include focus-ring;
  }

  .equation-card.income {
    background: linear-gradient(145deg, #eefbf6, #e5f8f0);
  }

  .equation-card.costs {
    position: relative;
    background: linear-gradient(145deg, #fff4f4, #ffeded);
    cursor: pointer;
  }

  .equation-card.costs:hover {
    border-color: var(--color-ink-border);
  }

  .equation-card.costs:focus-visible {
    @include focus-ring;
  }

  .equation-card.available {
    background: linear-gradient(145deg, #f2f8ff, #eaf4ff);
  }

  .equation-icon {
    display: grid;
    place-items: center;
    width: 3rem;
    height: 3rem;
    margin-bottom: 0.55rem;
    border-radius: 50%;
    font-size: 1.45rem;
  }

  .income .equation-icon {
    background: #d6f5e8;
    color: var(--color-success-dark);
  }

  .costs .equation-icon {
    background: #ffdfe0;
    color: var(--color-danger);
  }

  .available .equation-icon {
    background: #dcecff;
    color: var(--color-primary);
  }

  .equation-card strong {
    overflow: hidden;
    max-width: 100%;
    font-size: clamp(1.35rem, 2.35vw, 2.1rem);
    line-height: 1.05;
    letter-spacing: -0.045em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .equation-card span {
    margin-top: 0.35rem;
    color: var(--color-copy);
    font-size: 1rem;
  }

  .equation-card small {
    margin-top: 0.15rem;
    color: var(--color-muted);
    font-size: 0.75rem;
  }

  @media (min-width: 1024px) {
    display: flex;
    flex-direction: column;
    height: 100%;

    .desktop-period-switch {
      display: flex;
      width: auto;
      min-width: 11.5rem;
      margin: 0;
      padding: 0.16rem;
    }

    .body-period-switch {
      display: none;
    }

    .period-switch button {
      min-width: 5.5rem;
      padding: 0.32rem 0.65rem;
      font-size: 0.73rem;
    }

    .cost-equation {
      flex: 1;
      min-height: 0;
      gap: 0.55rem;
    }

    .equation-card {
      align-content: center;
      height: 100%;
      min-height: 0;
      padding: 0.6rem 0.45rem;
    }

    .equation-icon {
      width: 2.45rem;
      height: 2.45rem;
      margin-bottom: 0.35rem;
      font-size: 1.15rem;
    }

    .equation-card strong {
      font-size: clamp(1.2rem, 2vw, 1.75rem);
    }

    .equation-card span {
      margin-top: 0.25rem;
      font-size: 0.82rem;
    }

    .equation-card small {
      font-size: 0.68rem;
    }

  }

  @media (max-width: 599px) {
    .card-header {
      position: relative;
      align-items: flex-start;
      margin-bottom: 0.8rem;
    }

    .card-heading {
      gap: 0.55rem;
      padding-right: 6.8rem;
    }

    .card-action {
      position: absolute;
      top: 0.05rem;
      right: 0;
      display: flex;
      width: auto;
    }

    .desktop-period-switch {
      display: flex;
      width: 6.75rem;
      min-width: 0;
      margin: 0;
      padding: 0.1rem;
    }

    .body-period-switch {
      display: none;
    }

    .card-icon {
      flex-basis: 2.35rem;
      width: 2.35rem;
      height: 2.35rem;
    }

    .card-header h2 {
      font-size: 0.88rem;
      letter-spacing: -0.025em;
    }

    .card-header p {
      font-size: 0.68rem;
    }

    .period-switch button {
      flex: 1;
      min-height: 1.45rem;
      padding: 0.12rem 0.2rem;
      font-size: 0.58rem;
    }

    .equation-card {
      min-height: 7.2rem;
      padding: 0.65rem 0.25rem;
    }

    .equation-icon {
      width: 2.35rem;
      height: 2.35rem;
      margin-bottom: 0.3rem;
      font-size: 1.1rem;
    }

    .equation-card strong {
      font-size: clamp(1rem, 4.6vw, 1.35rem);
    }

    .equation-card span {
      margin-top: 0.25rem;
      font-size: 0.68rem;
      line-height: 1.1;
    }

    .equation-card small {
      margin-top: 0.25rem;
      font-size: 0.6rem;
    }
  }
}
</style>
