<template>
  <q-page class="what-if-page">
    <main class="what-if-shell">
      <div v-if="loading" class="state">
        <q-spinner color="primary" size="2rem" />
        <span>{{ t('whatIf.loading') }}</span>
      </div>
      <section v-else-if="error" class="state">
        <q-icon name="cloud_off" size="2rem" />
        <h1>{{ t('whatIf.errors.loadTitle') }}</h1>
        <p>{{ t('whatIf.errors.load') }}</p>
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon="refresh"
          :label="t('common.retry')"
          @click="prepare(true)"
        />
      </section>
      <template v-else>
        <AppPageHeader
          :title="t('whatIf.title')"
          :subtitle="t('whatIf.subtitle')"
          :back-label="t('navigation.plan')"
          :back-to="{ name: 'plan', params: { workspaceId } }"
        />

        <section class="simulator-card">
          <div class="simulator-controls">
            <div class="spending-summary">
              <div class="spending-label">
                <span class="desktop-label">{{ t('whatIf.discretionary.reduceTitle') }}</span>
                <span class="mobile-label">{{ t('whatIf.discretionary.title') }}</span>
                <q-btn
                  flat
                  round
                  dense
                  size="sm"
                  icon="info_outline"
                  :aria-label="t('whatIf.discretionary.infoAction')"
                  @click="discretionaryInfoOpen = true"
                />
              </div>
              <strong
                >{{ formatCurrency(simulation.monthlyDiscretionary)
                }}{{ t('whatIf.perMonth') }}</strong
              >
              <small>{{ t('whatIf.discretionary.description') }}</small>
            </div>
            <div class="reduction-options" role="group" :aria-label="t('whatIf.reduction.title')">
              <button
                v-for="percentage in reductionOptions"
                :key="percentage"
                type="button"
                :class="{
                  selected:
                    config.extraMonthlySavings === 0 &&
                    config.discretionaryReductionPercent === percentage,
                }"
                :aria-pressed="
                  config.extraMonthlySavings === 0 &&
                  config.discretionaryReductionPercent === percentage
                "
                @click="saveReduction(percentage)"
              >
                {{ percentage }}%
              </button>
              <button
                type="button"
                :class="{ selected: customReductionSelected }"
                :aria-pressed="customReductionSelected"
              >
                {{ customSelectionLabel }}
                <q-popup-edit
                  :model-value="customEditorValue"
                  buttons
                  :title="t('whatIf.reduction.customAmountTitle')"
                  :label-set="t('common.save')"
                  :label-cancel="t('common.cancel')"
                  @save="saveCustomScenario"
                >
                  <template #default="scope">
                    <q-btn-toggle
                      v-model="scope.value.mode"
                      no-caps
                      spread
                      unelevated
                      toggle-color="primary"
                      color="grey-2"
                      text-color="grey-8"
                      :options="customModeOptions"
                      class="custom-mode-toggle"
                    />
                    <q-input
                      v-model.number="scope.value.value"
                      autofocus
                      dense
                      outlined
                      type="number"
                      inputmode="decimal"
                      min="0"
                      :max="scope.value.mode === 'percentage' ? 100 : 100000"
                      :step="scope.value.mode === 'percentage' ? 1 : 10"
                      :prefix="scope.value.mode === 'amount' ? currencySymbol : undefined"
                      :suffix="
                        scope.value.mode === 'percentage' ? '%' : t('whatIf.perMonth').trim()
                      "
                      @keyup.enter="scope.set"
                    />
                  </template>
                </q-popup-edit>
              </button>
            </div>
          </div>

          <div class="main-result">
            <div>
              <span>{{ t('whatIf.result.label') }}</span>
              <strong
                >+{{ formatCurrency(simulation.extraSavings)
                }}<small>{{ t('whatIf.perMonth') }}</small></strong
              >
              <b>{{ t('whatIf.result.baseline') }}</b>
            </div>
            <q-icon name="add_chart" />
          </div>

          <p v-if="unclassifiedMonthly > 0" class="notice">
            <q-btn
              flat
              round
              dense
              size="sm"
              icon="info_outline"
              :aria-label="t('whatIf.discretionary.unclassifiedAction')"
              @click="unclassifiedInfoOpen = true"
            />
            {{
              t('whatIf.discretionary.unclassified', {
                amount: formatCurrency(unclassifiedMonthly),
              })
            }}
          </p>
          <p v-if="simulation.simulatedSavingsCapacity <= 0" class="break-even">
            <template v-if="breakEvenReachable">
              {{
                t('whatIf.breakEven.reductionNeeded', {
                  percentage: simulation.breakEvenReductionPercent,
                })
              }}
            </template>
            <template v-else>{{ t('whatIf.breakEven.notReachable') }}</template>
          </p>
        </section>

        <section v-if="showScenarios" class="comparison-card">
          <div class="comparison-heading">
            <div>
              <h2>
                {{ t('whatIf.compare.title', { amount: formatCurrency(simulation.extraSavings) }) }}
              </h2>
              <p>{{ t('whatIf.compare.description') }}</p>
            </div>
          </div>

          <div class="scenario-grid">
            <article class="scenario-card investment-card">
              <span class="scenario-heading">
                <span class="scenario-icon invest"><q-icon name="trending_up" /></span>
                <span class="scenario-copy">
                  <strong>{{ t('whatIf.invest.cardTitle') }}</strong>
                  <span>{{ t('whatIf.invest.incrementalDescription') }}</span>
                </span>
              </span>
              <span class="scenario-outcome investment-outcome">
                <span class="impact-main investment-main">
                  <span class="investment-value">
                    <strong>+{{ formatCurrency(featuredInvestment.difference) }}</strong>
                    <small>{{
                      t('whatIf.invest.inYears', { years: featuredInvestment.years })
                    }}</small>
                  </span>
                  <svg class="investment-chart" viewBox="0 0 240 72" aria-hidden="true">
                    <defs>
                      <linearGradient id="investment-impact-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stop-color="var(--color-primary)" stop-opacity="0.2" />
                        <stop offset="1" stop-color="var(--color-primary)" stop-opacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      class="chart-area"
                      d="M3 65 C64 61 119 51 157 36 C191 23 217 11 237 5 L237 69 L3 69 Z"
                    />
                    <path class="chart-line" d="M3 65 C64 61 119 51 157 36 C191 23 217 11 237 5" />
                    <circle cx="237" cy="5" r="4" />
                  </svg>
                </span>
                <span class="impact-footer">
                  <span>{{ t('whatIf.invest.totalProjectedLabel') }}</span>
                  <strong>{{ formatCurrency(featuredInvestment.projectedValue) }}</strong>
                </span>
              </span>
            </article>

            <article v-if="selectedDebt" class="scenario-card debt-card">
              <span class="scenario-heading">
                <span class="scenario-icon debt"><q-icon name="home" /></span>
                <span class="scenario-copy">
                  <span class="debt-title">
                    <strong>{{ t('whatIf.debt.title') }}</strong>
                    <q-btn
                      flat
                      round
                      dense
                      size="sm"
                      icon="info_outline"
                      @click="debtInfoOpen = true"
                    />
                  </span>
                  <span>{{ t('whatIf.debt.incrementalDescription') }}</span>
                </span>
              </span>
              <span v-if="debtPayoff" class="scenario-outcome debt-outcome modeled-debt-outcome">
                <span class="impact-main debt-main">
                  <strong>{{ earlierLabel(debtPayoff.accelerated.monthsEarlier) }}</strong>
                  <small class="debt-saving">{{
                    t('whatIf.debt.interestSaved', {
                      amount: formatCurrency(debtPayoff.accelerated.interestSaved),
                    })
                  }}</small>
                </span>
                <span class="impact-footer debt-footer">
                  <q-icon name="calendar_month" />
                  <span>{{ t('whatIf.debt.newPayoffLabel') }}</span>
                  <strong>{{ formatMonthYear(debtPayoff.accelerated.payoffDate) }}</strong>
                </span>
              </span>
              <span v-else class="scenario-outcome debt-outcome">
                <strong>{{ t('whatIf.debt.modelUnavailable') }}</strong>
                <small>{{ t('whatIf.debt.fallbackInfo') }}</small>
              </span>
            </article>

            <article v-if="safetyImpact" class="scenario-card cash-card">
              <span class="scenario-heading">
                <span class="scenario-icon cash"><q-icon name="health_and_safety" /></span>
                <span class="scenario-copy">
                  <strong>{{ t('whatIf.cash.cardTitle') }}</strong>
                  <span>{{ t('whatIf.cash.incrementalDescription') }}</span>
                </span>
              </span>
              <span class="scenario-outcome cash-outcome">
                <span class="impact-main safety-main">
                  <strong v-if="safetyImpact.alreadyFunded">{{
                    t('whatIf.cash.alreadyFunded')
                  }}</strong>
                  <strong v-else
                    >+{{ formatSafetyMonths(safetyImpact.additionalSafetyMonths) }}</strong
                  >
                  <small>{{
                    safetyImpact.alreadyFunded
                      ? t('whatIf.cash.fundedContext')
                      : t('whatIf.cash.additionalSafety')
                  }}</small>
                  <span class="safety-meter" aria-hidden="true">
                    <i
                      v-for="month in 12"
                      :key="month"
                      :class="{ active: month <= safetyMeterMonths }"
                    />
                  </span>
                </span>
                <span class="impact-footer safety-footer">
                  <q-icon name="lightbulb_outline" />
                  <span>{{
                    safetyImpact.alreadyFunded
                      ? t('whatIf.cash.useElsewhere')
                      : t('whatIf.cash.safetyComparison', {
                          scenario: formatSafetyMonths(safetyImpact.scenarioSafetyMonths),
                          baseline: formatSafetyMonths(safetyImpact.baselineSafetyMonths),
                        })
                  }}</span>
                </span>
              </span>
            </article>
          </div>
        </section>
      </template>
    </main>

    <q-dialog v-model="discretionaryInfoOpen" :position="$q.screen.lt.sm ? 'bottom' : undefined">
      <q-card class="app-info-dialog responsive-info-card">
        <span class="info-sheet-handle" aria-hidden="true" />
        <q-card-section class="app-info-heading">
          <h2>{{ t('whatIf.discretionary.infoTitle') }}</h2>
          <q-btn v-close-popup flat round dense icon="close" :aria-label="t('common.close')" />
        </q-card-section>
        <q-card-section class="app-info-copy">
          <p>{{ t('whatIf.discretionary.description') }}</p>
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="unclassifiedInfoOpen" :position="$q.screen.lt.sm ? 'bottom' : undefined">
      <q-card class="app-info-dialog responsive-info-card">
        <span class="info-sheet-handle" aria-hidden="true" />
        <q-card-section class="app-info-heading">
          <h2>{{ t('whatIf.discretionary.unclassifiedTitle') }}</h2>
          <q-btn v-close-popup flat round dense icon="close" :aria-label="t('common.close')" />
        </q-card-section>
        <q-card-section class="app-info-copy">
          <p>
            {{
              t('whatIf.discretionary.unclassified', {
                amount: formatCurrency(unclassifiedMonthly),
              })
            }}
          </p>
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="debtInfoOpen" :position="$q.screen.lt.sm ? 'bottom' : undefined">
      <q-card class="app-info-dialog responsive-info-card">
        <span class="info-sheet-handle" aria-hidden="true" />
        <q-card-section class="app-info-heading">
          <h2>{{ t('whatIf.debt.infoTitle') }}</h2>
          <q-btn v-close-popup flat round dense icon="close" :aria-label="t('common.close')" />
        </q-card-section>
        <q-card-section class="app-info-copy">
          <p>{{ t('whatIf.debt.infoDescription') }}</p>
          <p v-if="debtPayoff">{{ t('whatIf.debt.modeledInfo') }}</p>
          <p v-else>{{ t('whatIf.debt.fallbackInfo') }}</p>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import AppPageHeader from '@/components/layout/AppPageHeader.vue'
