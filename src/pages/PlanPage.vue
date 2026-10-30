<template>
  <q-page class="plan-page">
    <main class="plan-shell">
      <div v-if="loading" class="state">
        <q-spinner color="primary" size="2rem" />
        <span>{{ t('plan.loading') }}</span>
      </div>
      <section v-else-if="error" class="state">
        <q-icon name="cloud_off" size="2rem" />
        <p>{{ t('plan.error') }}</p>
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon="refresh"
          :label="t('common.retry')"
          @click="load(true)"
        />
      </section>

      <template v-else>
        <header class="page-header">
          <div>
            <q-btn
              flat
              dense
              no-caps
              color="grey-7"
              icon="arrow_back"
              :label="t('navigation.backToWorkspaceHome')"
              :to="homeRoute"
              class="back-button"
            />
            <div class="title-row">
              <h1>{{ t('plan.title') }}</h1>
              <q-btn
                flat
                round
                dense
                icon="info_outline"
                color="grey-7"
                :aria-label="t('plan.info.action')"
                @click="infoOpen = true"
              />
            </div>
            <p>{{ t('plan.subtitle') }}</p>
          </div>
        </header>

        <section class="capacity-card" :class="{ negative: annualSavings < 0 }">
          <div class="capacity-main">
            <div class="capacity-heading">
              <span>{{
                annualSavings >= 0 ? t('plan.savingsCapacity') : t('plan.shortfall')
              }}</span>
              <div class="period-switch" role="group" :aria-label="t('plan.periodSelector')">
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
            </div>
            <strong
              >{{ formatCurrency(displayedSavings) }}<small>{{ displayedPeriod }}</small></strong
            >
            <b>{{ formatCurrency(alternateSavings) }} {{ alternatePeriod }}</b>
            <p>{{ t('plan.capacityDescription') }}</p>
          </div>
          <div class="capacity-breakdown">
            <div>
              <span>{{ t('plan.availableIncome') }}</span
              ><strong>{{ formatCurrency(displayedIncome) }}</strong>
            </div>
            <div>
              <span>{{ t('plan.costOfLife') }}</span
              ><strong>−{{ formatCurrency(displayedCostOfLife) }}</strong>
            </div>
            <div class="available-total">
              <span>{{
                annualSavings >= 0 ? t('plan.availableToPlan') : t('plan.shortfall')
              }}</span>
              <strong>{{ formatCurrency(displayedSavings) }}</strong>
            </div>
          </div>
        </section>

        <h2 class="section-label">{{ t('plan.actionsTitle') }}</h2>
        <section class="plan-actions">
          <router-link :to="{ name: 'what-if', params: { workspaceId } }" class="plan-action">
            <div class="action-heading">
              <span class="action-icon"><q-icon name="tune" /></span>
              <span
                ><strong>{{ t('plan.whatIf.title') }}</strong
                ><small>{{ t('plan.whatIf.tagline') }}</small></span
              >
            </div>
            <div class="action-body">
              <div class="action-copy">
                <p>{{ t('plan.whatIf.description') }}</p>
                <div class="action-result">
                  <span>{{ t('whatIf.result.label') }}</span>
                  <strong
                    >{{ formatCurrency(simulation.simulatedSavingsCapacity)
                    }}<small>{{ t('whatIf.perMonth') }}</small></strong
                  >
                  <small v-if="simulation.extraSavings > 0" class="positive-result">
                    {{
                      t('whatIf.result.extra', {
                        amount: formatCurrency(simulation.extraSavings),
                      })
                    }}
                  </small>
                </div>
                <ul class="allocation-summary" :aria-label="t('plan.outcomes.label')">
                  <li v-for="item in whatIfOutcomes" :key="item.id" :class="item.id">
                    <span><i aria-hidden="true" />{{ item.label }}</span>
                    <strong>{{ item.result }}</strong>
                  </li>
                </ul>
              </div>
              <svg class="scenario-graphic" viewBox="0 0 300 110" aria-hidden="true">
                <path d="M8 94 C95 94 166 86 292 35" class="line muted" />
                <path d="M8 94 C115 94 205 79 292 13" class="line dashed" />
                <path d="M8 94 C115 94 206 86 292 61" class="line primary" />
                <circle cx="292" cy="61" r="5" />
                <circle cx="292" cy="13" r="4" />
              </svg>
            </div>
            <b>{{ t('plan.whatIf.action') }} <q-icon name="arrow_forward" /></b>
          </router-link>

          <router-link
            :to="{ name: 'what-if-strategy', params: { workspaceId } }"
            class="plan-action strategy"
          >
            <div class="action-heading">
              <span class="action-icon"><q-icon name="route" /></span>
              <span
                ><strong>{{ t('plan.strategy.title') }}</strong
                ><small>{{ t('plan.strategy.tagline') }}</small></span
              >
            </div>
            <div class="action-body">
              <div class="action-copy">
                <p>{{ t('plan.strategy.description') }}</p>
                <div class="action-result strategy-result">
                  <span>{{ activeScenario.name }}</span>
                  <strong
                    >{{ formatCurrency(strategyMonthlyAmount)
                    }}<small>{{ t('whatIf.perMonth') }}</small></strong
                  >
                </div>
                <ul class="allocation-summary" :aria-label="t('plan.outcomes.label')">
                  <li v-for="item in strategyOutcomes" :key="item.id" :class="item.id">
                    <span><i aria-hidden="true" />{{ item.label }}</span>
                    <strong>{{ item.result }}</strong>
                  </li>
                </ul>
              </div>
              <span class="strategy-preview" :style="donutStyle" aria-hidden="true"></span>
            </div>
            <b>{{ t('plan.strategy.action') }} <q-icon name="arrow_forward" /></b>
          </router-link>
        </section>
      </template>
    </main>

    <q-dialog v-model="infoOpen" :position="$q.screen.lt.sm ? 'bottom' : undefined">
      <q-card class="info-dialog responsive-info-card">
        <span class="info-sheet-handle" aria-hidden="true" />
        <q-btn flat round dense icon="close" class="dialog-close" v-close-popup />
        <q-card-section>
          <h2>{{ t('plan.info.title') }}</h2>
          <p>{{ t('plan.info.description') }}</p>
          <p>{{ t('plan.info.strategy') }}</p>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { getLiabilityCategory } from '@/config/liability-categories'
