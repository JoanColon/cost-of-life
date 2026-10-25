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
          <article
            class="metric-card metric-card--net-worth"
            :class="{ 'metric-card--negative': netWorth < 0 }"
          >
            <div class="metric-heading">
              <span class="metric-icon"><q-icon name="account_balance_wallet" /></span>
              <span>{{ t('progress.netWorth') }}</span>
            </div>
            <strong class="metric-value">{{ formatCurrency(netWorth) }}</strong>
            <div v-if="yearChangePercent !== null" class="metric-context">
              <span class="metric-change" :class="{ 'metric-change--negative': yearChange < 0 }">
                <q-icon :name="yearChange < 0 ? 'south_east' : 'north_east'" />
                {{ signedPercentage(yearChangePercent) }}
              </span>
              <small>{{ t('progress.versusStartYear') }}</small>
            </div>
            <small v-else class="metric-description">{{ t('progress.historyBuilding') }}</small>
          </article>

          <article
            class="metric-card metric-card--year-change"
            :class="{ 'metric-card--negative': yearChange < 0 }"
          >
            <div class="metric-heading">
              <span class="metric-icon metric-icon--trend">
                <q-icon name="bar_chart" />
              </span>
              <span class="metric-label metric-label--desktop">{{ t('progress.yearToDate') }}</span>
              <span class="metric-label metric-label--mobile">{{
                t('progress.yearToDateShort')
              }}</span>
            </div>
            <strong v-if="yearChange !== null" class="metric-value">
              {{ yearChange >= 0 ? '+' : '−' }}{{ formatCurrency(Math.abs(yearChange)) }}
            </strong>
            <strong v-else class="metric-value">—</strong>
            <div v-if="yearChangePercent !== null" class="metric-context">
              <span class="metric-change" :class="{ 'metric-change--negative': yearChange < 0 }">
                <q-icon :name="yearChange < 0 ? 'south_east' : 'north_east'" />
                {{ signedPercentage(yearChangePercent) }}
              </span>
              <small>{{ t('progress.sinceJanuary', { year: currentYear }) }}</small>
            </div>
            <small v-else class="metric-description">{{ t('progress.historyBuilding') }}</small>
          </article>

          <article
            class="metric-card metric-card--savings"
            :class="{ 'metric-card--negative': annualSavings < 0 }"
          >
            <div class="metric-heading">
              <span class="metric-icon metric-icon--savings"><q-icon name="savings" /></span>
              <span>{{ t('progress.savingsRate') }}</span>
            </div>
            <strong class="metric-value">{{ savingsRate }}%</strong>
            <div class="metric-context metric-context--savings">
              <span>{{ formatCurrency(monthlySavings) }}{{ t('whatIf.perMonth') }}</span>
              <small>{{ t('progress.savingsCapacity') }}</small>
            </div>
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
import { calculateMilestoneProgress } from '@/domain/milestones/calculations'
import {
  financialYearAvailableIncomeValue,
  financialYearMonthValue,
  financialYearValue,
} from '@/domain/financial/financial-year'
import { authUser } from '@/services/auth'
import { useFinancialScopeStore } from '@/stores/financial-scope-store'
import { useMilestonesStore } from '@/stores/milestones-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { formatCurrency } from '@/utils/formatters'
import { getWorkspaceMembers } from '@/utils/workspace-members'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const milestonesStore = useMilestonesStore()
const scopeStore = useFinancialScopeStore()
const workspaceStore = useWorkspaceStore()
const chartMode = ref('netWorth')
const {
  currentMonth,
  currentYear,
  achievements,
  error,
  financialYear,
  historyDocuments,
  historyError,
  historyLoading,
  loading,
  trackingActive,
} = storeToRefs(milestonesStore)

const workspaceId = computed(() => String(route.params.workspaceId))
const workspace = computed(
  () => workspaceStore.workspaces.find(({ id }) => id === workspaceId.value) || null,
)
const members = computed(() => getWorkspaceMembers(workspace.value, authUser.value))
const memberIds = computed(() => members.value.map(({ id }) => id))
const selectedMemberId = computed(() =>
  scopeStore.get(workspaceId.value, memberIds.value, authUser.value?.uid),
)
const homeRoute = computed(() => ({
  name: 'workspace-dashboard',
  params: { workspaceId: workspaceId.value },
}))
const netWorth = computed(() =>
  financialYearMonthValue(
    financialYear.value,
    currentMonth.value,
    'netWorth',
    selectedMemberId.value,
  ),
)
const availableIncome = computed(() =>
  financialYearAvailableIncomeValue(financialYear.value, selectedMemberId.value),
)
const annualSavings = computed(
  () =>
    availableIncome.value -
    financialYearValue(financialYear.value, 'expenses', selectedMemberId.value),
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
  memberId: selectedMemberId.value,
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
const yearChangePercent = computed(() => {
  if (yearChange.value === null || currentYearPoints.value.length < 2) return null
  const startingValue = currentYearPoints.value[0].value
  if (!Number.isFinite(startingValue) || startingValue === 0) return null
  return (yearChange.value / Math.abs(startingValue)) * 100
})
const progress = computed(() =>
  calculateMilestoneProgress({
    financialYear: financialYear.value,
    financialHistory: historyDocuments.value,
    achievements: trackingActive.value ? achievements.value : [],
    month: currentMonth.value,
    memberId: selectedMemberId.value,
  }),
)

watch(workspaceId, () => load(), { immediate: true })

function load(force = false) {
  return milestonesStore.load(workspaceId.value, force)
}

function openAchievements() {
  router.push({ name: 'achievements', params: { workspaceId: workspaceId.value } })
}

function signedPercentage(value) {
  const rounded = Math.round(Math.abs(value))
  return `${value >= 0 ? '+' : '−'}${rounded}%`
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
  gap: 1.25rem;
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
  --metric-color: var(--color-primary);
  --metric-soft: var(--color-blue-soft);
  display: flex;
  min-width: 0;
  min-height: 15rem;
  flex-direction: column;
  padding: 1.5rem;
  overflow: hidden;
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--metric-soft) 32%, var(--color-surface)),
    var(--color-surface) 70%
  );
}