import { getLiabilityCategory } from '@/config/liability-categories'
import {
  extractPositionLiabilities,
  modeledLiabilitiesForPositions,
} from '@/domain/financial/calculation-context'
import {
  calculateDebtPayoffImpact,
  highestInterestModeledDebt,
} from '@/domain/financial/debt-payoff'
import {
  currentFinancialYear,
  financialYearAvailableIncomeValue,
  financialYearExpenseNecessityValue,
  financialYearFlowValue,
  financialYearMonthCategoryValue,
  financialYearUnclassifiedExpenseValue,
} from '@/domain/financial/financial-year'
import {
  latestPositionMonth,
  strategyStartingPosition,
} from '@/domain/financial/strategy-simulation'
import {
  calculateDebtScenario,
  calculateInvestmentScenario,
  calculateSafetyImpact,
  calculateWhatIf,
} from '@/domain/financial/what-if'
import { authUser } from '@/services/auth'
import { useFinancialScopeStore } from '@/stores/financial-scope-store'
import { useFinancialYearsStore } from '@/stores/financial-years-store'
import { useLiabilitiesStore } from '@/stores/liabilities-store'
import { useWhatIfStore } from '@/stores/what-if-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { currencySymbol, formatCurrency } from '@/utils/formatters'
import { getWorkspaceMembers } from '@/utils/workspace-members'