import { calculateDebtPayoffImpact, highestInterestModeledDebt } from '@/domain/financial/debt-payoff'
import {
  currentFinancialMonth,
  currentFinancialYear,
  financialYearAvailableIncomeValue,
  financialYearExpenseNecessityValue,
  financialYearValue,
} from '@/domain/financial/financial-year'
import {
  latestPositionMonth,
  simulateStrategy,
  strategyStartingPosition,
} from '@/domain/financial/strategy-simulation'
import { calculateWhatIf, normalizeStrategyForOptions } from '@/domain/financial/what-if'
import { calculateCashScenario, calculateInvestmentScenario } from '@/domain/financial/what-if'
import { authUser } from '@/services/auth'
import { useFinancialScopeStore } from '@/stores/financial-scope-store'
import { useFinancialYearsStore } from '@/stores/financial-years-store'
import { useLiabilitiesStore } from '@/stores/liabilities-store'
import { useWhatIfStore } from '@/stores/what-if-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { formatCurrency } from '@/utils/formatters'
import { getWorkspaceMembers } from '@/utils/workspace-members'

const { t } = useI18n()
const route = useRoute()
const financialYearsStore = useFinancialYearsStore()
const liabilitiesStore = useLiabilitiesStore()
const whatIfStore = useWhatIfStore()
const scopeStore = useFinancialScopeStore()
const workspaceStore = useWorkspaceStore()
const currentYear = currentFinancialYear()
const period = ref('monthly')
const infoOpen = ref(false)
const pageError = ref(null)

