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
        <section class="metric-grid">
          <article class="metric-card">
            <span>{{ t('progress.netWorth') }}</span>
            <strong>{{ formatCurrency(netWorth) }}</strong>
            <small v-if="yearChange !== null" :class="{ negative: yearChange < 0 }">
              <q-icon :name="yearChange < 0 ? 'south_east' : 'north_east'" />
              {{ formatCurrency(Math.abs(yearChange)) }} {{ t('progress.thisYear') }}
            </small>
            <small v-else>{{ t('progress.historyBuilding') }}</small>
          </article>
          <article class="metric-card">
            <span>{{ t('progress.savingsRate') }}</span>
            <strong>{{ savingsRate }}%</strong>
            <small>{{ formatCurrency(monthlySavings) }}{{ t('whatIf.perMonth') }}</small>
          </article>
        </section>

        <section class="progress-grid">
          <router-link :to="{ name: 'achievements', params: { workspaceId } }" class="summary-card">
            <div class="summary-heading">
              <span class="summary-icon milestone"><q-icon name="flag" /></span>
              <span
                ><small>{{ t('progress.milestones') }}</small
                ><strong>{{ t('progress.achievedCount', { count: achievedCount }) }}</strong></span
              >
              <q-icon name="arrow_forward" />
            </div>
            <div v-if="nextMilestone" class="next-milestone">
              <span>{{ t('progress.nextMilestone') }}</span>
              <strong>{{ t(`milestones.items.${nextMilestone.id}`) }}</strong>
              <q-linear-progress
                rounded
                size="0.65rem"
                color="primary"
                track-color="grey-3"
                :value="nextMilestone.progress"
              />
              <small>{{ Math.round(nextMilestone.progress * 100) }}%</small>
            </div>
            <p v-else>{{ t('progress.noNextMilestone') }}</p>
          </router-link>

          <router-link :to="{ name: 'historic', params: { workspaceId } }" class="summary-card">
            <div class="summary-heading">
              <span class="summary-icon history"><q-icon name="history" /></span>
              <span
                ><small>{{ t('progress.history') }}</small
                ><strong>{{ t('progress.historyTitle') }}</strong></span
              >
              <q-icon name="arrow_forward" />
            </div>
            <p>{{ historySummary }}</p>
          </router-link>
        </section>

        <section v-if="recentAchievements.length" class="recent-section">
          <div class="section-heading">
            <h2>{{ t('progress.recentAchievements') }}</h2>
            <q-btn
              flat
              no-caps
              color="primary"
              :label="t('progress.viewAll')"
              :to="{ name: 'achievements', params: { workspaceId } }"
            />
          </div>
          <div class="achievement-list">
            <div v-for="achievement in recentAchievements" :key="achievement.milestoneId">
              <q-icon name="check_circle" />
              <span>{{ t(`milestones.items.${achievement.milestoneId}`) }}</span>
              <small>{{ achievementDate(achievement) }}</small>
            </div>
          </div>
        </section>
      </template>
    </main>
  </q-page>
</template>

