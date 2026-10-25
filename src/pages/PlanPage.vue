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
              <p>{{ t('plan.whatIf.description') }}</p>
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
              <p>{{ t('plan.strategy.description') }}</p>
              <span class="strategy-preview" :style="donutStyle" aria-hidden="true"></span>
            </div>
            <b>{{ t('plan.strategy.action') }} <q-icon name="arrow_forward" /></b>
          </router-link>
        </section>

        <h2 class="section-label current-plan-label">{{ t('plan.current.title') }}</h2>
        <section class="current-plan-card">
          <div class="current-plan-heading">
            <span class="current-icon"><q-icon name="route" /></span>
            <div>
              <small>{{
                hasSavedStrategy ? activeScenario.name : t('plan.current.suggested')
              }}</small>
              <strong>{{ allocationHeadline }}</strong>
              <p>
                {{
                  t('plan.current.monthlyAllocation', {
                    amount: formatCurrency(strategyMonthlyAmount),
                  })
                }}
              </p>
            </div>
            <q-btn
              flat
              no-caps
              color="primary"
              icon-right="arrow_forward"
              :label="hasSavedStrategy ? t('plan.current.view') : t('plan.strategy.action')"
              :to="{ name: 'what-if-strategy', params: { workspaceId } }"
            />
          </div>

          <div class="strategy-breakdown">
            <div class="allocation-summary">
              <div v-for="entry in allocationEntries" :key="entry.id" class="allocation-item">
                <span :class="['allocation-dot', entry.id]"></span>
                <div>
                  <span>{{ entry.label }}</span
                  ><strong>{{ entry.percent }}%</strong>
                </div>
                <div class="allocation-track">
                  <span :class="entry.id" :style="{ width: `${entry.percent}%` }"></span>
                </div>
              </div>
            </div>

            <div v-if="mixEntries.length && allocation.invest > 0" class="mix-summary">
              <span class="mix-title">{{ t('plan.current.investmentMix') }}</span>
              <div class="mix-grid">
                <div v-for="entry in mixEntries" :key="entry.id" class="mix-item">
                  <span class="mix-icon"><q-icon :name="entry.icon" /></span>
                  <div>
                    <span>{{ entry.label }}</span
                    ><strong>{{ entry.allocation }}%</strong>
                    <div class="mix-track">
                      <span :style="{ width: `${entry.allocation}%` }"></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="projection-summary">
            <div>
              <span class="projection-icon"><q-icon name="bar_chart" /></span>
              <span
                ><small>{{
                  t('plan.current.estimatedValue', { years: activeScenario.horizonYears })
                }}</small
                ><strong>{{ formatCurrency(projection.strategy.finalValue) }}</strong></span
              >
            </div>
            <div>
              <span class="projection-icon growth"><q-icon name="trending_up" /></span>
              <span
                ><small>{{ t('plan.current.estimatedGrowth') }}</small
                ><strong class="positive"
                  >+{{ formatCurrency(projection.strategy.growth) }}</strong
                ></span
              >
            </div>
          </div>
        </section>
      </template>
    </main>

    <q-dialog v-model="infoOpen">
      <q-card class="info-dialog">
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
import {
  calculateWhatIf,
  defaultStrategyScenario,
  normalizeStrategyForOptions,
} from '@/domain/financial/what-if'
import { authUser } from '@/services/auth'
import { useFinancialScopeStore } from '@/stores/financial-scope-store'
import { useFinancialYearsStore } from '@/stores/financial-years-store'
import { useWhatIfStore } from '@/stores/what-if-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { formatCurrency } from '@/utils/formatters'
import { getWorkspaceMembers } from '@/utils/workspace-members'