const workspaceId = computed(() => String(route.params.workspaceId))
const workspace = computed(
  () => workspaceStore.workspaces.find(({ id }) => id === workspaceId.value) || null,
)
const members = computed(() => getWorkspaceMembers(workspace.value, authUser.value))
const memberIds = computed(() => members.value.map(({ id }) => id))
const selectedMemberId = computed({
  get: () => scopeStore.get(workspaceId.value, memberIds.value, authUser.value?.uid),
  set: (memberId) => scopeStore.select(workspaceId.value, memberId),
})
const financialYear = computed(() => financialYearsStore.get(workspaceId.value, currentYear))
const loading = computed(
  () =>
    financialYearsStore.loading ||
    whatIfStore.loading ||
    liabilitiesStore.loading ||
    liabilitiesStore.categoryLoading,
)
const error = computed(
  () =>
    pageError.value ||
    whatIfStore.error ||
    liabilitiesStore.error ||
    financialYearsStore.errorFor(workspaceId.value, currentYear),
)
const annualIncome = computed(() =>
  financialYearAvailableIncomeValue(financialYear.value, selectedMemberId.value),
)
const annualCostOfLife = computed(() =>
  financialYearValue(financialYear.value, 'expenses', selectedMemberId.value),
)
const annualSavings = computed(() => annualIncome.value - annualCostOfLife.value)
const monthlySavings = computed(() => annualSavings.value / 12)
const displayedIncome = computed(() =>
  period.value === 'annual' ? annualIncome.value : annualIncome.value / 12,
)
const displayedCostOfLife = computed(() =>
  period.value === 'annual' ? annualCostOfLife.value : annualCostOfLife.value / 12,
)
const displayedSavings = computed(() =>
  period.value === 'annual' ? annualSavings.value : monthlySavings.value,
)
const displayedPeriod = computed(() =>
  period.value === 'annual' ? t('plan.perYear') : t('whatIf.perMonth'),
)
const alternateSavings = computed(() =>
  period.value === 'annual' ? monthlySavings.value : annualSavings.value,
)
const alternatePeriod = computed(() =>
  period.value === 'annual' ? t('whatIf.perMonth') : t('plan.perYear'),
)
const activeScenario = computed(
  () =>
    whatIfStore.config.scenarios.find(({ id }) => id === whatIfStore.config.activeScenarioId) ||
    whatIfStore.config.scenarios[0],
)
const positionMonth = computed(() => latestPositionMonth(financialYear.value, currentFinancialMonth()))
const startingPosition = computed(() =>
  strategyStartingPosition(financialYear.value, positionMonth.value, selectedMemberId.value),
)
const liabilities = computed(() =>
  extractLiabilities(financialYear.value, positionMonth.value, selectedMemberId.value),
)
const selectedDebt = computed(
  () =>
    liabilities.value.find(({ id }) => id === activeScenario.value.selectedLiabilityId) ||
    liabilities.value.find(({ categoryId }) => categoryId === 'mortgage') ||
    liabilities.value[0] ||
    null,
)
const modeledDebts = computed(() => {
  const mortgageModels = new Map(
    liabilitiesStore.itemsForCategory('mortgage').map((liability) => [liability.id, liability]),
  )
  return liabilities.value.flatMap((liability) => {
    const model = mortgageModels.get(liability.id)
    return model ? [{ ...model, name: liability.name }] : []
  })
})
const selectedDebtModel = computed(() => {
  if (!selectedDebt.value) return null
  return modeledDebts.value.find(({ id }) => id === selectedDebt.value.id) || selectedDebt.value
})
const whatIfDebtModel = computed(
  () => highestInterestModeledDebt(modeledDebts.value) || selectedDebtModel.value,
)
const debtAvailable = computed(() => Boolean(selectedDebt.value))
const allocation = computed(() =>
  normalizeStrategyForOptions(activeScenario.value.allocation, {
    cash: true,
    debt: debtAvailable.value,
  }),
)
const simulation = computed(() =>
  calculateWhatIf({
    availableIncome: annualIncome.value,
    costOfLife: annualCostOfLife.value,
    discretionary: financialYearExpenseNecessityValue(
      financialYear.value,
      'lifestyle',
      selectedMemberId.value,
    ),
    reductionPercent: whatIfStore.config.discretionaryReductionPercent,
  }),
)
const strategyMonthlyAmount = computed(() => Math.max(0, simulation.value.simulatedSavingsCapacity))
const projection = computed(() =>
  simulateStrategy({
    startingPosition: startingPosition.value,
    scenario: { ...activeScenario.value, allocation: allocation.value },
    simulatedMonthlySavings: strategyMonthlyAmount.value,
    simulatedMonthlyCost: simulation.value.simulatedCostOfLife,
    debtAvailable: debtAvailable.value,
  }),
)
const cashScenario = computed(() =>
  calculateCashScenario({
    cash: startingPosition.value.cash,
    currentMonthlyCost: simulation.value.monthlyCostOfLife,
    simulatedMonthlyCost: simulation.value.simulatedCostOfLife,
    currentMonthlySavings: simulation.value.currentSavingsCapacity,
    simulatedMonthlySavings: strategyMonthlyAmount.value,
  }),
)
const featuredInvestment = computed(
  () =>
    calculateInvestmentScenario({
      monthlyContribution: strategyMonthlyAmount.value,
      currentMonthlyContribution: simulation.value.currentSavingsCapacity,
      annualReturnPercent: activeScenario.value.investmentMix.stockMarket?.annualReturnPercent || 7,
    }).find(({ years }) => years === 20),
)
const whatIfDebtPayoff = computed(() =>
  calculateDebtPayoffImpact({
    liability: whatIfDebtModel.value,
    extraMonthlyPayment: strategyMonthlyAmount.value,
    asOfDate: localToday(),
  }),
)
const strategyDebtPayoff = computed(() =>
  calculateDebtPayoffImpact({
    liability: selectedDebtModel.value,
    extraMonthlyPayment: monthlyFor(allocation.value.debt),
    asOfDate: localToday(),
  }),
)
const whatIfOutcomes = computed(() => [
  {
    id: 'cash',
    label: t('whatIf.cash.title'),
    result: cashOutcome(cashScenario.value),
  },
  {
    id: 'invest',
    label: t('whatIf.invest.title'),
    result: featuredInvestment.value
      ? t('plan.outcomes.inYears', {
          amount: formatCurrency(featuredInvestment.value.projectedValue),
          years: featuredInvestment.value.years,
        })
      : '—',
  },
  {
    id: 'debt',
    label: t('whatIf.debt.title'),
    result: debtOutcome(
      whatIfDebtPayoff.value,
      Boolean(whatIfDebtModel.value),
      whatIfDebtModel.value?.name,
    ),
  },
])
const strategyOutcomes = computed(() => [
  {
    id: 'cash',
    label: t('whatIf.cash.title'),
    result: strategyCashOutcome(),
  },
  {
    id: 'invest',
    label: t('whatIf.invest.title'),
    result: t('plan.outcomes.inYears', {
      amount: formatCurrency(projection.value.strategy.investmentValue),
      years: activeScenario.value.horizonYears,
    }),
  },
  {
    id: 'debt',
    label: t('whatIf.debt.title'),
    result:
      allocation.value.debt > 0
        ? debtOutcome(strategyDebtPayoff.value, debtAvailable.value, selectedDebt.value?.name)
        : t('plan.outcomes.notIncluded'),
  },
])
const donutStyle = computed(() => {
  const cashEnd = allocation.value.cash
  const investEnd = cashEnd + allocation.value.invest
  return {
    background: `conic-gradient(var(--color-chart-cash) 0 ${cashEnd}%, var(--color-chart-investments) ${cashEnd}% ${investEnd}%, var(--color-chart-lifestyle) ${investEnd}% 100%)`,
  }
})
const homeRoute = computed(() => ({
  name: 'workspace-dashboard',
  params: { workspaceId: workspaceId.value },
}))