const $q = useQuasar()
const { t } = useI18n()
const route = useRoute()
const financialYearsStore = useFinancialYearsStore()
const liabilitiesStore = useLiabilitiesStore()
const scopeStore = useFinancialScopeStore()
const whatIfStore = useWhatIfStore()
const workspaceStore = useWorkspaceStore()
const discretionaryInfoOpen = ref(false)
const unclassifiedInfoOpen = ref(false)
const debtInfoOpen = ref(false)
const pageError = ref(null)
const reductionOptions = [0, 10, 25, 50]
const currentYear = currentFinancialYear()
const workspaceId = computed(() => String(route.params.workspaceId))
const workspace = computed(
  () => workspaceStore.workspaces.find(({ id }) => id === workspaceId.value) || null,
)
const members = computed(() => getWorkspaceMembers(workspace.value, authUser.value))
const memberIds = computed(() => members.value.map(({ id }) => id))
const selectedMemberId = computed(() =>
  scopeStore.get(workspaceId.value, memberIds.value, authUser.value?.uid),
)
const config = computed(() => whatIfStore.config)
const activeScenario = computed(
  () =>
    config.value.scenarios.find(({ id }) => id === config.value.activeScenarioId) ||
    config.value.scenarios[0],
)
const financialYear = computed(() => financialYearsStore.get(workspaceId.value, currentYear))
const positionMonth = computed(() => latestPositionMonth(financialYear.value))
const loading = computed(
  () =>
    whatIfStore.loading ||
    financialYearsStore.loading ||
    liabilitiesStore.loading ||
    liabilitiesStore.categoryLoading,
)
const error = computed(
  () =>
    pageError.value ||
    whatIfStore.error ||
    financialYearsStore.errorFor(workspaceId.value, currentYear),
)
const annualCost = computed(() =>
  financialYearFlowValue(financialYear.value, 'expenses', selectedMemberId.value),
)
const annualAvailableIncome = computed(() =>
  financialYearAvailableIncomeValue(financialYear.value, selectedMemberId.value),
)
const annualDiscretionary = computed(() =>
  financialYearExpenseNecessityValue(financialYear.value, 'lifestyle', selectedMemberId.value),
)
const unclassifiedMonthly = computed(
  () => financialYearUnclassifiedExpenseValue(financialYear.value, selectedMemberId.value) / 12,
)
const simulation = computed(() =>
  calculateWhatIf({
    availableIncome: annualAvailableIncome.value,
    costOfLife: annualCost.value,
    discretionary: annualDiscretionary.value,
    reductionPercent:
      config.value.extraMonthlySavings > 0 ? 0 : config.value.discretionaryReductionPercent,
    extraMonthlySavings: config.value.extraMonthlySavings,
  }),
)
const startingPosition = computed(() =>
  strategyStartingPosition(financialYear.value, positionMonth.value, selectedMemberId.value),
)
const cash = computed(() =>
  financialYearMonthCategoryValue(
    financialYear.value,
    positionMonth.value,
    'assets',
    'cash',
    selectedMemberId.value,
  ),
)
const liabilities = computed(() =>
  extractPositionLiabilities(
    financialYear.value,
    positionMonth.value,
    selectedMemberId.value,
    liabilityCategoryName,
  ),
)
const modeledDebts = computed(() =>
  modeledLiabilitiesForPositions(
    liabilities.value,
    liabilitiesStore.itemsForCategory('mortgage'),
    selectedMemberId.value,
  ),
)
const recommendedDebt = computed(
  () =>
    highestInterestModeledDebt(modeledDebts.value) ||
    liabilities.value.find(({ categoryId }) => categoryId === 'mortgage') ||
    liabilities.value[0] ||
    null,
)
const selectedDebt = computed(() => recommendedDebt.value)
const safetyImpact = computed(() =>
  calculateSafetyImpact({
    cash: cash.value,
    currentMonthlyCost: simulation.value.monthlyCostOfLife,
    simulatedMonthlyCost: simulation.value.simulatedCostOfLife,
    currentMonthlySavings: simulation.value.currentSavingsCapacity,
    simulatedMonthlySavings: simulation.value.simulatedSavingsCapacity,
    cashAnnualReturnPercent: activeScenario.value.cashAnnualReturnPercent,
    inflationAnnualPercent: activeScenario.value.inflationAnnualPercent,
  }),
)
const safetyMeterMonths = computed(() =>
  Math.min(12, Math.max(0, Math.floor(safetyImpact.value?.scenarioSafetyMonths || 0))),
)
const investmentScenario = computed(() =>
  calculateInvestmentScenario({
    monthlyContribution: simulation.value.simulatedSavingsCapacity,
    currentMonthlyContribution: simulation.value.currentSavingsCapacity,
    annualReturnPercent: activeScenario.value.investmentMix.stockMarket?.annualReturnPercent || 7,
    startingValue: startingPosition.value.investmentTotal,
  }),
)
const featuredInvestment = computed(
  () => investmentScenario.value.find(({ years }) => years === 20) || investmentScenario.value[0],
)
const debtScenario = computed(() => calculateDebtScenario(simulation.value.extraSavings))
const debtPayoff = computed(() =>
  calculateDebtPayoffImpact({
    liability: selectedDebt.value,
    extraMonthlyPayment: debtScenario.value.monthly,
    asOfDate: localToday(),
  }),
)
const showScenarios = computed(() => simulation.value.extraSavings > 0)
const breakEvenReachable = computed(
  () =>
    simulation.value.breakEvenReductionPercent != null &&
    simulation.value.breakEvenReductionPercent <= 100,
)
const customReductionSelected = computed(
  () =>
    config.value.extraMonthlySavings > 0 ||
    !reductionOptions.includes(config.value.discretionaryReductionPercent),
)
const customEditorValue = computed(() => ({
  mode: config.value.extraMonthlySavings > 0 ? 'amount' : 'percentage',
  value:
    config.value.extraMonthlySavings > 0
      ? config.value.extraMonthlySavings
      : !reductionOptions.includes(config.value.discretionaryReductionPercent)
        ? config.value.discretionaryReductionPercent
        : null,
}))
const customModeOptions = computed(() => [
  { label: t('whatIf.reduction.percentageMode'), value: 'percentage' },
  { label: t('whatIf.reduction.amountMode'), value: 'amount' },
])
const customSelectionLabel = computed(() => {
  if (config.value.extraMonthlySavings > 0) return formatCurrency(config.value.extraMonthlySavings)
  if (!reductionOptions.includes(config.value.discretionaryReductionPercent)) {
    return `${config.value.discretionaryReductionPercent}%`
  }
  return t('whatIf.reduction.custom')
})
function liabilityCategoryName(categoryId) {
  return t(getLiabilityCategory(categoryId)?.nameKey || 'whatIf.debt.title')
}

