<template>
  <q-card class="strategy-card">
    <q-form @submit.prevent="submit">
      <q-card-section class="dialog-header">
        <div>
          <h2>{{ t('whatIf.strategy.title') }}</h2>
          <p>{{ t('whatIf.strategy.description') }}</p>
        </div>
        <q-btn
          flat
          round
          dense
          icon="close"
          :aria-label="t('common.cancel')"
          @click="$emit('cancel')"
        />
      </q-card-section>
      <q-card-section class="dialog-body">
        <div class="allocation-grid">
          <div v-if="cashAvailable" class="allocation-field">
            <label>{{ t('whatIf.cash.title') }}</label>
            <q-input
              v-model.number="allocation.cash"
              outlined
              :dense="$q.screen.lt.sm"
              type="number"
              min="0"
              max="100"
              suffix="%"
            />
          </div>
          <div class="allocation-field">
            <label>{{ t('whatIf.invest.title') }}</label>
            <q-input
              v-model.number="allocation.invest"
              outlined
              :dense="$q.screen.lt.sm"
              type="number"
              min="0"
              max="100"
              suffix="%"
            />
          </div>
          <div v-if="debtAvailable" class="allocation-field">
            <label>{{ t('whatIf.debt.title') }}</label>
            <q-input
              v-model.number="allocation.debt"
              outlined
              :dense="$q.screen.lt.sm"
              type="number"
              min="0"
              max="100"
              suffix="%"
            />
          </div>
        </div>
        <div class="allocation-total" :class="{ invalid: !valid }">
          <span>{{ t('whatIf.strategy.total') }}</span
          ><strong>{{ total }}%</strong>
        </div>

        <section class="combined-results">
          <h3>{{ t('whatIf.strategy.combinedResults') }}</h3>
          <div v-if="cashAvailable" class="result-line">
            <span>{{ t('whatIf.cash.title') }}</span>
            <strong>{{ formatCurrency(cashMonthly) }}{{ t('whatIf.perMonth') }}</strong>
            <small v-if="cashResult?.simulatedMonths != null">{{
              t('whatIf.cash.reachIn', {
                months: cashResult.simulatedMonths,
                target: cashResult.targetMonths,
              })
            }}</small>
          </div>
          <div class="result-line">
            <span>{{ t('whatIf.invest.title') }}</span>
            <strong>{{ formatCurrency(investMonthly) }}{{ t('whatIf.perMonth') }}</strong>
            <small>{{
              t('whatIf.invest.valueInYears', {
                years: 20,
                value: formatCurrency(investment20.projectedValue),
              })
            }}</small>
          </div>
          <div v-if="debtAvailable" class="result-line">
            <span>{{ t('whatIf.debt.title') }}</span>
            <strong>{{ formatCurrency(debtResult.monthly) }}{{ t('whatIf.perMonth') }}</strong>
            <small>{{
              t('whatIf.debt.perYear', { amount: formatCurrency(debtResult.annual) })
            }}</small>
          </div>
        </section>
      </q-card-section>
      <q-card-actions class="dialog-actions">
        <q-btn outline no-caps :label="t('common.cancel')" @click="$emit('cancel')" />
        <q-btn
          unelevated
          no-caps
          color="primary"
          type="submit"
          :disable="!valid"
          :label="t('common.save')"
        />
      </q-card-actions>
    </q-form>
  </q-card>
</template>

<script setup>
import { computed, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  calculateCashScenario,
  calculateDebtScenario,
  calculateInvestmentScenario,
  normalizeStrategy,
  normalizeStrategyForOptions,
} from '@/domain/financial/what-if'
import { formatCurrency } from '@/utils/formatters'

const props = defineProps({
  strategy: { type: Object, required: true },
  simulatedSavingsCapacity: { type: Number, required: true },
  cash: { type: Number, default: 0 },
  currentMonthlyCost: { type: Number, required: true },
  simulatedMonthlyCost: { type: Number, required: true },
  expectedAnnualReturnPercent: { type: Number, required: true },
  cashAvailable: Boolean,
  debtAvailable: Boolean,
})
const emit = defineEmits(['save', 'cancel'])
const { t } = useI18n()
const allocation = reactive({ cash: 0, invest: 100, debt: 0 })

watch(
  () => [props.strategy, props.cashAvailable, props.debtAvailable],
  () =>
    Object.assign(
      allocation,
      normalizeStrategyForOptions(props.strategy, {
        cash: props.cashAvailable,
        debt: props.debtAvailable,
      }),
    ),
  { immediate: true, deep: true },
)

const total = computed(() =>
  ['cash', 'invest', 'debt'].reduce((sum, key) => sum + (Number(allocation[key]) || 0), 0),
)
const valid = computed(() => Boolean(normalizeStrategy(allocation)))
const cashMonthly = computed(
  () => (props.simulatedSavingsCapacity * Number(allocation.cash || 0)) / 100,
)
const investMonthly = computed(
  () => (props.simulatedSavingsCapacity * Number(allocation.invest || 0)) / 100,
)
const debtMonthly = computed(
  () => (props.simulatedSavingsCapacity * Number(allocation.debt || 0)) / 100,
)
const cashResult = computed(() =>
  calculateCashScenario({
    cash: props.cash,
    currentMonthlyCost: props.currentMonthlyCost,
    simulatedMonthlyCost: props.simulatedMonthlyCost,
    simulatedMonthlySavings: cashMonthly.value,
  }),
)
const investment20 = computed(() =>
  calculateInvestmentScenario({
    monthlyContribution: investMonthly.value,
    annualReturnPercent: props.expectedAnnualReturnPercent,
  }).find(({ years }) => years === 20),
)
const debtResult = computed(() => calculateDebtScenario(debtMonthly.value))

function submit() {
  const strategy = normalizeStrategy(allocation)
  if (strategy) emit('save', strategy)
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;
.strategy-card {
  @include financial-dialog-card(44rem);
}
.dialog-header {
  @include financial-dialog-header;
}
.dialog-header p {
  margin: 0.25rem 0 0;
  color: var(--color-copy);
}
.dialog-body {
  @include financial-dialog-body;
}
.allocation-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}
.allocation-field label {
  display: block;
  margin-bottom: 0.35rem;
  font-weight: 700;
}
.allocation-total {
  display: flex;
  justify-content: space-between;
  margin-top: 0.75rem;
  padding: 0.65rem 0.8rem;
  border-radius: var(--radius-button);
  background: var(--color-green-soft);
  color: var(--color-success-dark);
}
.allocation-total.invalid {
  background: var(--color-red-soft);
  color: var(--color-danger);
}
.combined-results {
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-line);
}
.combined-results h3 {
  margin: 0 0 0.75rem;
}
.result-line {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.15rem 1rem;
  padding: 0.65rem 0;
  border-bottom: 1px solid var(--color-line);
}
.result-line small {
  grid-column: 1 / -1;
  color: var(--color-copy);
}
.dialog-actions {
  @include financial-dialog-actions;
}
@media (max-width: 560px) {
  .allocation-grid {
    grid-template-columns: 1fr;
  }
}
</style>