const { t } = useI18n()
const route = useRoute()
const financialYearsStore = useFinancialYearsStore()
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
const loading = computed(() => financialYearsStore.loading || whatIfStore.loading)
const error = computed(
  () =>
    pageError.value ||
    whatIfStore.error ||
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
const hasSavedStrategy = computed(() => activeScenario.value.id !== defaultStrategyScenario.id)
const positionMonth = computed(() =>
  latestPositionMonth(financialYear.value, currentFinancialMonth()),
)
const startingPosition = computed(() =>
  strategyStartingPosition(financialYear.value, positionMonth.value, selectedMemberId.value),
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
const debtAvailable = computed(
  () => financialYearValue(financialYear.value, 'liabilities', selectedMemberId.value) > 0,
)
const allocation = computed(() =>
  normalizeStrategyForOptions(activeScenario.value.allocation, {
    cash: true,
    debt: debtAvailable.value,
  }),
)
const projection = computed(() =>
  simulateStrategy({
    startingPosition: startingPosition.value,
    scenario: { ...activeScenario.value, allocation: allocation.value },
    simulatedMonthlySavings: strategyMonthlyAmount.value,
    simulatedMonthlyCost: simulation.value.simulatedCostOfLife,
    debtAvailable: debtAvailable.value,
  }),
)
const allocationEntries = computed(() =>
  [
    { id: 'cash', label: t('plan.current.cash'), percent: allocation.value.cash },
    { id: 'invest', label: t('plan.current.investments'), percent: allocation.value.invest },
    { id: 'debt', label: t('plan.current.debt'), percent: allocation.value.debt },
  ].filter(({ percent }) => percent > 0),
)
const allocationHeadline = computed(() =>
  allocationEntries.value.map(({ label, percent }) => `${percent}% ${label}`).join(' · '),
)
const mixMeta = computed(() => ({
  stockMarket: { label: t('plan.investments.stockMarket'), icon: 'trending_up' },
  realEstate: { label: t('plan.investments.realEstate'), icon: 'apartment' },
  fixedIncome: { label: t('plan.investments.fixedIncome'), icon: 'account_balance' },
  crypto: { label: t('plan.investments.crypto'), icon: 'currency_bitcoin' },
  businessEquity: { label: t('plan.investments.businessEquity'), icon: 'business_center' },
  other: { label: t('plan.investments.other'), icon: 'category' },
}))
const mixEntries = computed(() =>
  Object.entries(activeScenario.value.investmentMix).map(([id, value]) => ({
    id,
    ...mixMeta.value[id],
    ...value,
  })),
)
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
    ])
  } catch (loadError) {
    pageError.value = loadError
  }
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
.action-icon,
.current-icon,
.projection-icon,
.mix-icon {
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
.strategy .action-icon,
.current-icon {
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

.current-plan-card {
  padding: 1.4rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}
.current-plan-heading {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
}
.current-icon {
  width: 3.7rem;
  height: 3.7rem;
  font-size: 1.45rem;
}
.current-plan-heading > div {
  display: grid;
}
.current-plan-heading small {
  color: var(--color-purple);
  font-weight: 700;
}
.current-plan-heading strong {
  font-size: 1.35rem;
}
.current-plan-heading p {
  margin: 0.15rem 0 0;
  color: var(--color-copy);
}
.strategy-breakdown,
.projection-summary {
  margin-top: 1rem;
  padding: 1.15rem;
  border-radius: 0.8rem;
  background: color-mix(in srgb, var(--color-primary) 2.5%, var(--color-page));
}
.strategy-breakdown {
  display: grid;
  gap: 1rem;
}
.allocation-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: 1rem;
}
.allocation-item {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.55rem;
}
.allocation-item > div:nth-child(2) {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
}
.allocation-dot {
  width: 0.65rem;
  height: 0.65rem;
  margin-top: 0.35rem;
  border-radius: 50%;
}
.cash {
  background: var(--color-chart-cash);
}
.invest {
  background: var(--color-chart-investments);
}
.debt {
  background: var(--color-chart-lifestyle);
}
.allocation-track,
.mix-track {
  grid-column: 2;
  height: 0.45rem;
  overflow: hidden;
  border-radius: 999px;
  background: var(--color-line);
}
.allocation-track span,
.mix-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
}
.mix-summary {
  display: grid;
  padding-top: 1rem;
  border-top: 1px solid var(--color-line);
  gap: 0.8rem;
}
.mix-title {
  color: var(--color-copy);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.mix-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: 1rem 1.5rem;
}
.mix-item {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 0.7rem;
}
.mix-icon {
  width: 2.7rem;
  height: 2.7rem;
}
.mix-item > div {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.25rem 0.5rem;
}
.mix-track {
  grid-column: 1 / -1;
}
.mix-track span {
  background: var(--color-primary);
}
.projection-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.projection-summary > div {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.2rem 1rem;
}
.projection-summary > div + div {
  border-left: 1px solid var(--color-line);
}
.projection-summary > div > span:last-child {
  display: grid;
}
.projection-icon {
  width: 3rem;
  height: 3rem;
}
.projection-icon.growth {
  background: var(--color-green-soft);
  color: var(--color-success-dark);
}
.projection-summary small {
  color: var(--color-copy);
}
.projection-summary strong {
  font-size: 1.35rem;
}
.projection-summary .positive {
  color: var(--color-success-dark);
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
  .allocation-summary,
  .mix-grid {
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
  .current-plan-heading {
    grid-template-columns: auto 1fr;
  }
  .current-plan-heading .q-btn {
    grid-column: 1 / -1;
    justify-self: stretch;
  }
  .projection-summary {
    grid-template-columns: 1fr;
  }
  .projection-summary > div + div {
    margin-top: 0.8rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-line);
    border-left: 0;
  }
}
</style>
