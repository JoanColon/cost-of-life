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
        <header class="page-header">
          <div class="page-heading">
            <div class="page-nav">
              <q-btn
                flat
                dense
                no-caps
                color="grey-7"
                icon="arrow_back"
                :label="t('navigation.backToWorkspaceHome')"
                :to="{ name: 'workspace-dashboard', params: { workspaceId } }"
                class="back-button"
              />
              <strong class="mobile-section-title">{{ t('navigation.whatIf') }}</strong>
            </div>
            <h1>{{ t('whatIf.title') }}</h1>
            <p>{{ t('whatIf.subtitle') }}</p>
          </div>
        </header>

        <section class="simulator-card">
          <div class="simulator-controls">
            <div class="spending-summary">
              <div class="spending-label">
                <span class="desktop-label">{{ t('whatIf.discretionary.reduceTitle') }}</span>
                <span class="mobile-label">{{ t('whatIf.discretionary.title') }}</span>
                <q-icon name="info_outline" />
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
                :class="{ selected: config.discretionaryReductionPercent === percentage }"
                :aria-pressed="config.discretionaryReductionPercent === percentage"
                @click="saveReduction(percentage)"
              >
                {{ percentage }}%
              </button>
              <button
                type="button"
                :class="{ selected: customReductionSelected }"
                :aria-pressed="customReductionSelected"
                @click="openCustomReduction"
              >
                {{
                  customReductionSelected
                    ? `${config.discretionaryReductionPercent}%`
                    : t('whatIf.reduction.custom')
                }}
              </button>
            </div>
          </div>

          <div class="main-result" :class="{ negative: simulation.simulatedSavingsCapacity < 0 }">
            <div>
              <span>{{ t('whatIf.result.label') }}</span>
              <strong
                >{{ formatCurrency(simulation.simulatedSavingsCapacity)
                }}<small>{{ t('whatIf.perMonth') }}</small></strong
              >
              <b>{{
                t('whatIf.result.extra', { amount: formatCurrency(simulation.extraSavings) })
              }}</b>
            </div>
            <q-icon
              :name="
                simulation.simulatedSavingsCapacity < 0 ? 'trending_down' : 'signal_cellular_alt'
              "
            />
          </div>

          <p v-if="unclassifiedMonthly > 0" class="notice">
            <q-icon name="info_outline" />
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
                {{ t('whatIf.compare.title') }}
              </h2>
              <p>{{ t('whatIf.compare.description') }}</p>
            </div>
          </div>

          <div class="scenario-grid">
            <article v-if="cashScenario" class="scenario-card cash-card">
              <span class="scenario-heading">
                <span class="scenario-icon cash"><q-icon name="paid" /></span>
                <span class="scenario-copy">
                  <strong>{{ t('whatIf.cash.cardTitle') }}</strong>
                  <span>{{
                    t('whatIf.cash.cardDescription', { months: cashScenario.targetMonths })
                  }}</span>
                </span>
              </span>
              <span class="scenario-outcome cash-outcome">
                <q-linear-progress
                  rounded
                  size="0.7rem"
                  color="positive"
                  track-color="blue-grey-1"
                  :value="cashProgress"
                />
                <strong>{{ cashProgressLabel }}</strong>
                <small>{{ cashProgressDetail }}</small>
              </span>
            </article>

            <article class="scenario-card investment-card">
              <span class="scenario-heading">
                <span class="scenario-icon invest"><q-icon name="trending_up" /></span>
                <span class="scenario-copy">
                  <strong>{{ t('whatIf.invest.cardTitle') }}</strong>
                  <span>{{
                    t('whatIf.invest.description', { return: config.expectedAnnualReturnPercent })
                  }}</span>
                </span>
              </span>
              <span class="scenario-outcome investment-outcome">
                <span class="investment-value">
                  <strong>{{ formatCurrency(featuredInvestment.projectedValue) }}</strong>
                  <small>{{
                    t('whatIf.invest.inYears', { years: featuredInvestment.years })
                  }}</small>
                </span>
                <svg class="investment-chart" viewBox="0 0 150 72" aria-hidden="true">
                  <defs>
                    <linearGradient id="what-if-chart-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stop-color="#3b82f6" stop-opacity="0.28" />
                      <stop offset="1" stop-color="#3b82f6" stop-opacity="0.03" />
                    </linearGradient>
                  </defs>
                  <path d="M4 66 C42 61 72 49 96 36 C118 24 133 13 146 5 L146 68 L4 68 Z" />
                  <path d="M4 66 C42 61 72 49 96 36 C118 24 133 13 146 5" />
                  <circle cx="146" cy="5" r="4" />
                </svg>
                <small class="positive-comparison">{{
                  t('whatIf.invest.difference', {
                    amount: formatCurrency(featuredInvestment.difference),
                  })
                }}</small>
              </span>
            </article>

            <article v-if="selectedDebt" class="scenario-card debt-card">
              <span class="scenario-heading">
                <span class="scenario-icon debt"><q-icon name="home" /></span>
                <span class="scenario-copy">
                  <strong>{{ t('whatIf.debt.title') }}</strong>
                  <span>{{ selectedDebt.name }}</span>
                </span>
              </span>
              <span class="scenario-outcome debt-outcome">
                <strong>
                  <span>{{ formatCurrency(debtScenario.annual) }}</span
                  >{{ t('whatIf.debt.perYearSuffix') }}
                </strong>
                <small>{{ t('whatIf.debt.additionalRepayments') }}</small>
              </span>
            </article>
          </div>

          <button type="button" class="strategy-row" @click="strategyOpen = true">
            <span class="strategy-heading">
              <span class="scenario-icon strategy"><q-icon name="tune" /></span>
              <span class="scenario-copy">
                <strong>{{ t('whatIf.strategy.title') }}</strong>
                <span class="strategy-description">{{ t('whatIf.strategy.cardDescription') }}</span>
                <span class="mobile-strategy-summary">{{ strategySummary }}</span>
              </span>
            </span>
            <span class="strategy-selection">
              <span>{{ strategySummary }}</span>
              <q-icon name="chevron_right" />
            </span>
          </button>
        </section>
      </template>
    </main>

    <q-dialog v-model="customReductionOpen">
      <q-card class="custom-card">
        <q-card-section>
          <h2>{{ t('whatIf.reduction.customTitle') }}</h2>
          <q-input
            v-model.number="customReduction"
            outlined
            :dense="$q.screen.lt.sm"
            autofocus
            type="number"
            min="0"
            max="100"
            step="1"
            suffix="%"
            :rules="[percentageRule]"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps :label="t('common.cancel')" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="primary"
            :label="t('common.save')"
            :disable="percentageRule(customReduction) !== true"
            @click="saveCustomReduction"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
    <q-dialog v-model="strategyOpen">
      <StrategyDialog
        :strategy="strategy"
        :simulated-savings-capacity="simulation.simulatedSavingsCapacity"
        :cash="cash"
        :current-monthly-cost="simulation.monthlyCostOfLife"
        :simulated-monthly-cost="simulation.simulatedCostOfLife"
        :expected-annual-return-percent="config.expectedAnnualReturnPercent"
        :cash-available="Boolean(cashScenario)"
        :debt-available="Boolean(selectedDebt)"
        @save="saveStrategy"
        @cancel="strategyOpen = false"
      />
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import StrategyDialog from '@/components/what-if/StrategyDialog.vue'
import { getLiabilityCategory } from '@/config/liability-categories'
import {
  currentFinancialMonth,
  currentFinancialYear,
  financialYearAvailableIncomeValue,
  financialYearExpenseNecessityValue,
  financialYearMonthCategoryValue,
  financialYearUnclassifiedExpenseValue,
  financialYearValue,
} from '@/domain/financial/financial-year'
import {
  calculateCashScenario,
  calculateDebtScenario,
  calculateInvestmentScenario,
  calculateWhatIf,
  normalizeStrategyForOptions,
} from '@/domain/financial/what-if'
import { useFinancialYearsStore } from '@/stores/financial-years-store'
import { useWhatIfStore } from '@/stores/what-if-store'
import { formatCurrency } from '@/utils/formatters'

