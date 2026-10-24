<template>
  <q-page class="progress-page">
    <main class="progress-shell">
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
          <h1>{{ t('progress.title') }}</h1>
          <p>{{ t('progress.subtitle') }}</p>
        </div>
      </header>

      <div v-if="loading && !financialYear" class="state">
        <q-spinner color="primary" size="2rem" />
        <span>{{ t('progress.loading') }}</span>
      </div>
      <section v-else-if="error && !financialYear" class="state">
        <q-icon name="cloud_off" size="2rem" />
        <p>{{ t('progress.error') }}</p>
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
        <section class="metric-grid" :aria-label="t('progress.keyMetrics')">
          <article class="metric-card metric-card--net-worth">
            <div class="metric-heading">
              <span class="metric-icon"><q-icon name="account_balance_wallet" /></span>
              <span>{{ t('progress.netWorth') }}</span>
            </div>
            <strong>{{ formatCurrency(netWorth) }}</strong>
            <small>{{ t('progress.netWorthDescription') }}</small>
          </article>

          <article class="metric-card" :class="{ 'metric-card--negative': yearChange < 0 }">
            <div class="metric-heading">
              <span class="metric-icon metric-icon--trend">
                <q-icon
                  :name="yearChange != null && yearChange < 0 ? 'south_east' : 'north_east'"
                />
              </span>
              <span>{{ t('progress.yearToDate') }}</span>
            </div>
            <strong v-if="yearChange !== null">
              {{ yearChange >= 0 ? '+' : '−' }}{{ formatCurrency(Math.abs(yearChange)) }}
            </strong>
            <strong v-else>—</strong>
            <small>{{
              yearChange === null ? t('progress.historyBuilding') : t('progress.netWorthChange')
            }}</small>
          </article>

          <article class="metric-card" :class="{ 'metric-card--negative': annualSavings < 0 }">
            <div class="metric-heading">
              <span class="metric-icon metric-icon--savings"><q-icon name="savings" /></span>
              <span>{{ t('progress.savingsRate') }}</span>
            </div>
            <strong>{{ savingsRate }}%</strong>
            <small>
              {{ formatCurrency(monthlySavings) }}{{ t('whatIf.perMonth') }}
              {{ t('progress.savingsCapacity') }}
            </small>
          </article>
        </section>

        <section class="history-card">
          <div class="section-heading">
            <div>
              <span class="section-eyebrow">{{ t('progress.history') }}</span>
              <h2>{{ t('progress.netWorthHistory') }}</h2>
            </div>
            <div class="view-switch" role="group" :aria-label="t('progress.chartView.label')">
              <button
                type="button"
                :class="{ selected: chartMode === 'netWorth' }"
                :aria-pressed="chartMode === 'netWorth'"
                @click="chartMode = 'netWorth'"
              >
                {{ t('progress.chartView.netWorth') }}
              </button>
              <button
                type="button"
                :class="{ selected: chartMode === 'breakdown' }"
                :aria-pressed="chartMode === 'breakdown'"
                @click="chartMode = 'breakdown'"
              >
                {{ t('progress.chartView.breakdown') }}
              </button>
            </div>
          </div>

          <NetWorthHistoryChart
            :points="historyPoints"
            :breakdown-points="historyBreakdownPoints"
            :mode="chartMode"
            :loading="historyLoading"
            :error="Boolean(historyError)"
          />
        </section>

        <MilestoneSummaryCard
          class="milestone-summary"
          :milestones="progress"
          :tracking-active="trackingActive"
          :loading="loading"
          :error="Boolean(error)"
          @open="openAchievements"
        />
      </template>
    </main>
  </q-page>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import MilestoneSummaryCard from '@/components/dashboard/MilestoneSummaryCard.vue'
import NetWorthHistoryChart from '@/components/dashboard/NetWorthHistoryChart.vue'
import { buildNetWorthBreakdownSeries, buildNetWorthSeries } from '@/domain/financial/history'
import {
  financialYearAvailableIncomeValue,
  financialYearMonthValue,
  financialYearValue,
} from '@/domain/financial/financial-year'
import { useMilestonesStore } from '@/stores/milestones-store'
import { formatCurrency } from '@/utils/formatters'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const milestonesStore = useMilestonesStore()
const chartMode = ref('netWorth')
const {
  currentMonth,
  currentYear,
  error,
  financialYear,
  historyDocuments,
  historyError,
  historyLoading,
  loading,
  progress,
  trackingActive,
} = storeToRefs(milestonesStore)

