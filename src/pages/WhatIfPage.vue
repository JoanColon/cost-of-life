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
          <div>
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
            <h1>{{ t('whatIf.title') }}</h1>
            <p>{{ t('whatIf.subtitle') }}</p>
          </div>
        </header>

        <section class="simulator-card">
          <div class="spending-summary">
            <div>
              <div class="spending-line">
                <span>{{ t('whatIf.discretionary.title') }}</span>
                <strong
                  >{{ formatCurrency(simulation.monthlyDiscretionary)
                  }}{{ t('whatIf.perMonth') }}</strong
                >
              </div>
              <small>{{ t('whatIf.discretionary.description') }}</small>
            </div>
          </div>

          <div class="reduction-section">
            <span>{{ t('whatIf.reduction.title') }}</span>
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
              :name="simulation.simulatedSavingsCapacity < 0 ? 'trending_down' : 'trending_up'"
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
                {{
                  t('whatIf.compare.title', {
                    amount: formatCurrency(simulation.simulatedSavingsCapacity),
                  })
                }}
              </h2>
              <p>{{ t('whatIf.compare.description') }}</p>
            </div>
            <q-btn
              flat
              dense
              no-caps
              icon="tune"
              :label="t('whatIf.details.action')"
              @click="detailsOpen = true"
            />
          </div>

          <article v-if="cashScenario" class="scenario-row">
            <span class="scenario-icon cash"><q-icon name="account_balance" /></span>
            <div class="scenario-copy">
              <strong>{{ t('whatIf.cash.title') }}</strong>
              <span>{{ cashSummary }}</span>
            </div>
            <div class="scenario-value">
              <strong>{{ t('whatIf.cash.target', { months: cashScenario.targetMonths }) }}</strong>
              <small>{{ cashComparison }}</small>
            </div>
          </article>

          <article class="scenario-row investment-row">
            <span class="scenario-icon invest"><q-icon name="show_chart" /></span>
            <div class="scenario-copy">
              <strong>{{ t('whatIf.invest.title') }}</strong>
              <span>{{
                t('whatIf.invest.description', { return: config.expectedAnnualReturnPercent })
              }}</span>
            </div>
            <div class="projection-list">
              <div v-for="projection in investmentScenario" :key="projection.years">
                <span>{{ projection.years }} {{ t('whatIf.years') }}</span>
                <strong>{{ formatCurrency(projection.projectedValue) }}</strong>
                <small>{{
                  t('whatIf.invest.difference', {
                    amount: formatCurrency(projection.difference),
                  })
                }}</small>
              </div>
            </div>
          </article>

          <article v-if="selectedDebt" class="scenario-row">
            <span class="scenario-icon debt"><q-icon name="credit_score" /></span>
            <div class="scenario-copy">
              <strong>{{ t('whatIf.debt.title') }}</strong>
              <span>{{ selectedDebt.name }}</span>
            </div>
            <div class="scenario-value">
              <strong>{{
                t('whatIf.debt.perMonthExtra', {
                  amount: formatCurrency(debtScenario.monthly),
                })
              }}</strong>
              <small>{{
                t('whatIf.debt.perYear', { amount: formatCurrency(debtScenario.annual) })
              }}</small>
            </div>
          </article>

          <button type="button" class="strategy-row" @click="strategyOpen = true">
            <span class="scenario-icon strategy"><q-icon name="donut_small" /></span>
            <span class="scenario-copy">
              <strong>{{ t('whatIf.strategy.title') }}</strong>
              <span>{{ strategySummary }}</span>
            </span>
            <q-icon name="chevron_right" />
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
    <q-dialog v-model="detailsOpen">
      <ScenarioDetailsDialog
        :expected-annual-return-percent="config.expectedAnnualReturnPercent"
        :selected-liability-id="selectedDebt?.id || null"
        :liabilities="liabilities"
        @save="saveDetails"
        @cancel="detailsOpen = false"
      />
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
import ScenarioDetailsDialog from '@/components/what-if/ScenarioDetailsDialog.vue'
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
const detailsOpen = ref(false)
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
const cashSummary = computed(() => {
  if (cashScenario.value.simulatedMonths === 0) return t('whatIf.cash.alreadyReached')
  return t('whatIf.cash.reachIn', {
    months: cashScenario.value.simulatedMonths,
    target: cashScenario.value.targetMonths,
  })
})
const cashComparison = computed(() => {
  if (cashScenario.value.currentMonths == null) return t('whatIf.cash.unreachableToday')
  return t('whatIf.cash.sooner', { months: cashScenario.value.monthsSooner })
})

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
async function saveDetails(value) {
  if (await persist(value)) detailsOpen.value = false
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
  max-width: 52rem;
}
.page-header {
  @include financial-header;
}
.back-button {
  @include financial-back-button;
}
h1 {
  @include financial-title;
}
.page-header p,
.comparison-heading p {
  margin: 0.45rem 0 0;
  color: var(--color-copy);
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
  margin-top: 1.25rem;
}
.simulator-card {
  padding: clamp(1rem, 3vw, 1.6rem);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}