watch(workspaceId, () => load(), { immediate: true })

async function load(force = false) {
  pageError.value = null
  try {
    await Promise.all([
      financialYearsStore.load(workspaceId.value, currentYear, force),
      whatIfStore.load(workspaceId.value, force),
      liabilitiesStore.loadCategory(workspaceId.value, 'mortgage', force),
    ])
  } catch (loadError) {
    pageError.value = loadError
  }
}

function monthlyFor(percent) {
  return (strategyMonthlyAmount.value * percent) / 100
}

function cashOutcome(scenario) {
  if (!scenario) return '—'
  if (scenario.achieved)
    return t('plan.outcomes.fundReady', { amount: formatCurrency(scenario.simulatedTarget) })
  if (scenario.simulatedMonths != null)
    return t('plan.outcomes.fundInMonths', {
      amount: formatCurrency(scenario.simulatedTarget),
      months: scenario.simulatedMonths,
    })
  return t('plan.outcomes.fundTarget', { amount: formatCurrency(scenario.simulatedTarget) })
}

function strategyCashOutcome() {
  const strategy = projection.value.strategy
  if (allocation.value.cash <= 0) return t('plan.outcomes.notIncluded')
  if (strategy.cashTargetMonth === 0)
    return t('plan.outcomes.fundReady', { amount: formatCurrency(strategy.cashTarget) })
  if (strategy.cashTargetMonth != null)
    return t('plan.outcomes.fundInMonths', {
      amount: formatCurrency(strategy.cashTarget),
      months: strategy.cashTargetMonth,
    })
  return t('plan.outcomes.fundTarget', { amount: formatCurrency(strategy.cashTarget) })
}

