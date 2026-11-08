<template>
  <q-page class="progress-page">
    <main class="progress-shell">
      <AppPageHeader
        :title="t('progress.title')"
        :subtitle="t('progress.subtitle')"
        :back-label="t('navigation.backToWorkspaceHome')"
        :back-to="homeRoute"
      >
        <template #actions>
          <div class="progress-filters">
            <div class="period-switch" role="group" :aria-label="t('progress.filters.period')">
              <button
                v-for="option in periodOptions"
                :key="option.value"
                type="button"
                :class="{ selected: selectedPeriod === option.value }"
                :aria-pressed="selectedPeriod === option.value"
                @click="selectPeriod(option.value)"
              >
                {{ option.label }}
              </button>
            </div>

            <q-btn
              outline
              no-caps
              icon="calendar_month"
              class="date-filter"
              :label="rangeLabel"
              :aria-label="t('progress.filters.date')"
            >
              <q-icon name="expand_more" class="date-filter__chevron" />
              <q-menu anchor="bottom right" self="top right" class="snapshot-menu">
                <div class="snapshot-menu__heading">{{ t('progress.filters.chooseSnapshot') }}</div>
                <q-list dense>
                  <q-item
                    v-for="point in availableStartPoints"
                    :key="point.period"
                    clickable
                    v-close-popup
                    :active="startPoint?.period === point.period"
                    active-class="snapshot-menu__active"
                    @click="selectStartPeriod(point.period)"
                  >
                    <q-item-section>{{ formatPeriod(point.period) }}</q-item-section>
                    <q-item-section side><q-icon name="chevron_right" /></q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-btn>
          </div>
        </template>
      </AppPageHeader>

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

      <section v-else-if="!hasComparison" class="empty-story">
        <span class="story-number">1</span>
        <div>
          <h2>{{ t('progress.empty.title') }}</h2>
          <p>{{ t('progress.empty.description') }}</p>
        </div>
      </section>

      <div v-else class="story-stack">
        <article class="story-card transformation-card">
          <div class="story-intro">
            <span class="story-number story-number--green">1</span>
            <div>
              <h2>{{ t('progress.transformation.title') }}</h2>
              <p>{{ t('progress.transformation.description') }}</p>
            </div>
          </div>

          <div class="transformation-content">
            <div class="comparison-grid">
              <div
                v-for="row in transformationRows"
                :key="row.key"
                class="comparison-card"
                :class="[
                  `comparison-card--${row.tone}`,
                  { 'comparison-card--open': activeDetail === row.key },
                ]"
                role="button"
                tabindex="0"
                :aria-expanded="activeDetail === row.key"
                @click="toggleDetail(row.key)"
                @keydown.enter.prevent="toggleDetail(row.key)"
                @keydown.space.prevent="toggleDetail(row.key)"
              >
                <span class="comparison-card__heading">
                  <span class="metric-name">
                    <span class="metric-icon" :class="`metric-icon--${row.tone}`">
                      <q-icon :name="row.icon" />
                    </span>
                    <strong>{{ row.label }}</strong>
                    <q-btn
                      v-if="row.key === 'yearsFunded'"
                      flat
                      round
                      dense
                      size="sm"
                      icon="info_outline"
                      class="years-funded-info"
                      :aria-label="t('progress.freedom.infoAction')"
                      @click.stop="openYearsFundedInfo"
                      @keydown.stop
                    >
                      <q-tooltip v-if="$q.screen.gt.xs" max-width="24rem">
                        <div class="years-funded-tooltip">
                          <strong>{{ t('progress.freedom.infoTitle') }}</strong>
                          <span>{{ t('progress.freedom.infoSummary') }}</span>
                          <span>{{ t('progress.freedom.infoIncluded') }}</span>
                          <span>{{ t('progress.freedom.infoExcluded') }}</span>
                          <b>{{ t('progress.freedom.infoFormula') }}</b>
                          <span>{{ t('progress.freedom.infoRule') }}</span>
                        </div>
                      </q-tooltip>
                    </q-btn>
                  </span>
                  <q-icon
                    name="chevron_right"
                    class="row-chevron"
                    :class="{ 'row-chevron--open': activeDetail === row.key }"
                  />
                </span>
                <span class="comparison-card__values">
                  <span class="comparison-value comparison-value--past">{{ row.start }}</span>
                  <q-icon name="arrow_forward" class="comparison-arrow" />
                  <span class="comparison-value comparison-value--today">{{ row.current }}</span>
                  <span
                    class="delta-pill"
                    :class="row.beneficial ? 'delta-pill--good' : 'delta-pill--bad'"
                  >
                    {{ row.delta }}
                  </span>
                </span>
              </div>
            </div>

            <q-slide-transition>
              <div v-if="activeDetail" class="inline-detail">
                <div class="detail-heading">
                  <div>
                    <span>{{ t('progress.detail.label') }}</span>
                    <h3>{{ activeDetailTitle }}</h3>
                  </div>
                  <div
                    v-if="activeDetail === 'netWorth'"
                    class="detail-switch"
                    role="group"
                    :aria-label="t('progress.chartView.label')"
                  >
                    <button
                      type="button"
                      :class="{ selected: chartMode === 'netWorth' }"
                      @click.stop="chartMode = 'netWorth'"
                    >
                      {{ t('progress.chartView.netWorth') }}
                    </button>
                    <button
                      type="button"
                      :class="{ selected: chartMode === 'breakdown' }"
                      @click.stop="chartMode = 'breakdown'"
                    >
                      {{ t('progress.chartView.breakdown') }}
                    </button>
                  </div>
                </div>

                <NetWorthHistoryChart
                  v-if="activeDetail === 'netWorth'"
                  :points="filteredNetWorthPoints"
                  :breakdown-points="filteredBreakdownPoints"
                  :mode="chartMode"
                  :loading="historyLoading"
                  :error="Boolean(historyError)"
                />
                <ProgressTrendChart
                  v-else-if="activeDetail === 'costOfLife'"
                  :points="annualFlowPoints"
                  :series="costSeries"
                  value-type="currency"
                  period-type="year"
                  :aria-label="t('progress.detail.costAria')"
                  :empty-label="t('progress.historyEmpty')"
                />
                <FreedomDetail v-else compact />
              </div>
            </q-slide-transition>
          </div>
        </article>

        <article class="story-card drivers-card">
          <div class="story-intro">
            <span class="story-number story-number--blue">2</span>
            <div>
              <h2>{{ t('progress.drivers.title') }}</h2>
              <p>{{ t('progress.drivers.description') }}</p>
            </div>
          </div>

          <div class="drivers-content">
            <template v-if="drivers.length">
              <div class="drivers-grid">
                <div v-for="driver in drivers" :key="driver.key" class="driver-card">
                  <span class="metric-icon" :class="`metric-icon--${driver.tone}`">
                    <q-icon :name="driver.icon" />
                  </span>
                  <span class="driver-copy">
                    <strong>{{ driver.title }}</strong>
                    <small>{{ driver.description }}</small>
                  </span>
                  <span
                    class="delta-pill"
                    :class="driver.good ? 'delta-pill--good' : 'delta-pill--bad'"
                  >
                    {{ driver.value }}
                  </span>
                </div>
              </div>

              <button
                type="button"
                class="detail-cta"
                :aria-expanded="driversExpanded"
                @click="driversExpanded = !driversExpanded"
              >
                <span>{{ t('progress.drivers.howCalculated') }}</span>
                <q-icon :name="driversExpanded ? 'expand_less' : 'expand_more'" />
              </button>
              <q-slide-transition>
                <div v-if="driversExpanded" class="driver-evidence">
                  <div v-for="driver in drivers" :key="`${driver.key}-evidence`">
                    <span>{{ driver.evidenceLabel }}</span>
                    <strong>{{ driver.evidence }}</strong>
                  </div>
                </div>
              </q-slide-transition>
            </template>
            <div v-else class="drivers-empty">
              <q-icon name="fact_check" />
              <div>
                <strong>{{ t('progress.drivers.emptyTitle') }}</strong>
                <p>{{ t('progress.drivers.emptyDescription') }}</p>
              </div>
            </div>
          </div>
        </article>

        <article class="story-card milestones-card">
          <div class="story-intro">
            <span class="story-number story-number--purple">3</span>
            <div>
              <h2>{{ t('progress.milestones.title') }}</h2>
              <p>{{ t('progress.milestones.description') }}</p>
            </div>
          </div>

          <div class="milestones-content">
            <div class="milestone-highlight milestone-highlight--latest">
              <span class="milestone-label">{{ t('progress.milestones.latest') }}</span>
              <template v-if="latestMilestone">
                <div class="milestone-highlight__main">
                  <span class="milestone-emblem milestone-emblem--achieved">
                    <q-icon :name="familyIcon(latestMilestone.family)" />
                  </span>
                  <div>
                    <strong>{{ milestoneTitle(latestMilestone) }}</strong>
                    <p>{{ milestoneDescription(latestMilestone) }}</p>
                  </div>
                </div>
                <span class="milestone-status milestone-status--achieved">
                  <q-icon name="check_circle" />
                  {{ latestMilestoneDate }}
                </span>
              </template>
              <div v-else class="milestone-placeholder">
                <q-icon name="emoji_events" />
                <span>{{ t('progress.milestones.noAchievement') }}</span>
              </div>
            </div>

            <div class="milestone-highlight milestone-highlight--next">
              <span class="milestone-label">{{ t('progress.milestones.next') }}</span>
              <template v-if="nextMilestone">
                <div class="milestone-highlight__main">
                  <span class="milestone-emblem milestone-emblem--next">
                    <q-icon :name="familyIcon(nextMilestone.family)" />
                  </span>
                  <div>
                    <strong>{{ milestoneTitle(nextMilestone) }}</strong>
                    <p>{{ milestoneCurrentTarget(nextMilestone) }}</p>
                  </div>
                </div>
                <div class="milestone-progress">
                  <q-linear-progress
                    rounded
                    size="0.62rem"
                    color="purple"
                    track-color="deep-purple-1"
                    :value="nextMilestone.progress"
                  />
                  <strong>{{ Math.round(nextMilestone.progress * 100) }}%</strong>
                </div>
              </template>
              <div v-else class="milestone-placeholder">
                <q-icon name="workspace_premium" />
                <span>{{ t('progress.milestones.allAchieved') }}</span>
              </div>
            </div>

            <div class="milestone-overview">
              <div class="milestone-count">
                <strong>{{ achievedMilestoneCount }} / {{ visibleMilestones.length }}</strong>
                <span>{{ t('progress.milestones.achieved') }}</span>
              </div>
              <div class="milestone-family-icons" :aria-label="t('progress.milestones.families')">
                <span
                  v-for="family in milestoneFamilySummaries"
                  :key="family.id"
                  class="milestone-family-icon"
                  :class="[`milestone-family-icon--${family.id}`, { complete: family.complete }]"
                  :title="family.label"
                >
                  <q-icon :name="family.icon" />
                </span>
              </div>
              <q-btn
                outline
                no-caps
                color="primary"
                icon-right="arrow_forward"
                :label="t('progress.milestones.viewAll')"
                class="milestones-cta"
                @click="openMilestones"
              />
            </div>
          </div>
        </article>
      </div>

      <q-dialog v-model="yearsFundedInfoOpen" position="bottom">
        <q-card class="years-funded-info-sheet responsive-info-card">
          <span class="info-sheet-handle" aria-hidden="true" />
          <q-card-section class="years-funded-info-heading">
            <span class="years-funded-info-icon"><q-icon name="shield" /></span>
            <h2>{{ t('progress.freedom.infoTitle') }}</h2>
            <q-btn v-close-popup flat round dense icon="close" :aria-label="t('common.close')" />
          </q-card-section>
          <q-card-section class="years-funded-info-copy">
            <p>{{ t('progress.freedom.infoSummary') }}</p>
            <strong>{{ t('progress.freedom.infoIncludedTitle') }}</strong>
            <p>{{ t('progress.freedom.infoIncluded') }}</p>
            <strong>{{ t('progress.freedom.infoExcludedTitle') }}</strong>
            <p>{{ t('progress.freedom.infoExcluded') }}</p>
            <div class="years-funded-formula">{{ t('progress.freedom.infoFormula') }}</div>
            <p>{{ t('progress.freedom.infoRule') }}</p>
          </q-card-section>
        </q-card>
      </q-dialog>
    </main>
  </q-page>
