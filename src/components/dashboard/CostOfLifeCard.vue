<template>
  <DashboardCard
    class="cost-card"
    :title="t('dashboard.costOfLife.title')"
    :subtitle="t('dashboard.costOfLife.subtitle')"
    icon="account_balance_wallet"
    icon-tone="blue"
    @open="$emit('open')"
  >
    <template #default>
      <div class="period-switch" role="group" :aria-label="t('dashboard.costOfLife.period')">
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

        <div class="operator" aria-hidden="true">−</div>

        <button type="button" class="equation-card costs" @click="emit('open')">
          <div class="equation-icon"><q-icon name="credit_card" /></div>
          <strong>{{ formatCurrency(values.cost) }}</strong>
          <span>{{ t('dashboard.costOfLife.lifeCosts') }}</span>
          <small>{{ periodLabel }}</small>
        </button>

        <div class="operator equals" aria-hidden="true">=</div>

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
import { useI18n } from 'vue-i18n'
import DashboardCard from './DashboardCard.vue'
import { formatCurrency } from '@/utils/formatters'

const props = defineProps({ data: { type: Object, required: true } })
const emit = defineEmits(['open', 'open-income'])
const { t } = useI18n()
const period = ref('annual')

const values = computed(() => {
  if (period.value === 'monthly') {
    return {
      income: props.data.income / 12,
      cost: props.data.monthlyCost,
      savingsCapacity: props.data.savingsCapacity / 12,
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
    position: absolute;
    top: 1.4rem;
    right: 4.7rem;
    display: flex;
    padding: 0.22rem;
    border: 1px solid var(--color-line);
    border-radius: 999px;
    background: #f3f6f9;
  }

  .period-switch button {
    min-width: 5.4rem;
    padding: 0.45rem 0.8rem;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--color-copy);
    font-size: 0.8rem;
    font-weight: 650;
    cursor: pointer;
  }

  .period-switch button.selected {
    background: var(--color-surface);
    color: var(--color-ink);
    box-shadow: 0 2px 10px rgb(24 43 68 / 8%);
  }

  .period-switch button:focus-visible {
    @include focus-ring;
  }

  .cost-equation {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;
    gap: clamp(0.8rem, 2.5vw, 2rem);
  }

  .equation-card {
    display: grid;
    justify-items: center;
    min-width: 0;
    min-height: 11.5rem;
    padding: 1.25rem;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    color: var(--color-ink);
    text-align: center;
  }

  button.equation-card {
    cursor: pointer;
  }

  button.equation-card:hover {
    border-color: rgb(82 105 135 / 18%);
  }

  button.equation-card:focus-visible {
    @include focus-ring;
  }

  .equation-card.income {
    background: linear-gradient(145deg, #eefbf6, #e5f8f0);
  }

  .equation-card.costs {
    background: linear-gradient(145deg, #fff4f4, #ffeded);
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
    color: #f15e64;
  }

  .available .equation-icon {
    background: #dcecff;
    color: var(--color-primary);
  }

  .equation-card strong {
    overflow: hidden;
    max-width: 100%;
    font-size: clamp(1.7rem, 3vw, 2.45rem);
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

  .operator {
    color: var(--color-copy);
    font-size: 2rem;
    font-weight: 550;
  }

  .operator.equals {
    color: var(--color-primary);
  }

  @media (max-width: 850px) {
    .period-switch {
      position: static;
      width: fit-content;
      margin: -0.25rem 0 1rem auto;
    }

    .cost-equation {
      grid-template-columns: 1fr;
      gap: 0.65rem;
    }

    .operator {
      height: 1rem;
      line-height: 0.35;
    }

    .equation-card {
      min-height: 10.5rem;
    }
  }

  @media (max-width: 599px) {
    .period-switch {
      width: 100%;
    }

    .period-switch button {
      flex: 1;
    }
  }
}
</style>