function debtOutcome(payoff, hasDebt, debtName) {
  if (!hasDebt) return t('plan.outcomes.noDebt')
  if (!payoff?.accelerated?.payoffDate) return t('plan.outcomes.modelUnavailable')
  return t('plan.outcomes.paidOffNamed', {
    name: debtName || t('whatIf.debt.title'),
    date: formatMonthYear(payoff.accelerated.payoffDate),
  })
}

function localToday() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`
}

function formatMonthYear(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-IE', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

function extractLiabilities(document, month, memberId) {
  const categories = document?.months?.[month]?.liabilities?.categories || {}
  return Object.entries(categories)
    .flatMap(([categoryId, category]) =>
      Object.entries(category.subcategories || {}).flatMap(([subcategoryId, subcategory]) => {
        const items = Object.entries(subcategory.items || {})
        if (!items.length)
          return [
            {
              id: subcategoryId,
              categoryId,
              name: t(getLiabilityCategory(categoryId)?.nameKey || 'whatIf.debt.title'),
              balance: scopedValue(subcategory, memberId),
            },
          ]
        return items.map(([id, item]) => ({
          id,
          categoryId,
          name: t(getLiabilityCategory(categoryId)?.nameKey || 'whatIf.debt.title'),
          balance: scopedValue(item, memberId),
        }))
      }),
    )
    .filter(({ balance }) => balance > 0)
    .sort((left, right) => right.balance - left.balance)
}

function scopedValue(item, memberId) {
  if (memberId !== 'all') return Number(item?.memberValues?.[memberId] || 0)
  return Number(item?.total || 0)
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;

.plan-page {
  @include financial-page;
}
.plan-shell {
  @include financial-shell;
}
.page-header {
  @include financial-header;
}
.back-button {
  @include financial-back-button;
}
.title-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}
h1 {
  @include financial-title;
}
.page-header p,
.state {
  color: var(--color-copy);
}
.page-header p {
  margin: 0.45rem 0 0;
  font-size: 1rem;
}
.capacity-card {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(19rem, 0.9fr);
  gap: 2.5rem;
  margin-top: 1.1rem;
  padding: clamp(1.5rem, 4vw, 2.5rem);
  border-radius: var(--radius-card);
  background: var(--color-ink);
  color: white;
}
.period-switch {
  @include financial-period-switch;
  position: absolute;
  top: 0.85rem;
  right: 1rem;
}
.capacity-main {
  display: grid;
  align-content: center;
  gap: 0.35rem;
}
.capacity-heading > span {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  opacity: 0.8;
  text-transform: uppercase;
}
.capacity-main > strong {
  font-size: clamp(2.8rem, 7vw, 4.8rem);
  line-height: 1;
  letter-spacing: -0.055em;
}
.capacity-main > strong small {
  margin-left: 0.45rem;
  font-size: 1rem;
  font-weight: 500;
  letter-spacing: 0;
}
.capacity-main b {
  font-size: 1rem;
}
.capacity-main p {
  margin: 0.3rem 0 0;
  opacity: 0.7;
}
.capacity-card.negative .capacity-main > strong,
.capacity-card.negative .available-total strong {
  color: var(--color-danger-on-dark);
}
.capacity-breakdown {
  display: grid;
  align-content: center;
  gap: 0.8rem;
  padding: 2.1rem 0 0 2.5rem;
  border-left: 1px solid var(--color-inverse-line);
}
.capacity-breakdown > div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}
.capacity-breakdown span {
  opacity: 0.78;
}
.capacity-breakdown .available-total {
  margin-top: 0.25rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-inverse-line);
}

.section-label {
  margin: 1.25rem 0 0.4rem 0.25rem;
  color: var(--color-copy);
  font-size: 0.83rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.plan-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}
.plan-action {
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 1rem;
  min-height: 17rem;
  padding: 1.5rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  color: var(--color-ink);
  text-decoration: none;
  box-shadow: var(--shadow-card);
  transition:
    border-color 160ms ease,
    transform 160ms ease;
}
.plan-action:hover {
  border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-line));
  transform: translateY(-2px);
}
.action-heading {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.action-heading > span:last-child {
  display: grid;
}
.action-heading strong {
  font-size: 1.6rem;
}
.action-heading small {
  color: var(--color-copy);
}
.action-icon {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--color-blue-soft);
  color: var(--color-primary);
}
.action-icon {
  width: 3.5rem;
  height: 3.5rem;
  font-size: 1.5rem;
}
.strategy .action-icon {
  background: var(--color-purple-soft);
  color: var(--color-purple);
}
.action-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(8rem, 0.65fr);
  align-items: center;
  gap: 1rem;
}
.action-body p {
  margin: 0;
  color: var(--color-copy);
  font-size: 0.95rem;
  line-height: 1.45;
}
.action-copy {
  display: grid;
  align-content: center;
  gap: 0.8rem;
}
.action-result {
  display: grid;
  gap: 0.15rem;
  padding-left: 0.8rem;
  border-left: 3px solid var(--color-primary);
}
.action-result > span {
  color: var(--color-copy);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.action-result > strong {
  color: var(--color-ink);
  font-size: clamp(1.45rem, 3vw, 2rem);
  line-height: 1.05;
  letter-spacing: -0.04em;
}
.action-result > strong small {
  margin-left: 0.2rem;
  color: var(--color-copy);
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0;
}
.action-result > small {
  color: var(--color-copy);
  font-size: 0.72rem;
}
.action-result .positive-result {
  color: var(--color-success-dark);
}
.allocation-summary {
  display: grid;
  gap: 0.32rem;
  margin: 0.35rem 0 0;
  padding: 0;
  list-style: none;
}
.allocation-summary li,
.allocation-summary li > span {
  display: flex;
  align-items: center;
}
.allocation-summary li {
  justify-content: space-between;
  gap: 0.65rem;
  color: var(--color-copy);
  font-size: 0.76rem;
}
.allocation-summary li > span {
  min-width: 0;
  gap: 0.42rem;
}
.allocation-summary i {
  width: 0.48rem;
  height: 0.48rem;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--color-chart-cash);
}
.allocation-summary .invest i {
  background: var(--color-chart-investments);
}
.allocation-summary .debt i {
  background: var(--color-chart-lifestyle);
}
.allocation-summary strong {
  color: var(--color-ink);
  font-size: 0.76rem;
  white-space: nowrap;
}
.strategy-result {
  border-left-color: var(--color-purple);
}
.plan-action > b {
  display: flex;
  align-items: center;
  justify-content: space-between;
  align-self: end;
  padding: 0.85rem 1rem;
  border-radius: 0.7rem;
  background: var(--color-blue-soft);
  color: var(--color-primary);
  font-size: 0.9rem;
}
.strategy > b {
  background: var(--color-purple-soft);
  color: var(--color-purple);
}
.scenario-graphic {
  width: 100%;
  overflow: visible;
  fill: var(--color-primary);
}
.scenario-graphic .line {
  fill: none;
  stroke-width: 2.5;
}
.scenario-graphic .muted {
  stroke: var(--color-line);
}
.scenario-graphic .primary,
.scenario-graphic .dashed {
  stroke: var(--color-primary);
}
.scenario-graphic .dashed {
  stroke-dasharray: 7 6;
}
.strategy-preview {
  position: relative;
  justify-self: center;
  width: 6.8rem;
  aspect-ratio: 1;
  border-radius: 50%;
}
.strategy-preview::after {
  position: absolute;
  inset: 1.35rem;
  border-radius: 50%;
  background: var(--color-surface);
  content: '';
}

.info-dialog {
  position: relative;
  width: min(34rem, calc(100vw - 2rem));
  padding: 1rem;
  border-radius: var(--radius-card);
}
.info-dialog h2 {
  margin: 0 2.5rem 0.75rem 0;
}
.info-dialog p {
  color: var(--color-copy);
  font-size: 1rem;
  line-height: 1.55;
}
.dialog-close {
  position: absolute;
  z-index: 1;
  top: 0.75rem;
  right: 0.75rem;
}
.state {
  display: grid;
  place-items: center;
  min-height: 20rem;
  gap: 0.75rem;
}

@media (min-width: 1024px) {
  .plan-page {
    height: calc(100vh - 64px);
    height: calc(100dvh - 64px);
    min-height: 0;
    padding: clamp(0.75rem, 1.8vh, 1.15rem) clamp(1rem, 2vw, 1.75rem);
    overflow: hidden;
  }

  .plan-shell {
    display: grid;
    grid-template-rows: auto auto auto auto;
    align-content: start;
    height: 100%;
  }

  .back-button {
    min-height: 1.5rem;
    margin-bottom: 0.1rem;
  }

  h1 {
    font-size: clamp(2rem, 3.5vh, 2.7rem);
  }

  .page-header p {
    margin-top: 0.2rem;
    font-size: 0.9rem;
  }

  .capacity-card {
    grid-template-columns: minmax(0, 1.15fr) minmax(17rem, 0.85fr);
    gap: clamp(1.25rem, 3vw, 2rem);
    min-height: 0;
    margin-top: clamp(0.5rem, 1.2vh, 0.75rem);
    padding: clamp(1rem, 2.2vh, 1.35rem) clamp(1.25rem, 2.5vw, 1.75rem);
  }

  .capacity-main {
    gap: 0.2rem;
  }

  .capacity-main > strong {
    font-size: clamp(2.6rem, 5.6vh, 3.8rem);
  }

  .capacity-main > strong small,
  .capacity-main b {
    font-size: 0.85rem;
  }

  .capacity-main p {
    margin-top: 0.15rem;
    font-size: 0.82rem;
  }

  .period-switch {
    top: 0.7rem;
    right: 0.8rem;
    padding: 0.15rem;
  }

  .period-switch button {
    min-width: 4.7rem;
    padding: 0.3rem 0.6rem;
    font-size: 0.72rem;
  }

  .capacity-breakdown {
    gap: 0.45rem;
    padding: 1.65rem 0 0 1.5rem;
    font-size: 0.85rem;
  }

  .capacity-breakdown .available-total {
    margin-top: 0.1rem;
    padding-top: 0.55rem;
  }

  .section-label {
    margin: clamp(0.5rem, 1.2vh, 0.75rem) 0 0.3rem 0.25rem;
    font-size: 0.74rem;
  }

  .plan-actions {
    height: clamp(18rem, 38vh, 21rem);
    min-height: 0;
    gap: clamp(0.65rem, 1.5vw, 0.9rem);
  }

  .plan-action {
    gap: clamp(0.4rem, 1vh, 0.7rem);
    height: 100%;
    min-height: 0;
    padding: clamp(0.85rem, 2vh, 1.15rem);
  }

  .action-heading {
    gap: 0.75rem;
  }

  .action-heading strong {
    font-size: clamp(1.2rem, 2.5vh, 1.45rem);
  }

  .action-icon {
    width: 2.8rem;
    height: 2.8rem;
    font-size: 1.25rem;
  }

  .action-body {
    grid-template-columns: minmax(0, 1fr) minmax(6rem, 0.5fr);
    gap: 0.75rem;
    min-height: 0;
  }

  .action-body p {
    font-size: 0.85rem;
  }

  .action-copy {
    gap: clamp(0.4rem, 0.8vh, 0.6rem);
  }

  .action-result > strong {
    font-size: clamp(1.35rem, 3.2vh, 1.8rem);
  }

  .scenario-graphic {
    max-height: clamp(4.5rem, 12vh, 7rem);
  }

  .strategy-preview {
    width: clamp(4.7rem, 10vh, 6rem);
  }

  .strategy-preview::after {
    inset: 1.05rem;
  }

  .plan-action > b {
    padding: 0.55rem 0.75rem;
    font-size: 0.82rem;
  }
}

@media (max-width: 850px) {
  .page-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 1rem;
  }
  .capacity-card {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  .capacity-breakdown {
    padding: 1.5rem 0 0;
    border-top: 1px solid var(--color-inverse-line);
    border-left: 0;
  }
  .plan-actions {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .capacity-card {
    gap: 1rem;
    margin-top: 0.85rem;
    padding: 1.1rem;
  }
  .capacity-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .period-switch {
    position: static;
    flex-shrink: 0;
    padding: 0.16rem;
  }
  .period-switch button {
    min-width: 0;
    padding: 0.32rem 0.58rem;
    font-size: 0.7rem;
  }
  .capacity-main {
    gap: 0.3rem;
  }
  .capacity-main > strong {
    margin-top: 0.45rem;
    font-size: clamp(2.25rem, 12vw, 3rem);
  }
  .capacity-main > strong small {
    margin-left: 0.35rem;
    font-size: 0.85rem;
  }
  .capacity-main b {
    font-size: 0.9rem;
  }
  .capacity-main p {
    margin-top: 0.25rem;
    font-size: 0.82rem;
    line-height: 1.4;
  }
  .capacity-breakdown {
    gap: 0.6rem;
    padding-top: 0.9rem;
    font-size: 0.82rem;
  }
  .capacity-breakdown .available-total {
    margin-top: 0.1rem;
    padding-top: 0.75rem;
  }
  .action-body {
    grid-template-columns: 1fr;
  }
  .scenario-graphic,
  .strategy-preview {
    display: none;
  }
}
</style>