</template>

<script setup>
import { computed, defineComponent, h, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import NetWorthHistoryChart from '@/components/dashboard/NetWorthHistoryChart.vue'
import AppPageHeader from '@/components/layout/AppPageHeader.vue'
import ProgressTrendChart from '@/components/progress/ProgressTrendChart.vue'
import { milestoneFamilies } from '@/config/milestone-families'
import { buildNetWorthBreakdownSeries, buildProgressSeries } from '@/domain/financial/history'
import { calculateMilestoneProgress } from '@/domain/milestones/calculations'
import { authUser } from '@/services/auth'
import { useFinancialScopeStore } from '@/stores/financial-scope-store'
import { useMilestonesStore } from '@/stores/milestones-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { formatCurrency } from '@/utils/formatters'
import { getWorkspaceMembers } from '@/utils/workspace-members'

const { t, locale } = useI18n()
const $q = useQuasar()
const route = useRoute()
const router = useRouter()
const milestonesStore = useMilestonesStore()
const scopeStore = useFinancialScopeStore()
const workspaceStore = useWorkspaceStore()
const selectedPeriod = ref('1')
const customStartPeriod = ref(null)
const activeDetail = ref(null)
const chartMode = ref('netWorth')
const driversExpanded = ref(false)
const yearsFundedInfoOpen = ref(false)
const {
  achievements,
  currentMonth,
  currentYear,
  error,
  excludedLiabilityIds,
  financialYear,
  historyDocuments,
  historyError,
  historyLoading,
  liabilities,
  loading,
  trackingActive,
} = storeToRefs(milestonesStore)

const periodOptions = computed(() => [
  { value: '1', label: t('progress.filters.oneYear') },
  { value: '3', label: t('progress.filters.threeYears') },
  { value: '5', label: t('progress.filters.fiveYears') },
  { value: 'all', label: t('progress.filters.all') },
])
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
const progressDocuments = computed(() => {
  if (!financialYear.value) return historyDocuments.value
  const year = Number(financialYear.value.year || financialYear.value.id)
  return [
    ...historyDocuments.value.filter((document) => Number(document?.year || document?.id) !== year),
    financialYear.value,
  ]
})
const historyOptions = computed(() => ({
  throughPeriod: `${currentYear.value}-${currentMonth.value}`,
  memberId: selectedMemberId.value,
  excludedLiabilityIds: excludedLiabilityIds.value,
}))
const progressPoints = computed(() =>
  buildProgressSeries(progressDocuments.value, historyOptions.value),
)
const endPoint = computed(() => progressPoints.value.at(-1) || null)
const startPoint = computed(() => {
  if (!progressPoints.value.length) return null
  if (customStartPeriod.value) {
    return (
      progressPoints.value.find(({ period }) => period === customStartPeriod.value) ||
      progressPoints.value[0]
    )
  }
  if (selectedPeriod.value === 'all') return progressPoints.value[0]
  const cutoff = periodIndex(endPoint.value.period) - Number(selectedPeriod.value) * 12
  return (
    [...progressPoints.value].reverse().find(({ period }) => periodIndex(period) <= cutoff) ||
    progressPoints.value[0]
  )
})
const hasComparison = computed(() =>
  Boolean(startPoint.value && endPoint.value && startPoint.value.period !== endPoint.value.period),
)
const filteredProgressPoints = computed(() => {
  if (!startPoint.value) return []
  return progressPoints.value.filter(({ period }) => period >= startPoint.value.period)
})
const filteredNetWorthPoints = computed(() =>
  filteredProgressPoints.value.map(({ period, netWorth }) => ({ period, value: netWorth })),
)
const filteredBreakdownPoints = computed(() => {
  const allowed = new Set(filteredProgressPoints.value.map(({ period }) => period))
  return buildNetWorthBreakdownSeries(progressDocuments.value, historyOptions.value).filter(
    ({ period }) => allowed.has(period),
  )
})
const annualFlowPoints = computed(() => {
  const byYear = new Map()
  for (const point of filteredProgressPoints.value) byYear.set(point.period.slice(0, 4), point)
  return [...byYear.values()]
})
const annualFreedomPoints = computed(() => {
  const byYear = new Map()
  for (const point of filteredProgressPoints.value) byYear.set(point.period.slice(0, 4), point)
  return [...byYear.values()]
})
const availableStartPoints = computed(() => progressPoints.value.slice(0, -1).reverse())
const rangeLabel = computed(() => {
  if (!startPoint.value || !endPoint.value) return t('progress.filters.noHistory')
  return `${formatShortPeriod(startPoint.value.period)} – ${formatShortPeriod(endPoint.value.period)}`
})
const transformationRows = computed(() => [
  metricRow('netWorth', 'account_balance_wallet', 'green', t('progress.netWorth')),
  metricRow('costOfLife', 'credit_card', 'blue', t('progress.transformation.costOfLife')),
  metricRow('yearsFunded', 'shield', 'purple', t('progress.transformation.yearsFunded')),
])
const activeDetailTitle = computed(
  () => transformationRows.value.find(({ key }) => key === activeDetail.value)?.label || '',
)
const costSeries = computed(() => [
  {
    key: 'income',
    name: t('progress.detail.income'),
    color: '#16815f',
    area: 'rgba(22,129,95,0.2)',
  },
  {
    key: 'costOfLife',
    name: t('progress.detail.expenses'),
    color: '#c44750',
    area: 'rgba(196,71,80,0.15)',
  },
  {
    key: 'savingsCapacity',
    name: t('progress.detail.savings'),
    color: '#0870d8',
    area: 'rgba(8,112,216,0.16)',
  },
])
const freedomSeries = computed(() => [
  {
    key: 'yearsFunded',
    name: t('progress.transformation.yearsFunded'),
    color: '#8754ed',
    area: 'rgba(135,84,237,0.22)',
  },
])
const drivers = computed(() => {
  if (!startPoint.value || !endPoint.value) return []
  const result = []
  const investmentDelta = endPoint.value.investmentAssets - startPoint.value.investmentAssets
  const costDelta = endPoint.value.costOfLife - startPoint.value.costOfLife
  const mortgageDelta = endPoint.value.mortgageBalance - startPoint.value.mortgageBalance

  if (Math.abs(investmentDelta) >= 1) {
    result.push({
      key: 'investments',
      tone: 'green',
      icon: investmentDelta >= 0 ? 'trending_up' : 'trending_down',
      title: t(
        investmentDelta >= 0
          ? 'progress.drivers.investmentsGrew'
          : 'progress.drivers.investmentsFell',
      ),
      description: t('progress.drivers.investmentsDescription'),
      value: signedCurrency(investmentDelta),
      good: investmentDelta >= 0,
      evidenceLabel: t('progress.drivers.investmentsEvidence'),
      evidence: `${formatCurrency(startPoint.value.investmentAssets)} → ${formatCurrency(endPoint.value.investmentAssets)}`,
      weight: Math.abs(investmentDelta),
    })
  }
  if (Math.abs(costDelta) >= 1) {
    result.push({
      key: 'cost',
      tone: 'blue',
      icon: 'credit_card',
      title: t(
        costDelta <= 0 ? 'progress.drivers.costDecreased' : 'progress.drivers.costIncreased',
      ),
      description: t('progress.drivers.costDescription'),
      value: `${signedCurrency(costDelta)}/${t('progress.year')}`,
      good: costDelta <= 0,
      evidenceLabel: t('progress.drivers.costEvidence'),
      evidence: `${formatCurrency(startPoint.value.costOfLife)} → ${formatCurrency(endPoint.value.costOfLife)}`,
      weight: Math.abs(costDelta),
    })
  }
  if (Math.abs(mortgageDelta) >= 1) {
    result.push({
      key: 'mortgage',
      tone: 'purple',
      icon: 'home',
      title: t(
        mortgageDelta <= 0
          ? 'progress.drivers.mortgageDecreased'
          : 'progress.drivers.mortgageIncreased',
      ),
      description: t('progress.drivers.mortgageDescription'),
      value: signedCurrency(mortgageDelta),
      good: mortgageDelta <= 0,
      evidenceLabel: t('progress.drivers.mortgageEvidence'),
      evidence: `${formatCurrency(startPoint.value.mortgageBalance)} → ${formatCurrency(endPoint.value.mortgageBalance)}`,
      weight: Math.abs(mortgageDelta),
    })
  }
  return result.sort((first, second) => second.weight - first.weight).slice(0, 3)
})
const progressMilestones = computed(() =>
  calculateMilestoneProgress({
    financialYear: financialYear.value,
    financialHistory: historyDocuments.value,
    liabilities: liabilities.value,
    excludedLiabilityIds: excludedLiabilityIds.value,
    achievements: trackingActive.value ? achievements.value : [],
    month: currentMonth.value,
    memberId: selectedMemberId.value,
  }),
)
const visibleMilestones = computed(() =>
  progressMilestones.value.filter(
    (milestone) => milestone.family !== 'debt' || milestone.relevant || milestone.achieved,
  ),
)
const achievedMilestoneCount = computed(
  () => visibleMilestones.value.filter(milestoneIsUnlocked).length,
)
const achievementById = computed(
  () => new Map(achievements.value.map((achievement) => [achievement.milestoneId, achievement])),
)
const latestMilestone = computed(() => {
  const unlocked = visibleMilestones.value.filter(milestoneIsUnlocked)
  if (!unlocked.length) return null
  if (!trackingActive.value) return unlocked.at(-1)

  return [...unlocked]
    .sort((first, second) => {
      const firstDate = achievementDate(achievementById.value.get(first.id))?.getTime() || 0
      const secondDate = achievementDate(achievementById.value.get(second.id))?.getTime() || 0
      return firstDate - secondDate
    })
    .at(-1)
})
const latestMilestoneDate = computed(() => {
  if (!latestMilestone.value) return ''
  const date = achievementDate(achievementById.value.get(latestMilestone.value.id))
  if (!date) {
    return t(trackingActive.value ? 'milestones.status.achieved' : 'milestones.status.reached')
  }
  return t('milestones.achievedOn', {
    date: new Intl.DateTimeFormat(locale.value, { month: 'short', year: 'numeric' }).format(date),
  })
})
const nextMilestone = computed(
  () =>
    visibleMilestones.value
      .filter((milestone) => !milestoneIsUnlocked(milestone))
      .sort((first, second) => second.progress - first.progress)[0] || null,
)
const milestoneFamilySummaries = computed(() =>
  milestoneFamilies.map((family) => {
    const milestones = visibleMilestones.value.filter(({ family: id }) => id === family.id)
    return {
      ...family,
      label: t(`milestones.families.${family.id}.title`),
      complete: milestones.length > 0 && milestones.every(milestoneIsUnlocked),
    }
  }),
)

const FreedomDetail = defineComponent({
  props: { compact: { type: Boolean, default: false } },
  setup(props) {
    return () =>
      h(
        'div',
        {
          class: ['freedom-detail-content', { 'freedom-detail-content--compact': props.compact }],
        },
        [
          h(ProgressTrendChart, {
            points: annualFreedomPoints.value,
            series: freedomSeries.value,
            valueType: 'years',
            periodType: 'year',
            ariaLabel: t('progress.detail.freedomAria'),
            emptyLabel: t('progress.historyEmpty'),
          }),
          h('div', { class: 'freedom-formula' }, [
            h('div', [
              h('span', t('progress.freedom.investableWealth')),
              h('strong', formatCurrency(endPoint.value?.investableWealth || 0)),
            ]),
            h('span', { class: 'formula-divider', 'aria-hidden': 'true' }),
            h('div', [
              h('span', t('progress.freedom.annualCost')),
              h('strong', formatCurrency(endPoint.value?.costOfLife || 0)),
            ]),
            h('span', { class: 'formula-equals', 'aria-hidden': 'true' }, '='),
            h('div', [
              h('span', t('progress.freedom.yearsFunded')),
              h('strong', formatYears(endPoint.value?.yearsFunded || 0)),
            ]),
          ]),
          h('p', { class: 'formula-note' }, t('progress.freedom.calculationNote')),
        ],
      )
  },
})

watch(workspaceId, () => load(), { immediate: true })
watch(selectedMemberId, () => {
  activeDetail.value = null
  driversExpanded.value = false
})

function load(force = false) {
  return milestonesStore.load(workspaceId.value, force)
}

function selectPeriod(value) {
  selectedPeriod.value = value
  customStartPeriod.value = null
}

function selectStartPeriod(period) {
  customStartPeriod.value = period
  selectedPeriod.value = 'custom'
}

function toggleDetail(key) {
  activeDetail.value = activeDetail.value === key ? null : key
}

function openYearsFundedInfo() {
  if ($q.screen.lt.sm) yearsFundedInfoOpen.value = true
}

function openMilestones() {
  router.push({ name: 'achievements', params: { workspaceId: workspaceId.value } })
}

function milestoneIsUnlocked(milestone) {
  return trackingActive.value ? milestone.achieved : milestone.reached
}

function familyIcon(familyId) {
  return milestoneFamilies.find(({ id }) => id === familyId)?.icon || 'flag'
}

function milestoneTitle(milestone) {
  return t(`milestones.items.${milestone.id}`, {
    amount: formatCurrency(milestone.target),
  })
}

function milestoneDescription(milestone) {
  if (milestone.family === 'safety') {
    return t('milestones.descriptions.safety', { target: milestone.target })
  }
  if (milestone.family === 'freedom') {
    return t('milestones.descriptions.freedom', { target: milestone.target })
  }
  if (milestone.family === 'netWorth') {
    return milestone.id === 'net_worth_positive'
      ? t('milestones.descriptions.netWorthPositive')
      : t('milestones.descriptions.netWorth', { target: formatCurrency(milestone.target) })
  }
  return t(`milestones.descriptions.${milestone.id}`)
}

function milestoneCurrentTarget(milestone) {
  const currentValue = milestone.currentValue
  if (milestone.family === 'safety') {
    return t('milestones.values.monthsCurrentTarget', {
      current: formatDecimal(currentValue),
      target: milestone.target,
    })
  }
  if (milestone.family === 'freedom') {
    return t('milestones.values.yearsCurrentTarget', {
      current: formatDecimal(currentValue),
      target: milestone.target,
    })
  }
  if (milestone.family === 'debt') {
    return t('milestones.values.remaining', { value: formatCurrency(currentValue) })
  }
  if (milestone.id === 'net_worth_positive') {
    return t('milestones.values.netWorth', { value: formatCurrency(currentValue) })
  }
  return `${formatCurrency(currentValue)} / ${formatCurrency(milestone.target)}`
}

function achievementDate(achievement) {
  const value = achievement?.achievedAt
  if (typeof value?.toDate === 'function') return value.toDate()
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDecimal(value) {
  return new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }).format(
    Number(value || 0),
  )
}