const $q = useQuasar()
const { t } = useI18n()
const route = useRoute()
const financialYearsStore = useFinancialYearsStore()
const whatIfStore = useWhatIfStore()
const customReductionOpen = ref(false)
const customReduction = ref(0)
const strategyOpen = ref(false)
const pageError = ref(null)
const reductionOptions = [0, 10, 25, 50]
const currentMonth = currentFinancialMonth()
const currentYear = currentFinancialYear()
const workspaceId = computed(() => String(route.params.workspaceId))
const config = computed(() => whatIfStore.config)
const financialYear = computed(() => financialYearsStore.get(workspaceId.value, currentYear))
const loading = computed(() => whatIfStore.loading || financialYearsStore.loading)
const error = computed(
  () =>
    pageError.value ||
    whatIfStore.error ||
    financialYearsStore.errorFor(workspaceId.value, currentYear),
)
const annualCost = computed(() => financialYearValue(financialYear.value, 'expenses'))
const annualAvailableIncome = computed(() => financialYearAvailableIncomeValue(financialYear.value))
const annualDiscretionary = computed(() =>
  financialYearExpenseNecessityValue(financialYear.value, 'lifestyle'),
)
const unclassifiedMonthly = computed(
  () => financialYearUnclassifiedExpenseValue(financialYear.value) / 12,
)
const simulation = computed(() =>
  calculateWhatIf({
    availableIncome: annualAvailableIncome.value,
    costOfLife: annualCost.value,
    discretionary: annualDiscretionary.value,
    reductionPercent: config.value.discretionaryReductionPercent,
  }),
)
const cash = computed(() =>
  financialYearMonthCategoryValue(financialYear.value, currentMonth, 'assets', 'cash'),
)
const liabilities = computed(() => {
  const categories = financialYear.value?.months?.[currentMonth]?.liabilities?.categories || {}
  return Object.entries(categories)
    .flatMap(([categoryId, category]) =>
      Object.entries(category.subcategories || {}).flatMap(([subcategoryId, subcategory]) => {
        const items = Object.entries(subcategory.items || {})
        if (!items.length) {
          return [
            {
              id: subcategoryId,
              categoryId,
              name: t(getLiabilityCategory(categoryId)?.nameKey || 'whatIf.debt.title'),
              balance: Number(subcategory.total || 0),
            },
          ]
        }
        return items.map(([id, item]) => ({
          id,
          categoryId,
          name:
            item.itemName || t(getLiabilityCategory(categoryId)?.nameKey || 'whatIf.debt.title'),
          balance: Number(item.total || 0),
        }))
      }),
    )
    .filter(({ balance }) => balance > 0)
    .sort((left, right) => right.balance - left.balance)
})
const recommendedDebt = computed(
  () =>
    liabilities.value.find(({ categoryId }) => categoryId === 'mortgage') ||
    liabilities.value[0] ||
    null,
)
const selectedDebt = computed(
  () =>
    liabilities.value.find(({ id }) => id === config.value.selectedLiabilityId) ||
    recommendedDebt.value,
)
const cashScenario = computed(() =>
  calculateCashScenario({
    cash: cash.value,
    currentMonthlyCost: simulation.value.monthlyCostOfLife,
    simulatedMonthlyCost: simulation.value.simulatedCostOfLife,
    currentMonthlySavings: simulation.value.currentSavingsCapacity,
    simulatedMonthlySavings: simulation.value.simulatedSavingsCapacity,
  }),
)
const investmentScenario = computed(() =>
  calculateInvestmentScenario({
    monthlyContribution: simulation.value.simulatedSavingsCapacity,
    currentMonthlyContribution: simulation.value.currentSavingsCapacity,
    annualReturnPercent: config.value.expectedAnnualReturnPercent,
  }),
)
const featuredInvestment = computed(
  () => investmentScenario.value.find(({ years }) => years === 20) || investmentScenario.value[0],
)
const cashProgress = computed(() => {
  if (!cashScenario.value) return 0
  if (cashScenario.value.achieved) return 1
  if (!(cashScenario.value.simulatedMonths > 0)) return 0
  return Math.min(1, 1 / cashScenario.value.simulatedMonths)
})
const debtScenario = computed(() =>
  calculateDebtScenario(simulation.value.simulatedSavingsCapacity),
)
const showScenarios = computed(() => simulation.value.simulatedSavingsCapacity > 0)
const breakEvenReachable = computed(
  () =>
    simulation.value.breakEvenReductionPercent != null &&
    simulation.value.breakEvenReductionPercent <= 100,
)
const customReductionSelected = computed(
  () => !reductionOptions.includes(config.value.discretionaryReductionPercent),
)
const strategy = computed(() =>
  normalizeStrategyForOptions(config.value.strategy, {
    cash: Boolean(cashScenario.value),
    debt: Boolean(selectedDebt.value),
  }),
)
const strategySummary = computed(() =>
  [
    cashScenario.value ? `${t('whatIf.cash.title')} ${strategy.value.cash}%` : null,
    `${t('whatIf.invest.title')} ${strategy.value.invest}%`,
    selectedDebt.value ? `${t('whatIf.debt.title')} ${strategy.value.debt}%` : null,
  ]
    .filter(Boolean)
    .join(' · '),
)
const cashProgressLabel = computed(() =>
  cashScenario.value.achieved
    ? t('whatIf.cash.milestoneAchieved')
    : t('whatIf.cash.monthsToMilestone', { months: cashScenario.value.simulatedMonths }),
)
const cashProgressDetail = computed(() =>
  cashScenario.value.achieved ? t('whatIf.cash.yearCovered') : t('whatIf.cash.monthlyStep'),
)