watch(workspaceId, () => prepare(), { immediate: true })

async function prepare(force = false) {
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

async function persist(changes) {
  try {
    await whatIfStore.save(workspaceId.value, changes)
    return true
  } catch {
    $q.notify({ type: 'negative', message: t('whatIf.errors.save'), position: 'top' })
    return false
  }
}

function saveReduction(percentage) {
  persist({ discretionaryReductionPercent: percentage, extraMonthlySavings: 0 })
}

function localToday() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`
}

function earlierLabel(months) {
  const total = Math.max(0, Number(months) || 0)
  if (!total) return t('whatIf.debt.noEarlier')
  const years = Math.floor(total / 12)
  const remainingMonths = total % 12
  if (!years) return t('whatIf.debt.monthsEarlier', { months: remainingMonths })
  if (!remainingMonths) return t('whatIf.debt.yearsEarlier', { years })
  return t('whatIf.debt.durationEarlier', { years, months: remainingMonths })
}

function formatSafetyMonths(value) {
  return `${new Intl.NumberFormat('en-IE', { maximumFractionDigits: 1 }).format(value)} months`
}

function formatMonthYear(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-IE', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}
async function saveCustomScenario(value) {
  const mode = value?.mode === 'percentage' ? 'percentage' : 'amount'
  const maximum = mode === 'percentage' ? 100 : 100000
  const normalized = Math.min(maximum, Math.max(0, Number(value?.value) || 0))
  await persist(
    mode === 'percentage'
      ? { discretionaryReductionPercent: normalized, extraMonthlySavings: 0 }
      : { discretionaryReductionPercent: 0, extraMonthlySavings: normalized },
  )
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;

.what-if-page {
  @include financial-page;
}

.what-if-shell {
  @include financial-shell;
}

.page-header {
  @include financial-header;
}

.page-heading {
  width: 100%;
}

.page-nav {
  display: flex;
  align-items: center;
}

.back-button {
  @include financial-back-button;
}

.mobile-section-title,
.mobile-label {
  display: none;
}

h1 {
  @include financial-title;
  max-width: 44rem;
}

.page-header p,
.comparison-heading p {
  margin: 0.45rem 0 0;
  color: var(--color-copy);
  font-size: 1rem;
}

.state {
  display: grid;
  place-items: center;
  gap: 0.75rem;
  min-height: 24rem;
  color: var(--color-copy);
  text-align: center;
}
.state h1,
.state p {
  margin: 0;
}

.simulator-card {
  margin-top: 0.75rem;
}

.comparison-card {
  margin-top: 1.25rem;
}

.simulator-card {
  padding: 1.5rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.simulator-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--color-line);
}

.spending-summary {
  display: grid;
  min-width: 0;
}

.spending-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--color-ink);
}

.spending-label .q-btn,
.spending-summary small {
  color: var(--color-copy);
}

.spending-label .q-btn {
  min-width: 1.75rem;
  min-height: 1.75rem;
}

.spending-summary strong {
  margin: 0.15rem 0;
  color: var(--color-ink);
  font-size: 1.65rem;
  line-height: 1.1;
  letter-spacing: -0.035em;
  white-space: nowrap;
}

.spending-summary small {
  font-size: 0.88rem;
}

.reduction-options {
  display: grid;
  grid-template-columns: repeat(5, minmax(4.4rem, 1fr));
  gap: 0.6rem;
  flex: 0 1 31rem;
}

.reduction-options button {
  min-height: 2.75rem;
  padding: 0.5rem 0.8rem;
  border: 1px solid var(--color-line);
  border-radius: 0.7rem;
  background: white;
  color: var(--color-ink);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.reduction-options button.selected {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: white;
  box-shadow: 0 0.3rem 0.75rem rgb(31 111 235 / 20%);
}

.reduction-options button:focus-visible {
  @include focus-ring;
}

.custom-mode-toggle {
  min-width: 18rem;
  margin-bottom: 0.75rem;
}

.main-result {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 1rem;
  padding: 1.25rem 1.35rem;
  border-radius: var(--radius-md);
  background: linear-gradient(105deg, var(--color-green-soft), #eefbf6);
  color: var(--color-success-dark);
}

.main-result.negative {
  background: var(--color-red-soft);
  color: var(--color-danger);
}

.main-result strong {
  display: block;
  margin: 0.1rem 0;
  font-size: clamp(2rem, 6vw, 3.2rem);
  line-height: 1;
  letter-spacing: -0.045em;
}

.main-result strong small {
  margin-left: 0.2rem;
  font-size: 0.42em;
  letter-spacing: -0.01em;
}

.main-result b {
  display: block;
  font-size: 0.9rem;
}

.main-result > .q-icon {
  flex: 0 0 auto;
  font-size: 2.7rem;
}

.notice,
.break-even {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  margin: 0.8rem 0 0;
  color: var(--color-copy);
  font-size: 0.85rem;
}

.notice .q-btn {
  flex: 0 0 auto;
  min-width: 1.5rem;
  min-height: 1.5rem;
  margin: -0.25rem 0 0 -0.25rem;
  color: var(--color-copy);
}

.break-even {
  color: var(--color-danger);
  font-weight: 650;
}

.comparison-card {
  display: grid;
  gap: 1rem;
  padding: 1.35rem;
  border: 1px solid color-mix(in srgb, var(--color-line) 72%, transparent);
  border-radius: var(--radius-card);
  background: linear-gradient(145deg, #f7faff 0%, #f1f5fa 100%);
}

.comparison-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 0 0.05rem;
}

.comparison-heading h2,
.comparison-heading p {
  margin-top: 0;
  margin-bottom: 0;
}

.comparison-heading h2 {
  font-size: clamp(1.45rem, 3vw, 1.8rem);
  line-height: 1.15;
  letter-spacing: -0.025em;
}

.scenario-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.85rem;
}

.scenario-card {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  width: 100%;
  min-width: 0;
  min-height: 17rem;
  padding: 1rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: white;
  color: var(--color-ink);
  font: inherit;
  text-align: left;
  box-shadow: 0 0.35rem 1.2rem rgb(15 23 42 / 5%);
}

.scenario-heading {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.65rem;
  width: 100%;
}

.scenario-icon {
  display: grid;
  place-items: center;
  width: 2.35rem;
  height: 2.35rem;
  border-radius: 50%;
  font-size: 1.05rem;
}

.scenario-icon.cash {
  background: var(--color-green-soft);
  color: var(--color-success-dark);
}

.scenario-icon.invest {
  background: var(--color-blue-soft);
  color: var(--color-primary);
}

.scenario-icon.debt {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.scenario-copy {
  display: grid;
  min-width: 0;
}

.scenario-copy strong {
  line-height: 1.2;
}

.scenario-copy span,
.scenario-outcome small {
  color: var(--color-copy);
  font-size: 0.72rem;
  line-height: 1.3;
}

.debt-title {
  display: flex;
  align-items: center;
  gap: 0.2rem;
}

.debt-title .q-btn {
  min-width: 1.4rem;
  min-height: 1.4rem;
  color: var(--color-copy);
}

.scenario-outcome {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 0.3rem;
  min-height: 0;
  padding-top: 0.75rem;
}

.cash-outcome > strong,
.positive-comparison {
  color: var(--color-success-dark);
}

.cash-outcome .q-linear-progress {
  margin-bottom: 0.4rem;
}

.cash-outcome {
  min-height: 0;
}

.investment-outcome {
  min-height: 0;
}

.investment-value {
  display: grid;
  justify-items: start;
}

.investment-value strong,
.debt-outcome strong {
  color: var(--color-ink);
  font-size: clamp(1.55rem, 3vw, 2rem);
  line-height: 1.1;
  letter-spacing: -0.035em;
}

.investment-chart {
  width: 100%;
  height: 3.8rem;
  margin-top: 0.35rem;
  overflow: visible;
}

.investment-chart .chart-area {
  fill: url('#investment-impact-fill');
  stroke: none;
}

.investment-chart .chart-line {
  fill: none;
  stroke: var(--color-primary);
  stroke-linecap: round;
  stroke-width: 2.5;
}

.investment-chart circle {
  fill: var(--color-primary);
}

.impact-main {
  display: grid;
  align-content: center;
  min-height: 0;
}

.investment-main {
  grid-template-rows: auto minmax(0, 1fr);
  align-content: stretch;
  padding-top: 0.35rem;
}

.debt-outcome {
  gap: 0.3rem;
  text-align: left;
}

.debt-outcome strong {
  color: var(--color-warning-dark);
  font-size: clamp(1.3rem, 2.5vw, 1.75rem);
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.02em;
}

.debt-outcome strong span {
  font-size: 1.75rem;
  letter-spacing: -0.045em;
}

.debt-outcome small {
  font-size: 0.86rem;
}

.modeled-debt-outcome strong {
  color: var(--color-warning-dark);
}

.modeled-debt-outcome .debt-saving {
  color: var(--color-success-dark);
  font-weight: 700;
}

.debt-main,
.safety-main {
  gap: 0.35rem;
}

.cash-outcome > strong {
  font-size: clamp(1.55rem, 3vw, 2rem);
  line-height: 1.05;
  letter-spacing: -0.04em;
}

.impact-footer {
  display: flex;
  grid-column: 1 / -1;
  align-items: center;
  gap: 0.35rem;
  min-height: 2.25rem;
  margin-top: 0.45rem;
  padding-top: 0.65rem;
  border-top: 1px solid var(--color-line);
  color: var(--color-copy);
  font-size: 0.7rem;
}

.impact-footer strong {
  margin-left: auto;
  color: var(--color-ink);
  font-size: 0.72rem;
}

.impact-footer .q-icon {
  flex: 0 0 auto;
  color: var(--color-primary);
  font-size: 1rem;
}

.safety-meter {
  display: flex;
  justify-content: space-between;
  gap: 0.25rem;
  margin-top: 0.65rem;
}

.safety-meter i {
  width: 0.42rem;
  height: 1.45rem;
  flex: 0 0 0.42rem;
  border-radius: 0.25rem;
  background: var(--color-line);
}

.safety-meter i.active {
  background: color-mix(in srgb, var(--color-chart-cash) 62%, white);
}

.safety-footer {
  align-items: flex-start;
}

.safety-footer .q-icon {
  color: var(--color-success-dark);
}

@media (max-width: 760px) {
  .what-if-shell {
    max-width: 32rem;
  }

  .page-nav {
    position: relative;
    justify-content: center;
    min-height: 2.25rem;
    margin-bottom: 0.8rem;
  }

  .back-button {
    position: absolute;
    left: -0.5rem;
    margin: 0;
  }

  .back-button :deep(.block) {
    display: none;
  }

  .mobile-section-title {
    display: block;
    font-size: 1rem;
  }

  h1 {
    max-width: 22rem;
    font-size: 2rem;
    line-height: 1.05;
  }

  .page-header p,
  .comparison-heading p {
    font-size: 0.82rem;
  }

  .page-header p {
    max-width: 24rem;
  }

  .simulator-card,
  .comparison-card {
    margin-top: 0.9rem;
  }

  .simulator-card {
    padding: 0.75rem;
    border-radius: 0.9rem;
  }

  .comparison-card {
    padding: 0.75rem;
    border-radius: 0.9rem;
  }

  .simulator-controls {
    display: grid;
    gap: 0.8rem;
    padding-bottom: 0;
    border-bottom: 0;
  }

  .desktop-label {
    display: none;
  }

  .mobile-label {
    display: inline;
  }

  .spending-summary strong {
    font-size: 1.45rem;
  }

  .spending-summary small {
    max-width: 20rem;
    font-size: 0.76rem;
  }

  .reduction-options {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 0.3rem;
  }

  .reduction-options button {
    min-width: 0;
    min-height: 2.15rem;
    padding: 0.35rem 0.15rem;
    border-radius: 0.55rem;
    font-size: 0.72rem;
  }

  .main-result {
    margin-top: 0.8rem;
    padding: 0.85rem;
    border-radius: 0.65rem;
  }

  .main-result strong {
    font-size: 2.15rem;
  }

  .main-result > .q-icon {
    font-size: 2.25rem;
  }

  .comparison-heading {
    align-items: center;
    padding: 0 0.25rem;
  }

  .comparison-heading h2 {
    font-size: 1.25rem;
  }

  .scenario-grid {
    grid-template-columns: 1fr;
    gap: 0.7rem;
  }

  .scenario-card {
    min-height: 13rem;
    padding: 0.9rem;
    border: 1px solid var(--color-line);
    border-radius: 0.8rem;
    box-shadow: 0 0.25rem 0.8rem rgb(15 23 42 / 4%);
  }

  .scenario-heading {
    gap: 0.7rem;
  }

  .scenario-icon {
    width: 2.6rem;
    height: 2.6rem;
  }

  .scenario-outcome {
    margin-left: 0;
    padding-top: 0.75rem;
  }

  .investment-chart {
    height: 3.35rem;
  }

  .investment-outcome {
    text-align: left;
  }

  .investment-value strong {
    font-size: 1.55rem;
  }

  .debt-outcome {
    gap: 0.35rem;
    text-align: left;
  }

  .debt-outcome strong {
    font-size: 1.35rem;
  }

  .debt-outcome strong span {
    font-size: 1.05rem;
  }
}
</style>