function metricRow(key, icon, tone, label) {
  const start = startPoint.value[key]
  const current = endPoint.value[key]
  const delta = current - start
  const years = key === 'yearsFunded'
  return {
    key,
    icon,
    tone,
    label,
    start: years ? formatYears(start) : formatCurrency(start),
    current: years ? formatYears(current) : formatCurrency(current),
    delta: years ? signedYears(delta) : signedCurrency(delta),
    beneficial: key === 'costOfLife' ? delta <= 0 : delta >= 0,
  }
}

function periodIndex(period) {
  const [year, month] = period.split('-').map(Number)
  return year * 12 + month - 1
}

function formatPeriod(period) {
  const [year, month] = period.split('-').map(Number)
  return new Intl.DateTimeFormat(locale.value, { month: 'short', year: 'numeric' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  )
}

function formatShortPeriod(period) {
  const [year, month] = period.split('-').map(Number)
  return new Intl.DateTimeFormat(locale.value, { month: 'short', year: '2-digit' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  )
}

function formatYears(value) {
  return t('progress.yearsValue', { value: Number(value || 0).toFixed(1) })
}

function signedYears(value) {
  return `${value >= 0 ? '+' : '−'}${Math.abs(Number(value || 0)).toFixed(1)} ${t('progress.years')}`
}

function signedCurrency(value) {
  return `${value >= 0 ? '+' : '−'}${formatCurrency(Math.abs(value))}`
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;

.progress-page {
  @include financial-page;
}

.progress-shell {
  @include financial-shell(analytical);
}

.progress-filters {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.period-switch {
  display: flex;
  padding: 0.22rem;
  border: 1px solid var(--color-line);
  border-radius: 999px;
  background: var(--color-surface);
  box-shadow: var(--shadow-control);
}

.period-switch button,
.detail-switch button {
  @include button-reset;
  min-width: 3.6rem;
  padding: 0.48rem 0.8rem;
  border-radius: 999px;
  color: var(--color-copy);
  font-size: 0.78rem;
  font-weight: 750;
  text-align: center;
}

.period-switch button.selected,
.detail-switch button.selected {
  background: var(--color-ink);
  color: var(--color-inverse);
}

.period-switch button:focus-visible,
.detail-switch button:focus-visible,
.comparison-card:focus-visible,
.detail-cta:focus-visible {
  @include focus-ring;
}

.date-filter {
  min-height: 2.7rem;
  border-color: var(--color-line);
  border-radius: 0.9rem;
  background: var(--color-surface);
  color: var(--color-ink);
  font-size: 0.78rem;
  font-weight: 700;
}

.date-filter__chevron {
  margin-left: 0.35rem;
}

.snapshot-menu {
  width: min(19rem, calc(100vw - 2rem));
  max-height: 24rem;
  border-radius: 1rem;
}

.snapshot-menu__heading {
  padding: 1rem 1rem 0.6rem;
  color: var(--color-muted);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.snapshot-menu__active {
  background: var(--color-blue-soft);
  color: var(--color-primary-dark);
}

.story-stack {
  display: grid;
  gap: 1.15rem;
  margin-top: 1.25rem;
}

.story-card,
.empty-story {
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.story-card {
  overflow: hidden;
}

.story-intro {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.25rem 1.5rem 1rem;
}

.story-number {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--color-green-soft);
  color: var(--color-success);
  font-size: 1.2rem;
  font-weight: 850;
}

.story-number--blue {
  background: var(--color-blue-soft);
  color: var(--color-primary);
}

.story-number--purple {
  background: var(--color-purple-soft);
  color: var(--color-purple);
}

.story-intro h2,
.empty-story h2 {
  margin: 0;
  color: var(--color-ink);
  font-size: clamp(1.3rem, 2vw, 1.65rem);
  line-height: 1.05;
  letter-spacing: -0.04em;
}

.story-intro p,
.empty-story p {
  margin: 0.25rem 0 0;
  color: var(--color-copy);
  font-size: 0.92rem;
  line-height: 1.45;
}

.transformation-content,
.drivers-content {
  min-width: 0;
  padding: 0 1.5rem 1.35rem;
}

.comparison-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.8rem;
}

.comparison-card {
  @include button-reset;
  position: relative;
  display: grid;
  gap: 1rem;
  width: 100%;
  min-height: 8.4rem;
  padding: 0.9rem 1rem 1rem;
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-ink);
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease;
}

.comparison-card::before {
  position: absolute;
  inset: 0;
  background: linear-gradient(145deg, transparent 42%, rgb(22 129 95 / 8%));
  content: '';
  pointer-events: none;
}

.comparison-card--blue::before {
  background: linear-gradient(145deg, transparent 42%, rgb(8 112 216 / 9%));
}

.comparison-card--purple::before {
  background: linear-gradient(145deg, transparent 42%, rgb(135 84 237 / 9%));
}

.comparison-card:hover,
.comparison-card--open {
  border-color: var(--color-line-strong);
  box-shadow: var(--shadow-control);
  transform: translateY(-1px);
}

.comparison-card__heading,
.comparison-card__values {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
}

.comparison-card__heading {
  justify-content: space-between;
  gap: 0.75rem;
}

.comparison-card__values {
  align-self: end;
  gap: 0.65rem;
}

.metric-name {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  text-align: left;
}

.metric-name strong {
  font-size: 0.92rem;
}

.years-funded-info {
  margin-left: -0.45rem;
  color: var(--color-copy);
}

.years-funded-tooltip {
  display: grid;
  gap: 0.45rem;
  line-height: 1.4;
}

.years-funded-info-sheet {
  width: min(32rem, calc(100vw - 2rem));
  border-radius: var(--radius-card);
  color: var(--color-ink);
}

.years-funded-info-heading {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding-bottom: 0.75rem;
}

.years-funded-info-heading h2 {
  flex: 1;
  margin: 0;
  font-size: 1.2rem;
}

.years-funded-info-icon {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  place-items: center;
  border-radius: 0.8rem;
  background: var(--color-purple-soft);
  color: var(--color-purple);
  font-size: 1.25rem;
}

.years-funded-info-copy {
  padding-top: 0;
  color: var(--color-copy);
  font-size: 0.9rem;
  line-height: 1.55;
}

.years-funded-info-copy p {
  margin: 0 0 0.9rem;
}

.years-funded-formula {
  margin: 0.2rem 0 0.9rem;
  padding: 0.8rem 0.9rem;
  border-radius: 0.75rem;
  background: var(--color-purple-soft);
  color: var(--color-ink);
  font-weight: 750;
}

.metric-icon {
  display: grid;
  width: 2.7rem;
  height: 2.7rem;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 0.9rem;
  font-size: 1.25rem;
}

.metric-icon--green {
  background: var(--color-green-soft);
  color: var(--color-success);
}

.metric-icon--blue {
  background: var(--color-blue-soft);
  color: var(--color-primary);
}

.metric-icon--purple {
  background: var(--color-purple-soft);
  color: var(--color-purple);
}

.comparison-value {
  font-size: 0.98rem;
  font-weight: 720;
  white-space: nowrap;
}

.comparison-value--past {
  color: var(--color-copy);
  font-weight: 600;
}

.comparison-value--today {
  font-size: 1.08rem;
  font-weight: 820;
}

.comparison-card__values .delta-pill {
  margin-left: auto;
}

.comparison-arrow,
.freedom-arrow {
  color: var(--color-muted);
}

.delta-pill {
  display: inline-flex;
  min-height: 2rem;
  align-items: center;
  justify-content: center;
  padding: 0.32rem 0.7rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 800;
  white-space: nowrap;
}

.delta-pill--good {
  background: var(--color-green-soft);
  color: var(--color-success-dark);
}

.delta-pill--bad {
  background: var(--color-red-soft);
  color: var(--color-danger-dark);
}

.row-chevron {
  color: var(--color-muted);
  transition: transform 160ms ease;
}

.row-chevron--open {
  transform: rotate(90deg);
}

.inline-detail {
  margin-top: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface-soft);
}

.detail-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.detail-heading span {
  color: var(--color-primary);
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.detail-heading h3 {
  margin: 0.15rem 0 0;
  font-size: 1.15rem;
}

.detail-switch {
  display: flex;
  padding: 0.15rem;
  border: 1px solid var(--color-line);
  border-radius: 999px;
  background: var(--color-surface);
}

.detail-switch button {
  min-width: 5rem;
  padding: 0.35rem 0.65rem;
  font-size: 0.7rem;
}

.inline-detail :deep(.chart-shell),
.inline-detail :deep(.net-worth-chart) {
  min-height: 15rem;
  height: 15rem;
}

.drivers-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.8rem;
}

.driver-card {
  display: grid;
  grid-template-columns: 2.7rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  min-height: 6.4rem;
  padding: 0.8rem 0.9rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.driver-copy {
  display: grid;
  gap: 0.12rem;
  min-width: 0;
}

.driver-copy strong {
  font-size: 0.9rem;
  line-height: 1.25;
}

.driver-copy small {
  color: var(--color-copy);
  font-size: 0.72rem;
  line-height: 1.35;
}

.driver-card .delta-pill {
  align-self: start;
}

.detail-cta {
  @include button-reset;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.35rem;
  width: 100%;
  margin-top: 0.9rem;
  color: var(--color-primary-dark);
  font-size: 0.78rem;
  font-weight: 750;
}

.driver-evidence {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.65rem;
  margin-top: 0.8rem;
}

.driver-evidence > div {
  display: grid;
  gap: 0.2rem;
  padding: 0.75rem;
  border-radius: var(--radius-sm);
  background: var(--color-surface-soft);
}

.driver-evidence span {
  color: var(--color-muted);
  font-size: 0.68rem;
}

.driver-evidence strong {
  font-size: 0.82rem;
}

.drivers-empty {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  min-height: 8rem;
  color: var(--color-muted);
}

.drivers-empty .q-icon {
  padding: 0.75rem;
  border-radius: 50%;
  background: var(--color-surface-muted);
  font-size: 1.4rem;
}

.drivers-empty p {
  margin: 0.25rem 0 0;
  color: var(--color-copy);
  font-size: 0.82rem;
}

.milestones-content {
  position: relative;
  display: grid;
  grid-template-columns: minmax(13rem, 1fr) minmax(13rem, 1fr) minmax(11rem, 0.65fr);
  gap: 0.9rem;
  min-width: 0;
  padding: 0 1.5rem 1.35rem;
  background:
    radial-gradient(circle at 92% 100%, rgb(51 184 150 / 12%), transparent 12rem),
    linear-gradient(145deg, #ffffff 45%, #f8fbff);
}

.milestone-highlight {
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 0.8rem;
  min-width: 0;
  min-height: 10.5rem;
  padding: 1rem;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
}

.milestone-highlight--latest {
  border-color: rgb(22 129 95 / 9%);
  background: linear-gradient(145deg, #f2fbf7, #f8fcfa);
}

.milestone-highlight--next {
  border-color: rgb(135 84 237 / 9%);
  background: linear-gradient(145deg, #f8f5ff, #fbfaff);
}

.milestone-label {
  color: var(--color-muted);
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.milestone-highlight__main {
  display: flex;
  align-items: flex-start;
  gap: 0.8rem;
  min-width: 0;
}

.milestone-highlight__main > div {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
}

.milestone-highlight__main strong {
  color: var(--color-ink);
  font-size: 1.15rem;
  line-height: 1.15;
  letter-spacing: -0.02em;
}

.milestone-highlight__main p {
  margin: 0;
  color: var(--color-copy);
  font-size: 0.75rem;
  line-height: 1.35;
}

.milestone-emblem {
  display: grid;
  width: 3rem;
  height: 3rem;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 50%;
  font-size: 1.45rem;
}

.milestone-emblem--achieved {
  background: var(--color-green-soft);
  color: var(--color-success);
}

.milestone-emblem--next {
  background: var(--color-purple-soft);
  color: var(--color-purple);
}

.milestone-status {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 0.3rem;
  padding: 0.28rem 0.55rem;
  border-radius: 999px;
  font-size: 0.67rem;
  font-weight: 750;
}

.milestone-status--achieved {
  background: rgb(22 129 95 / 10%);
  color: var(--color-success-dark);
}

.milestone-progress {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.65rem;
  color: var(--color-purple);
  font-size: 0.72rem;
}

.milestone-placeholder {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  color: var(--color-copy);
  font-size: 0.8rem;
}

.milestone-placeholder .q-icon {
  color: var(--color-muted);
  font-size: 1.5rem;
}

.milestone-overview {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  flex-direction: column;
  justify-content: center;
  gap: 0.85rem;
  padding: 0.5rem 0.2rem 0.5rem 1rem;
  border-left: 1px solid var(--color-line);
}

.milestone-count {
  display: grid;
  gap: 0.05rem;
}

.milestone-count strong {
  color: var(--color-ink);
  font-size: 1.25rem;
  line-height: 1;
}

.milestone-count span {
  color: var(--color-copy);
  font-size: 0.7rem;
}

.milestone-family-icons {
  display: flex;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.milestone-family-icon {
  display: grid;
  width: 2.3rem;
  height: 2.3rem;
  place-items: center;
  border: 1px solid var(--color-line);
  border-radius: 50%;
  background: var(--color-surface);
  color: var(--color-muted);
  font-size: 1.05rem;
}

.milestone-family-icon--safety.complete {
  background: var(--color-green-soft);
  color: var(--color-success);
}

.milestone-family-icon--freedom.complete {
  background: var(--color-purple-soft);
  color: var(--color-purple);
}

.milestone-family-icon--debt.complete {
  background: #fff4e8;
  color: #c76a13;
}

.milestone-family-icon--netWorth.complete {
  background: var(--color-blue-soft);
  color: var(--color-primary);
}

.milestones-cta {
  min-height: 2.25rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 750;
}

:deep(.freedom-detail-content) {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(15rem, 0.55fr);
  gap: 1rem;
  align-items: center;
}

:deep(.freedom-detail-content--compact) {
  grid-template-columns: minmax(0, 1fr) minmax(14rem, 0.5fr);
}

:deep(.freedom-formula) {
  display: grid;
  grid-template-columns: 1fr;
  justify-items: stretch;
  gap: 0.5rem;
  padding: 1.15rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  text-align: center;
}

:deep(.freedom-formula > div) {
  display: grid;
  gap: 0.2rem;
  padding: 0.25rem 0;
}

:deep(.freedom-formula > div:last-child) {
  margin-top: 0.1rem;
  padding: 0.8rem;
  border-radius: 0.8rem;
  background: var(--color-purple-soft);
  color: var(--color-purple);
}

:deep(.freedom-formula span) {
  color: var(--color-muted);
  font-size: 0.68rem;
}

:deep(.freedom-formula strong) {
  font-size: 1.08rem;
}

:deep(.freedom-formula > div:last-child strong) {
  font-size: 1.25rem;
}

:deep(.formula-divider) {
  width: min(10rem, 72%);
  height: 1px;
  margin: 0 auto;
  background: var(--color-line-strong);
}

:deep(.formula-equals) {
  color: var(--color-muted);
  font-size: 1rem;
  font-weight: 800;
  line-height: 1;
}

:deep(.formula-note) {
  grid-column: 2;
  margin: -0.45rem 0 0;
  color: var(--color-copy);
  font-size: 0.72rem;
  line-height: 1.4;
}

.empty-story {
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
  padding: 2rem;
}

.state {
  display: grid;
  min-height: 20rem;
  place-items: center;
  gap: 0.75rem;
  color: var(--color-copy);
}

@media (max-width: 1050px) {
  .comparison-grid,
  .drivers-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .comparison-card:last-child,
  .driver-card:last-child {
    grid-column: 1 / -1;
  }

  .milestones-content {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .milestone-overview {
    grid-column: 1 / -1;
    align-items: center;
    flex-direction: row;
    justify-content: space-between;
    padding: 0.8rem 0.25rem 0;
    border-top: 1px solid var(--color-line);
    border-left: 0;
  }
}

@media (max-width: 760px) {
  .progress-filters {
    width: 100%;
    align-items: stretch;
    flex-direction: column;
  }

  .period-switch {
    width: 100%;
  }

  .period-switch button {
    min-width: 0;
    flex: 1;
  }

  .date-filter {
    width: 100%;
  }

  .story-stack {
    margin-top: 0.9rem;
  }

  .story-intro {
    padding: 1rem 1rem 0.85rem;
  }

  .story-number {
    width: 2.2rem;
    height: 2.2rem;
    font-size: 1rem;
  }

  .story-intro h2 {
    font-size: 1.45rem;
  }

  .transformation-content,
  .drivers-content {
    padding: 0 0.8rem 0.8rem;
  }

  .milestones-content {
    grid-template-columns: 1fr;
    padding: 0 0.8rem 0.8rem;
  }

  .milestone-highlight {
    min-height: 9.5rem;
  }

  .milestone-overview {
    grid-column: auto;
    align-items: flex-start;
    flex-direction: column;
  }

  .milestones-cta {
    width: 100%;
  }

  .comparison-grid,
  .drivers-grid {
    grid-template-columns: 1fr;
  }

  .comparison-card:last-child,
  .driver-card:last-child {
    grid-column: auto;
  }

  .comparison-card {
    min-height: 7.7rem;
  }

  .comparison-card__values {
    gap: 0.5rem;
  }

  .comparison-card__values .delta-pill {
    margin-left: auto;
  }

  .detail-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .detail-switch {
    width: 100%;
  }

  .detail-switch button {
    flex: 1;
  }

  .driver-card {
    grid-template-columns: 2.4rem minmax(0, 1fr) auto;
  }

  .driver-evidence {
    grid-template-columns: 1fr;
  }

  :deep(.freedom-detail-content),
  :deep(.freedom-detail-content--compact) {
    grid-template-columns: 1fr;
  }

  :deep(.formula-note) {
    grid-column: 1;
  }
}
</style>