.metric-card--year-change {
  --metric-color: var(--color-success);
  --metric-soft: var(--color-green-soft);
}

.metric-card--savings {
  --metric-color: var(--color-purple);
  --metric-soft: var(--color-purple-soft);
}

.metric-heading {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  color: var(--color-copy);
  font-size: 0.95rem;
  font-weight: 750;
}

.metric-label--mobile {
  display: none;
}

.metric-icon {
  display: grid;
  width: 3rem;
  height: 3rem;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--metric-soft);
  color: var(--metric-color);
  font-size: 1.35rem;
}

.metric-value {
  margin-top: 1.55rem;
  overflow: hidden;
  color: var(--color-ink);
  font-size: clamp(2.3rem, 4vw, 3.35rem);
  line-height: 1;
  letter-spacing: -0.05em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-context {
  display: flex;
  min-height: 2.4rem;
  align-items: baseline;
  gap: 0.75rem;
  margin-top: 1.25rem;
  flex-wrap: wrap;
}

.metric-context small,
.metric-description {
  color: var(--color-copy);
  font-size: 0.9rem;
  line-height: 1.4;
}

.metric-description {
  margin-top: 1.25rem;
}

.metric-change {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--color-success);
  font-size: 1.25rem;
  font-weight: 800;
}

.metric-change .q-icon {
  font-size: 1.45rem;
}

.metric-change--negative,
.metric-card--negative .metric-value {
  color: var(--color-danger);
}

.metric-card--negative .metric-icon--trend {
  background: var(--color-red-soft);
  color: var(--color-danger);
}

.metric-context--savings {
  display: grid;
  gap: 0.2rem;
}

.metric-context--savings > span {
  color: var(--color-ink);
  font-size: 1.15rem;
  font-weight: 750;
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

@media (max-width: 599px) {
  .metric-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.45rem;
    margin-top: 1rem;
  }

  .metric-card--net-worth {
    grid-column: auto;
  }

  .metric-card {
    min-height: 9.25rem;
    padding: 0.65rem 0.6rem;
  }

  .metric-icon {
    width: 2rem;
    height: 2rem;
    font-size: 0.95rem;
  }

  .metric-heading {
    align-items: flex-start;
    gap: 0.4rem;
    font-size: 0.68rem;
    line-height: 1.15;
  }

  .metric-label--desktop {
    display: none;
  }

  .metric-label--mobile {
    display: inline;
  }

  .metric-value {
    margin-top: 0.65rem;
    overflow: visible;
    font-size: clamp(1rem, 4.8vw, 1.4rem);
    letter-spacing: -0.04em;
    text-overflow: clip;
  }

  .metric-context,
  .metric-description {
    margin-top: 0.45rem;
  }

  .metric-context {
    display: grid;
    min-height: 0;
    gap: 0.15rem;
  }

  .metric-change {
    gap: 0.15rem;
    font-size: 0.86rem;
  }

  .metric-change .q-icon {
    font-size: 1rem;
  }

  .metric-context small,
  .metric-description {
    font-size: 0.62rem;
    line-height: 1.25;
  }

  .metric-context--savings > span {
    font-size: 0.72rem;
    line-height: 1.2;
  }

  .history-card {
    margin-top: 0.6rem;
    padding: 0.8rem;
  }

  .section-heading {
    align-items: flex-end;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .section-eyebrow {
    font-size: 0.62rem;
  }

  .section-heading h2 {
    margin-top: 0.05rem;
    font-size: 1.1rem;
  }

  .view-switch button {
    min-width: 4rem;
    padding: 0.3rem 0.4rem;
    font-size: 0.64rem;
  }

  .history-card :deep(.chart-shell),
  .history-card :deep(.net-worth-chart) {
    min-height: 11rem;
    height: 11rem;
  }

  .milestone-summary {
    margin-top: 0.6rem;
  }
}
</style>