const workspaceId = computed(() => String(route.params.workspaceId))
const homeRoute = computed(() => ({
  name: 'workspace-dashboard',
  params: { workspaceId: workspaceId.value },
}))
const netWorth = computed(() =>
  financialYearMonthValue(financialYear.value, currentMonth.value, 'netWorth'),
)
const availableIncome = computed(() => financialYearAvailableIncomeValue(financialYear.value))
const annualSavings = computed(
  () => availableIncome.value - financialYearValue(financialYear.value, 'expenses'),
)
const monthlySavings = computed(() => annualSavings.value / 12)
const savingsRate = computed(() =>
  availableIncome.value > 0 ? Math.round((annualSavings.value / availableIncome.value) * 100) : 0,
)
const completeHistoryDocuments = computed(() => [
  ...historyDocuments.value.filter(
    (document) => Number(document.year || document.id) !== currentYear.value,
  ),
  ...(financialYear.value ? [financialYear.value] : []),
])
const historyOptions = computed(() => ({
  throughPeriod: `${currentYear.value}-${currentMonth.value}`,
}))
const historyPoints = computed(() =>
  buildNetWorthSeries(completeHistoryDocuments.value, historyOptions.value),
)
const historyBreakdownPoints = computed(() =>
  buildNetWorthBreakdownSeries(completeHistoryDocuments.value, historyOptions.value),
)
const currentYearPoints = computed(() =>
  historyPoints.value.filter(({ period }) => period.startsWith(`${currentYear.value}-`)),
)
const yearChange = computed(() =>
  currentYearPoints.value.length > 1
    ? currentYearPoints.value.at(-1).value - currentYearPoints.value[0].value
    : null,
)

watch(workspaceId, () => load(), { immediate: true })

function load(force = false) {
  return milestonesStore.load(workspaceId.value, force)
}

function openAchievements() {
  router.push({ name: 'achievements', params: { workspaceId: workspaceId.value } })
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;

.progress-page {
  @include financial-page;
}

.progress-shell {
  @include financial-shell;
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
.state {
  color: var(--color-copy);
}

.page-header p {
  margin: 0.5rem 0 0;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  margin-top: 2rem;
}

.metric-card,
.history-card {
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.metric-card {
  display: flex;
  min-width: 0;
  min-height: 11rem;
  flex-direction: column;
  padding: 1.35rem;
}

.metric-heading {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  color: var(--color-copy);
  font-size: 0.83rem;
  font-weight: 700;
}

.metric-icon {
  display: grid;
  width: 2.35rem;
  height: 2.35rem;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--color-blue-soft);
  color: var(--color-primary);
  font-size: 1.08rem;
}

.metric-icon--trend {
  background: var(--color-green-soft);
  color: var(--color-success-dark);
}

.metric-icon--savings {
  background: var(--color-purple-soft);
  color: var(--color-purple);
}

.metric-card strong {
  margin-top: 1rem;
  overflow: hidden;
  color: var(--color-ink);
  font-size: clamp(2rem, 4vw, 3rem);
  line-height: 1;
  letter-spacing: -0.05em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-card small {
  margin-top: auto;
  padding-top: 0.65rem;
  color: var(--color-copy);
  font-size: 0.78rem;
  line-height: 1.4;
}

.metric-card--negative strong {
  color: var(--color-danger);
}

.metric-card--negative .metric-icon--trend {
  background: var(--color-red-soft);
  color: var(--color-danger);
}

.history-card {
  margin-top: 1rem;
  padding: 1.5rem;
}

.section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.section-heading > div {
  min-width: 0;
}

.section-eyebrow {
  color: var(--color-primary);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.section-heading h2 {
  margin: 0.15rem 0 0;
  font-size: 1.35rem;
  letter-spacing: -0.02em;
}

.view-switch {
  display: flex;
  padding: 0.2rem;
  border: 1px solid var(--color-line);
  border-radius: 999px;
  background: var(--color-surface-soft);
}

.view-switch button {
  min-width: 5.5rem;
  padding: 0.42rem 0.72rem;
  border: 0;
  border-radius: 999px !important;
  background: transparent;
  color: var(--color-copy);
  font-size: 0.76rem;
  font-weight: 700;
  cursor: pointer;
}

.view-switch button.selected {
  background: var(--color-ink);
  color: white;
  box-shadow: 0 2px 8px rgb(24 43 68 / 12%);
}

.view-switch button:focus-visible {
  @include focus-ring;
}

.milestone-summary {
  margin-top: 1rem;
}

.state {
  display: grid;
  min-height: 20rem;
  place-items: center;
  gap: 0.75rem;
}

@media (min-width: 801px) {
  .history-card :deep(.chart-shell),
  .history-card :deep(.net-worth-chart) {
    min-height: 19rem;
    height: 19rem;
  }
}

@media (max-width: 800px) {
  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .metric-card--net-worth {
    grid-column: 1 / -1;
  }
}

@media (max-width: 599px) {
  .metric-grid {
    grid-template-columns: 1fr;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .metric-card--net-worth {
    grid-column: auto;
  }

  .metric-card {
    min-height: 8.75rem;
    padding: 1rem;
  }

  .metric-card strong {
    margin-top: 0.7rem;
    font-size: 2rem;
  }

  .history-card {
    margin-top: 0.75rem;
    padding: 1rem;
  }

  .section-heading {
    display: grid;
  }

  .view-switch button {
    min-width: 4.8rem;
    padding: 0.38rem 0.55rem;
    font-size: 0.7rem;
  }

  .history-card :deep(.chart-shell),
  .history-card :deep(.net-worth-chart) {
    min-height: 14rem;
    height: 14rem;
  }

  .milestone-summary {
    margin-top: 0.75rem;
  }
}
</style>