watch(workspaceId, () => prepare(), { immediate: true })

async function prepare(force = false) {
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
  persist({ discretionaryReductionPercent: percentage })
}
function openCustomReduction() {
  customReduction.value = config.value.discretionaryReductionPercent
  customReductionOpen.value = true
}
function percentageRule(value) {
  const number = Number(value)
  return (
    (Number.isFinite(number) && number >= 0 && number <= 100) || t('whatIf.validation.percentage')
  )
}
async function saveCustomReduction() {
  if (percentageRule(customReduction.value) !== true) return
  if (await persist({ discretionaryReductionPercent: Number(customReduction.value) }))
    customReductionOpen.value = false
}
async function saveStrategy(value) {
  if (await persist({ strategy: value })) strategyOpen.value = false
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;

.what-if-page {
  @include financial-page;
}

.what-if-shell {
  @include financial-shell;
  max-width: 68rem;
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
.mobile-label,
.mobile-strategy-summary {
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

.simulator-card,
.comparison-card {
  margin-top: 1.75rem;
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

.spending-label .q-icon,
.spending-summary small {
  color: var(--color-copy);
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

.reduction-options button:focus-visible,
.strategy-row:focus-visible {
  @include focus-ring;
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

.break-even {
  color: var(--color-danger);
  font-weight: 650;
}

.comparison-card {
  display: grid;
  gap: 0.9rem;
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
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
  gap: 0.75rem;
}

.scenario-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  min-height: 11.25rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: white;
  color: var(--color-ink);
  font: inherit;
  text-align: left;
  box-shadow: 0 0.15rem 0.6rem rgb(15 23 42 / 3%);
}

.scenario-heading {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.75rem;
  width: 100%;
}

.scenario-icon {
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 50%;
  font-size: 1.25rem;
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
  background: #fff2e8;
  color: #f97316;
}

.scenario-icon.strategy {
  background: var(--color-purple-soft);
  color: var(--color-purple);
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
  font-size: 0.78rem;
}

.scenario-outcome {
  display: grid;
  gap: 0.25rem;
  margin-top: auto;
  padding-top: 0.7rem;
}

.cash-outcome > strong,
.positive-comparison {
  color: var(--color-success-dark);
}

.cash-outcome .q-linear-progress {
  margin-bottom: 0.4rem;
}

.cash-outcome {
  margin-top: 0.85rem;
}

.investment-outcome {
  grid-template-columns: minmax(0, 1fr) 7.5rem;
  align-items: center;
  column-gap: 0.6rem;
}

.investment-value {
  display: grid;
  justify-items: start;
}

.investment-value strong,
.debt-outcome strong {
  color: var(--color-ink);
  font-size: 1.55rem;
  line-height: 1.1;
  letter-spacing: -0.035em;
}

.investment-chart {
  width: 100%;
  height: 3.75rem;
  overflow: visible;
}

.investment-chart path:first-of-type {
  fill: url('#what-if-chart-fill');
}

.investment-chart path:nth-of-type(2) {
  fill: none;
  stroke: var(--color-primary);
  stroke-linecap: round;
  stroke-width: 3;
}

.investment-chart circle {
  fill: var(--color-primary);
}

.investment-outcome .positive-comparison {
  grid-column: 1 / -1;
  color: var(--color-success-dark);
}

.debt-outcome {
  place-content: center;
  flex: 1;
  gap: 0.45rem;
  padding: 0.9rem 0.25rem 0.35rem;
  text-align: center;
}

.debt-outcome strong {
  color: #c75d12;
  font-size: 0.95rem;
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

.strategy-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.25rem;
  width: 100%;
  min-height: 5.25rem;
  padding: 0.9rem 1.1rem;
  border: 1px solid color-mix(in srgb, var(--color-purple) 22%, var(--color-line));
  border-radius: var(--radius-md);
  background: linear-gradient(100deg, #faf7ff, #fff);
  color: var(--color-ink);
  font: inherit;
  text-align: left;
  border-color: color-mix(in srgb, var(--color-purple) 22%, var(--color-line));
  cursor: pointer;
}

.strategy-row:hover {
  border-color: color-mix(in srgb, var(--color-purple) 42%, var(--color-line));
}

.strategy-heading,
.strategy-selection {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.strategy-selection {
  flex: 0 1 auto;
  min-width: 0;
  padding: 0.7rem 0.85rem;
  border: 1px solid color-mix(in srgb, var(--color-purple) 16%, var(--color-line));
  border-radius: 0.7rem;
  background: white;
  font-size: 0.82rem;
  white-space: nowrap;
}

.custom-card {
  @include financial-simple-dialog;
  width: min(26rem, calc(100vw - 2rem));
}

.custom-card h2 {
  margin: 0 0 1rem;
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
    gap: 0;
    overflow: hidden;
    border: 1px solid var(--color-line);
    border-radius: 0.8rem;
    background: white;
  }

  .scenario-card {
    min-height: auto;
    padding: 0.8rem;
    border: 0;
    border-bottom: 1px solid var(--color-line);
    border-radius: 0;
    box-shadow: none;
  }

  .scenario-card:last-child {
    border-bottom: 0;
  }

  .scenario-heading {
    gap: 0.7rem;
  }

  .scenario-icon {
    width: 2.6rem;
    height: 2.6rem;
  }

  .scenario-outcome {
    margin-top: 0.2rem;
    margin-left: 3.3rem;
    padding-top: 0;
  }

  .investment-chart {
    display: none;
  }

  .investment-outcome {
    display: grid;
    grid-template-columns: 1fr;
    justify-items: start;
    text-align: left;
  }

  .investment-value strong {
    font-size: 1.05rem;
  }

  .investment-value {
    display: flex;
    align-items: baseline;
    justify-items: initial;
    gap: 0.25rem;
  }

  .investment-outcome .positive-comparison {
    grid-column: auto;
  }

  .debt-outcome {
    place-content: initial;
    gap: 0.2rem;
    padding: 0;
    text-align: left;
  }

  .debt-outcome strong {
    font-size: 0.78rem;
  }

  .debt-outcome strong span {
    font-size: 1.05rem;
  }

  .strategy-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    min-height: 4.2rem;
    padding: 0.7rem 0.8rem;
    border-radius: 0.75rem;
  }

  .strategy-heading {
    gap: 0.7rem;
  }

  .strategy-description,
  .strategy-selection > span {
    display: none;
  }

  .mobile-strategy-summary {
    display: block;
  }

  .strategy-selection {
    padding: 0;
    border: 0;
    background: transparent;
  }
}
</style>