<script setup>
import { computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { buildNetWorthSeries } from '@/domain/financial/history'
import {
  financialYearAvailableIncomeValue,
  financialYearMonthValue,
  financialYearValue,
} from '@/domain/financial/financial-year'
import { useMilestonesStore } from '@/stores/milestones-store'
import { formatCurrency } from '@/utils/formatters'

const { t, locale } = useI18n()
const route = useRoute()
const milestonesStore = useMilestonesStore()
const {
  achievements,
  currentMonth,
  currentYear,
  error,
  financialYear,
  historyDocuments,
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
const historyPoints = computed(() =>
  buildNetWorthSeries(
    [
      ...historyDocuments.value.filter(
        (document) => Number(document.year || document.id) !== currentYear.value,
      ),
      ...(financialYear.value ? [financialYear.value] : []),
    ],
    { throughPeriod: `${currentYear.value}-${currentMonth.value}` },
  ),
)
const currentYearPoints = computed(() =>
  historyPoints.value.filter(({ period }) => period.startsWith(`${currentYear.value}-`)),
)
const yearChange = computed(() =>
  currentYearPoints.value.length > 1
    ? currentYearPoints.value.at(-1).value - currentYearPoints.value[0].value
    : null,
)
const visibleMilestones = computed(() =>
  progress.value.filter(
    (item) => item.family !== 'debt' || item.relevant || item.previouslyAchieved,
  ),
)
const achievedCount = computed(
  () =>
    visibleMilestones.value.filter((item) =>
      trackingActive.value ? item.previouslyAchieved : item.reached,
    ).length,
)
const nextMilestone = computed(
  () =>
    visibleMilestones.value.find((item) =>
      trackingActive.value ? !item.previouslyAchieved : !item.reached,
    ) || null,
)
const recentAchievements = computed(() =>
  [...achievements.value]
    .filter(({ status }) => !status || status === 'achieved')
    .sort((a, b) => achievementTime(b) - achievementTime(a))
    .slice(0, 3),
)
const historySummary = computed(() =>
  historyPoints.value.length
    ? t('progress.historyPeriods', { count: historyPoints.value.length })
    : t('progress.historyEmpty'),
)

watch(workspaceId, () => load(), { immediate: true })

function load(force = false) {
  return milestonesStore.load(workspaceId.value, force)
}
function achievementTime(achievement) {
  const value = achievement.achievedAt
  const date = typeof value?.toDate === 'function' ? value.toDate() : value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0
}
function achievementDate(achievement) {
  const timestamp = achievementTime(achievement)
  return timestamp
    ? new Intl.DateTimeFormat(locale.value, { month: 'short', year: 'numeric' }).format(
        new Date(timestamp),
      )
    : ''
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
.metric-grid,
.progress-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  margin-top: 2rem;
}
.metric-card,
.summary-card,
.recent-section {
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}
.metric-card {
  display: grid;
  gap: 0.35rem;
  padding: 1.5rem;
}
.metric-card > span {
  color: var(--color-copy);
}
.metric-card strong {
  font-size: clamp(2.2rem, 5vw, 3.5rem);
  line-height: 1;
  letter-spacing: -0.05em;
}
.metric-card small {
  color: var(--color-success-dark);
}
.metric-card small.negative {
  color: var(--color-danger);
}
.summary-card {
  padding: 1.35rem;
  color: var(--color-ink);
  text-decoration: none;
}
.summary-card:hover {
  border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-line));
}
.summary-heading {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.8rem;
}
.summary-heading > span:nth-child(2) {
  display: grid;
}
.summary-heading small {
  color: var(--color-copy);
  font-size: 0.72rem;
  font-weight: 750;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}
.summary-heading strong {
  margin-top: 0.15rem;
  font-size: 1.15rem;
}
.summary-icon {
  display: grid;
  place-items: center;
  width: 2.8rem;
  height: 2.8rem;
  border-radius: 50%;
  font-size: 1.25rem;
}
.summary-icon.milestone {
  background: var(--color-purple-soft);
  color: var(--color-purple);
}
.summary-icon.history {
  background: var(--color-blue-soft);
  color: var(--color-primary);
}
.next-milestone {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.4rem 0.75rem;
  margin-top: 1.35rem;
}
.next-milestone > span {
  grid-column: 1 / -1;
  color: var(--color-copy);
  font-size: 0.78rem;
}
.next-milestone .q-linear-progress {
  grid-column: 1;
  align-self: center;
}
.next-milestone small {
  grid-column: 2;
  grid-row: 2 / 4;
  align-self: end;
  color: var(--color-copy);
}
.summary-card > p {
  margin: 1.35rem 0 0;
  color: var(--color-copy);
}
.recent-section {
  margin-top: 1rem;
  padding: 1.35rem;
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.section-heading h2 {
  margin: 0;
  font-size: 1.2rem;
}
.achievement-list {
  margin-top: 0.75rem;
}
.achievement-list > div {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.7rem;
  padding: 0.75rem 0;
  border-top: 1px solid var(--color-line);
}
.achievement-list .q-icon {
  color: var(--color-success-dark);
}
.achievement-list small {
  color: var(--color-copy);
}
.state {
  display: grid;
  place-items: center;
  min-height: 20rem;
  gap: 0.75rem;
}
@media (max-width: 700px) {
  .metric-grid,
  .progress-grid {
    grid-template-columns: 1fr;
    margin-top: 1rem;
  }
}
</style>