.spending-summary {
  display: block;
}
.spending-summary div {
  display: grid;
}
.spending-summary .spending-line {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}
.spending-summary span,
.spending-summary small,
.reduction-section > span {
  color: var(--color-copy);
}
.spending-summary strong {
  color: var(--color-ink);
  font-size: 1.05rem;
  white-space: nowrap;
}
.reduction-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 1rem;
  padding-top: 0.85rem;
  border-top: 1px solid var(--color-line);
}
.reduction-options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}
.reduction-options button {
  min-width: 3.75rem;
  padding: 0.45rem 0.7rem;
  border: 1px solid var(--color-line);
  border-radius: 0.65rem;
  background: white;
  color: var(--color-ink);
  font-weight: 700;
  cursor: pointer;
}
.reduction-options button.selected {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: white;
  box-shadow: 0 0.3rem 0.75rem rgb(31 111 235 / 20%);
}
.main-result {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 1.25rem;
  padding: 1.25rem;
  border-radius: var(--radius-md);
  background: linear-gradient(120deg, var(--color-green-soft), rgb(240 251 246));
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
  font-size: 2.25rem;
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
  gap: 0.7rem;
}
.comparison-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 0 0.15rem 0.2rem;
}
.comparison-heading h2,
.comparison-heading p {
  margin-top: 0;
  margin-bottom: 0;
}
.comparison-heading h2 {
  font-size: clamp(1.35rem, 4vw, 1.75rem);
  line-height: 1.15;
  letter-spacing: -0.025em;
}
.scenario-row,
.strategy-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.9rem;
  width: 100%;
  min-height: 5.25rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: white;
  color: var(--color-ink);
  text-align: left;
  box-shadow: 0 0.15rem 0.6rem rgb(15 23 42 / 3%);
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
  background: var(--color-red-soft);
  color: var(--color-danger);
}
.scenario-icon.strategy {
  background: var(--color-purple-soft);
  color: var(--color-purple);
}
.scenario-copy {
  display: grid;
  min-width: 0;
}
.scenario-copy span,
.scenario-value small,
.projection-list span,
.projection-list small {
  color: var(--color-copy);
  font-size: 0.78rem;
}
.scenario-value {
  display: grid;
  justify-items: end;
  text-align: right;
}
.projection-list {
  display: flex;
  gap: 1rem;
}
.projection-list div {
  display: grid;
  justify-items: end;
}
.projection-list small {
  color: var(--color-success-dark);
}
.strategy-row {
  margin-top: 0.3rem;
  border-color: color-mix(in srgb, var(--color-purple) 22%, var(--color-line));
  cursor: pointer;
}
.strategy-row:hover {
  background: var(--color-surface-soft);
}
.custom-card {
  @include financial-simple-dialog;
  width: min(26rem, calc(100vw - 2rem));
}
.custom-card h2 {
  margin: 0 0 1rem;
}
@media (max-width: 650px) {
  .what-if-shell {
    max-width: 34rem;
  }
  .page-header p {
    max-width: 28rem;
  }
  .simulator-card,
  .comparison-card {
    margin-top: 1rem;
  }
  .reduction-section {
    display: grid;
    gap: 0.55rem;
  }
  .reduction-options {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 0.35rem;
  }
  .reduction-options button {
    min-width: 0;
    padding: 0.45rem 0.25rem;
    font-size: 0.78rem;
  }
  .main-result {
    padding: 1rem;
  }
  .scenario-row,
  .strategy-row {
    grid-template-columns: auto minmax(0, 1fr) auto;
    padding: 0.75rem;
  }
  .scenario-value,
  .projection-list {
    grid-column: 2 / -1;
    justify-self: stretch;
  }
  .projection-list {
    justify-content: space-between;
    gap: 0.35rem;
  }
  .investment-row .scenario-copy {
    grid-column: 2 / -1;
  }
  .comparison-heading {
    align-items: center;
    padding: 0 0.1rem 0.15rem;
  }
  .comparison-heading p {
    display: none;
  }
}
</style>
