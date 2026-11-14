<template>
  <q-page class="progress-page">
    <main class="progress-shell">
      <div class="progress-header-layout">
        <AppPageHeader
          :title="t('progress.title')"
          :subtitle="t('progress.subtitle')"
          :back-label="t('navigation.backToWorkspaceHome')"
          :back-to="homeRoute"
        >
          <template #title-prefix>
            <span class="progress-title-mark"><q-icon name="bar_chart" /></span>
          </template>
          <template #title-action>
            <q-icon name="info_outline" class="progress-title-info">
              <q-tooltip>{{ t('progress.subtitle') }}</q-tooltip>
            </q-icon>
          </template>
        </AppPageHeader>

        <div class="progress-tabs" role="tablist" :aria-label="t('progress.tabs.label')">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            role="tab"
            :aria-selected="activeTab === tab.id"
            :class="{ active: activeTab === tab.id }"
            @click="selectTab(tab.id)"
          >
            <q-icon :name="tab.icon" />
            <span>{{ tab.label }}</span>
          </button>
        </div>
      </div>

      <AchievementsPage v-if="activeTab === 'achievements'" embedded class="achievements-view" />

      <template v-else>
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
        <section v-else-if="!hasComparison" class="empty-state">
          <span class="empty-state__icon"><q-icon name="timeline" /></span>
          <div>
            <h2>{{ t('progress.empty.title') }}</h2>
            <p>{{ t('progress.empty.description') }}</p>
          </div>
        </section>

        <section v-else class="evolution-workspace">
          <nav class="perspective-nav" :aria-label="t('progress.evolution.navigationLabel')">
            <button
              v-for="perspective in perspectives"
              :key="perspective.id"
              type="button"
              :class="[
                `perspective-card--${perspective.tone}`,
                { active: activePerspective === perspective.id },
              ]"
              :aria-current="activePerspective === perspective.id ? 'page' : undefined"
              @click="selectPerspective(perspective.id)"
            >
              <span class="perspective-icon" :class="`perspective-icon--${perspective.tone}`">
                <q-icon :name="perspective.icon" />
              </span>
              <span>
                <strong>{{ perspective.label }}</strong>
                <small>{{ perspective.question }}</small>
              </span>
              <q-icon name="chevron_right" class="perspective-chevron" />
            </button>
          </nav>

          <article class="perspective-panel">
            <div class="evolution-toolbar">
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
            </div>

            <header class="perspective-header">
              <div class="perspective-heading">
                <span class="perspective-eyebrow">{{ activePerspectiveConfig.label }}</span>
                <h2>{{ activePerspectiveConfig.title }}</h2>
                <p class="perspective-description">{{ activePerspectiveConfig.description }}</p>
              </div>
              <div
                class="metric-highlight metric-highlight--mobile"
                :class="`metric-highlight--${activePerspectiveConfig.tone}`"
              >
                <span>{{ metric.label }}</span>
                <strong>{{ metric.value }}</strong>
                <small :class="{ negative: metric.negative }">{{ metric.change }}</small>
              </div>
            </header>

            <div class="analysis-grid">
              <section class="chart-card">
                <EvolutionChart
                  v-if="activePerspective === 'wealth-creation'"
                  mode="bridge"
                  :bridge="bridgeItems"
                  :start-value="startPoint.netWorth"
                  :end-value="endPoint.netWorth"
                  :start-label="formatShortPeriod(startPoint.period)"
                  :end-label="formatShortPeriod(endPoint.period)"
                  :aria-label="t('progress.evolution.wealthCreation.chartAria')"
                  :empty-label="t('progress.historyEmpty')"
                />
                <EvolutionChart
                  v-else-if="activePerspective === 'cost-of-life'"
                  mode="trend"
                  :points="filteredFlowPoints"
                  :series="flowSeries"
                  :aria-label="t('progress.evolution.costOfLife.chartAria')"
                  :empty-label="t('progress.historyEmpty')"
                />
                <EvolutionChart
                  v-else-if="activePerspective === 'freedom'"
                  mode="trend"
                  value-type="years"
                  :points="filteredProgressPoints"
                  :series="freedomSeries"
                  :aria-label="t('progress.evolution.freedom.chartAria')"
                  :empty-label="t('progress.historyEmpty')"
                />
                <EvolutionChart
                  v-else
                  mode="composition"
                  :points="compositionPoints"
                  :series="compositionSeries"
                  :aria-label="t('progress.evolution.composition.chartAria')"
                  :empty-label="t('progress.historyEmpty')"
                />
                <p class="chart-note">{{ activePerspectiveConfig.note }}</p>
              </section>

              <aside class="analysis-aside">
                <div
                  class="metric-highlight metric-highlight--desktop"
                  :class="`metric-highlight--${activePerspectiveConfig.tone}`"
                >
                  <span>{{ metric.label }}</span>
                  <strong>{{ metric.value }}</strong>
                  <small :class="{ negative: metric.negative }">{{ metric.change }}</small>
                </div>

                <section class="breakdown-card">
                  <h3>{{ breakdownTitle }}</h3>
                  <div class="breakdown-list">
                    <div v-for="item in breakdownItems" :key="item.key" class="breakdown-row">
                      <span class="breakdown-marker" :style="{ background: item.color }">
                        <q-icon v-if="item.icon" :name="item.icon" />
                      </span>
                      <span class="breakdown-copy">
                        <strong>{{ item.label }}</strong>
                        <small v-if="item.meta">{{ item.meta }}</small>
                      </span>
                      <b :class="{ positive: item.positive, negative: item.negative }">
                        {{ item.value }}
                      </b>
                    </div>
                  </div>

                  <div v-if="activePerspective === 'freedom'" class="formula-card">
                    <span>{{ t('progress.freedom.infoFormula') }}</span>
                    <small>{{ t('progress.freedom.calculationNote') }}</small>
                  </div>
                  <div v-if="activePerspective === 'cost-of-life'" class="coverage-note">
                    <q-icon name="info_outline" />
                    <span>{{ coverageDescription }}</span>
                  </div>
                </section>
              </aside>
            </div>
          </article>
        </section>
      </template>
    </main>
  </q-page>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AppPageHeader from '@/components/layout/AppPageHeader.vue'
import EvolutionChart from '@/components/progress/EvolutionChart.vue'
import { assetCategories } from '@/config/asset-categories'
import { CHART_COLORS } from '@/config/chart-theme'
import { liabilityCategories } from '@/config/liability-categories'
import {
  buildMonthlyFlowSeries,
  buildNetWorthBreakdownSeries,
  buildNetWorthBridge,
  buildProgressSeries,
} from '@/domain/financial/history'
import { authUser } from '@/services/auth'
import { useFinancialScopeStore } from '@/stores/financial-scope-store'
import { useMilestonesStore } from '@/stores/milestones-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { formatCurrency } from '@/utils/formatters'
import { getWorkspaceMembers } from '@/utils/workspace-members'
import AchievementsPage from './AchievementsPage.vue'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const milestonesStore = useMilestonesStore()
const scopeStore = useFinancialScopeStore()
const workspaceStore = useWorkspaceStore()
const selectedPeriod = ref('1')

const {
  currentMonth,
  currentYear,
  error,
  excludedLiabilityIds,
  financialYear,
  historyDocuments,
  loading,
} = storeToRefs(milestonesStore)

const tabs = computed(() => [
  { id: 'evolution', icon: 'trending_up', label: t('progress.tabs.evolution') },
  { id: 'achievements', icon: 'emoji_events', label: t('progress.tabs.achievements') },
])
const periodOptions = computed(() => [
  { value: '1', label: t('progress.filters.oneYear') },
  { value: '3', label: t('progress.filters.threeYears') },
  { value: '5', label: t('progress.filters.fiveYears') },
  { value: 'all', label: t('progress.filters.all') },
])
const perspectives = computed(() => [
  {
    id: 'wealth-creation',
    icon: 'account_balance_wallet',
    tone: 'green',
    label: t('progress.evolution.wealthCreation.label'),
    question: t('progress.evolution.wealthCreation.question'),
    title: t('progress.evolution.wealthCreation.title'),
    description: t('progress.evolution.wealthCreation.description'),
    note: t('progress.evolution.wealthCreation.note'),
  },
  {
    id: 'cost-of-life',
    icon: 'savings',
    tone: 'blue',
    label: t('progress.evolution.costOfLife.label'),
    question: t('progress.evolution.costOfLife.question'),
    title: t('progress.evolution.costOfLife.title'),
    description: t('progress.evolution.costOfLife.description'),
    note: t('progress.evolution.costOfLife.note'),
  },
  {
    id: 'freedom',
    icon: 'shield',
    tone: 'purple',
    label: t('progress.evolution.freedom.label'),
    question: t('progress.evolution.freedom.question'),
    title: t('progress.evolution.freedom.title'),
    description: t('progress.evolution.freedom.description'),
    note: t('progress.evolution.freedom.note'),
  },
  {
    id: 'composition',
    icon: 'donut_large',
    tone: 'warning',
    label: t('progress.evolution.composition.label'),
    question: t('progress.evolution.composition.question'),
    title: t('progress.evolution.composition.title'),
    description: t('progress.evolution.composition.description'),
    note: t('progress.evolution.composition.note'),
  },
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
const activeTab = computed(() =>
  route.query.tab === 'achievements' ? 'achievements' : 'evolution',
)
const activePerspective = computed(() => {
  const requested = String(route.query.view || '')
  return perspectives.value.some(({ id }) => id === requested) ? requested : 'wealth-creation'
})
const activePerspectiveConfig = computed(
  () =>
    perspectives.value.find(({ id }) => id === activePerspective.value) || perspectives.value[0],
)

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
const breakdownPoints = computed(() =>
  buildNetWorthBreakdownSeries(progressDocuments.value, historyOptions.value),
)
const flowPoints = computed(() =>
  buildMonthlyFlowSeries(progressDocuments.value, historyOptions.value),
)
const endPoint = computed(() => progressPoints.value.at(-1) || null)
const startPoint = computed(() => {
  if (!progressPoints.value.length) return null
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
const filteredProgressPoints = computed(() =>
  startPoint.value
    ? progressPoints.value.filter(({ period }) => period >= startPoint.value.period)
    : [],
)
const filteredBreakdownPoints = computed(() =>
  startPoint.value
    ? breakdownPoints.value.filter(({ period }) => period >= startPoint.value.period)
    : [],
)
const filteredFlowPoints = computed(() =>
  startPoint.value
    ? flowPoints.value.filter(({ period }) => period >= startPoint.value.period)
    : [],
)
const startBreakdown = computed(() => filteredBreakdownPoints.value[0] || null)
const endBreakdown = computed(() => filteredBreakdownPoints.value.at(-1) || null)

const bridgeItems = computed(() => {
  const items = buildNetWorthBridge(startBreakdown.value, endBreakdown.value).map((item) => ({
    ...item,
    label: categoryLabel(item.section, item.categoryId),
  }))
  if (items.length <= 6) return items
  const visible = items.slice(0, 5)
  const remainder = items.slice(5).reduce((sum, item) => sum + item.value, 0)
  return [
    ...visible,
    { key: 'other', label: t('progress.evolution.otherChanges'), value: remainder },
  ]
})

const flowSeries = computed(() => [
  { key: 'income', name: t('progress.detail.income'), color: CHART_COLORS.success, type: 'line' },
  { key: 'costOfLife', name: t('progress.detail.expenses'), color: '#c44750', type: 'line' },
  {
    key: 'savingsCapacity',
    name: t('progress.detail.savings'),
    color: CHART_COLORS.primary,
    type: 'bar',
  },
])
const freedomSeries = computed(() => [
  {
    key: 'yearsFunded',
    name: t('progress.transformation.yearsFunded'),
    color: CHART_COLORS.purple,
  },
])

const compositionSeries = computed(() => {
  const colors = ['#16815f', '#0870d8', '#39a8a3', '#8754ed', '#4f7cac', '#73bfb8']
  const debtColors = ['#c44750', '#e58b43', '#d95568', '#b66d57', '#a85567', '#ef6c57']
  return [
    ...assetCategories
      .filter(({ id }) =>
        filteredBreakdownPoints.value.some((point) => Number(point.assets?.[id] || 0) !== 0),
      )
      .map((category, index) => ({
        key: `assets:${category.id}`,
        name: t(category.nameKey),
        color: colors[index % colors.length],
        section: 'assets',
      })),
    ...liabilityCategories
      .filter(({ id }) =>
        filteredBreakdownPoints.value.some((point) => Number(point.liabilities?.[id] || 0) !== 0),
      )
      .map((category, index) => ({
        key: `liabilities:${category.id}`,
        name: t(category.nameKey),
        color: debtColors[index % debtColors.length],
        section: 'liabilities',
      })),
  ]
})
const compositionPoints = computed(() =>
  filteredBreakdownPoints.value.map((point) => ({
    period: point.period,
    ...Object.fromEntries(
      Object.entries(point.assets || {}).map(([key, value]) => [`assets:${key}`, value]),
    ),
    ...Object.fromEntries(
      Object.entries(point.liabilities || {}).map(([key, value]) => [`liabilities:${key}`, value]),
    ),
  })),
)

const metric = computed(() => {
  if (!startPoint.value || !endPoint.value) return { label: '', value: '', change: '' }
  if (activePerspective.value === 'cost-of-life') {
    const current = filteredFlowPoints.value.at(-1)
    const first = filteredFlowPoints.value[0]
    const value = current?.savingsCapacity || 0
    const delta = value - (first?.savingsCapacity || 0)
    return metricValue(t('progress.evolution.metrics.monthlySavingsCapacity'), value, delta)
  }
  if (activePerspective.value === 'freedom') {
    const delta = endPoint.value.yearsFunded - startPoint.value.yearsFunded
    return {
      label: t('progress.evolution.metrics.yearsFunded'),
      value: formatYears(endPoint.value.yearsFunded),
      change: signedYears(delta),
      negative: delta < 0,
    }
  }
  const delta = endPoint.value.netWorth - startPoint.value.netWorth
  return metricValue(
    activePerspective.value === 'composition'
      ? t('progress.evolution.metrics.netPosition')
      : t('progress.evolution.metrics.netWorthChange'),
    activePerspective.value === 'composition' ? endPoint.value.netWorth : delta,
    activePerspective.value === 'composition'
      ? delta
      : percentChange(delta, startPoint.value.netWorth),
    activePerspective.value !== 'composition',
  )
})

const breakdownTitle = computed(() => {
  const keys = {
    'wealth-creation': 'progress.evolution.breakdown.wealth',
    'cost-of-life': 'progress.evolution.breakdown.flows',
    freedom: 'progress.evolution.breakdown.freedom',
    composition: 'progress.evolution.breakdown.composition',
  }
  return t(keys[activePerspective.value])
})

const breakdownItems = computed(() => {
  if (!endPoint.value) return []
  if (activePerspective.value === 'wealth-creation') {
    return bridgeItems.value.map((item) => ({
      key: item.key,
      label: item.label,
      value: signedCurrency(item.value),
      color: item.value >= 0 ? CHART_COLORS.success : '#c44750',
      positive: item.value > 0,
      negative: item.value < 0,
    }))
  }
  if (activePerspective.value === 'cost-of-life') {
    const current = filteredFlowPoints.value.at(-1) || {}
    return [
      valueItem(
        'income',
        t('progress.detail.income'),
        current.income,
        CHART_COLORS.success,
        'payments',
      ),
      valueItem(
        'expenses',
        t('progress.detail.expenses'),
        current.costOfLife,
        '#c44750',
        'receipt_long',
      ),
      valueItem(
        'savings',
        t('progress.detail.savings'),
        current.savingsCapacity,
        CHART_COLORS.primary,
        'savings',
      ),
    ]
  }
  if (activePerspective.value === 'freedom') {
    return [
      valueItem(
        'investable',
        t('progress.freedom.investableWealth'),
        endPoint.value.investableWealth,
        CHART_COLORS.purple,
        'account_balance_wallet',
      ),
      valueItem(
        'cost',
        t('progress.freedom.annualCost'),
        endPoint.value.costOfLife,
        '#c44750',
        'credit_card',
      ),
      {
        key: 'years',
        label: t('progress.freedom.yearsFunded'),
        value: formatYears(endPoint.value.yearsFunded),
        color: CHART_COLORS.purple,
        icon: 'shield',
      },
    ]
  }
  return compositionSeries.value.map((series) => ({
    key: series.key,
    label: series.name,
    value: formatCurrency(Number(compositionPoints.value.at(-1)?.[series.key] || 0)),
    color: series.color,
  }))
})

const coverageDescription = computed(() => {
  const coverage = filteredFlowPoints.value.at(-1)?.coverage || 'model'
  return t(`progress.evolution.coverage.${coverage}`)
})

watch(workspaceId, () => load(), { immediate: true })

function load(force = false) {
  return milestonesStore.load(workspaceId.value, force)
}

function selectTab(tab) {
  router.replace({ query: { ...route.query, tab: tab === 'achievements' ? tab : undefined } })
}

function selectPerspective(view) {
  router.replace({ query: { ...route.query, view: view === 'wealth-creation' ? undefined : view } })
}

function selectPeriod(value) {
  selectedPeriod.value = value
}

function categoryLabel(section, categoryId) {
  const categories = section === 'assets' ? assetCategories : liabilityCategories
  const category = categories.find(({ id }) => id === categoryId)
  return category ? t(category.nameKey) : categoryId
}

function valueItem(key, label, value, color, icon) {
  return { key, label, value: formatCurrency(value), color, icon }
}

function metricValue(label, value, change, valueIsDelta = false) {
  const changeIsPercent = typeof change === 'string'
  return {
    label,
    value: valueIsDelta ? signedCurrency(value) : formatCurrency(value),
    change: changeIsPercent ? change : signedCurrency(change),
    negative: changeIsPercent ? String(change).startsWith('−') : change < 0,
  }
}

function percentChange(delta, start) {
  if (!start) return t('progress.evolution.metrics.noPercentage')
  const value = (delta / Math.abs(start)) * 100
  return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(1)}%`
}

function periodIndex(period) {
  const [year, month] = period.split('-').map(Number)
  return year * 12 + month - 1
}

function formatShortPeriod(period) {
  const [year, month] = period.split('-').map(Number)
  return new Intl.DateTimeFormat(locale.value, { month: 'short', year: '2-digit' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  )
}

function formatYears(value) {
  return t('progress.yearsValue', {
    value: new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }).format(value || 0),
  })
}

function signedYears(value) {
  return `${value >= 0 ? '+' : '−'}${new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }).format(Math.abs(value || 0))} ${t('progress.years')}`
}

function signedCurrency(value) {
  return `${value >= 0 ? '+' : '−'}${formatCurrency(Math.abs(value || 0))}`
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

.progress-title-info {
  color: var(--color-copy);
  font-size: 1.55rem;
}
.progress-title-mark {
  display: grid;
  place-items: center;
  width: 2.85rem;
  height: 2.85rem;
  border-radius: 50%;
  background: var(--color-green-soft);
  color: var(--color-success);
  font-size: 1.65rem;
}

.progress-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 1rem;
  border-bottom: 1px solid var(--color-line-strong);
}
.progress-tabs button {
  @include button-reset;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  min-height: 3.25rem;
  border-radius: 0;
  color: var(--color-muted);
  font-size: 0.95rem;
  font-weight: 700;
  box-shadow: none;
  transition: 160ms ease;
}
.progress-tabs button .q-icon {
  font-size: 1.55rem;
}
.progress-tabs button:hover {
  color: var(--color-ink);
  background: transparent;
}
.progress-tabs button.active {
  color: var(--color-ink);
}
.progress-tabs button.active::after {
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 3px;
  background: var(--color-ink);
  content: '';
}
.progress-tabs button:focus-visible {
  outline: 3px solid var(--color-primary-focus);
  outline-offset: -3px;
}

.period-switch {
  display: inline-flex;
  padding: 0.25rem;
  border: 1px solid var(--color-line-strong);
  border-radius: 999px;
  background: var(--color-surface);
  box-shadow: var(--shadow-control);
}
.period-switch button {
  @include segmented-button;
  min-width: 3.2rem;
  padding: 0.4rem 0.75rem;
  color: var(--color-copy);
  transition: 160ms ease;
}
.period-switch button.selected {
  background: var(--color-ink);
  color: var(--color-inverse);
  box-shadow: 0 6px 14px rgb(11 22 51 / 16%);
}

.evolution-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.evolution-workspace {
  margin-top: 1.25rem;
}
.perspective-nav {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
}
.perspective-nav button {
  @include button-reset;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.65rem;
  width: 100%;
  min-height: 5.25rem;
  padding: 0.8rem 0.85rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: var(--color-ink);
  box-shadow: 0 8px 24px rgb(34 55 78 / 5%);
  transition:
    160ms border-color ease,
    160ms box-shadow ease,
    160ms transform ease;
}
.perspective-nav button:hover {
  border-color: var(--color-line-strong);
  box-shadow: 0 12px 28px rgb(34 55 78 / 9%);
  transform: translateY(-1px);
}
.perspective-nav button.active {
  border-color: var(--color-primary);
  background: var(--color-blue-soft);
  box-shadow: 0 10px 28px var(--color-primary-glow);
}
.perspective-nav button.perspective-card--green.active {
  border-color: var(--color-success);
  background: var(--color-green-soft);
}
.perspective-nav button.perspective-card--purple.active {
  border-color: var(--color-purple);
  background: var(--color-purple-soft);
}
.perspective-nav button.perspective-card--warning.active {
  border-color: var(--color-warning);
  background: var(--color-warning-soft);
}
.perspective-nav button:focus-visible {
  outline: 3px solid var(--color-primary-focus);
  outline-offset: 2px;
}
.perspective-nav strong,
.perspective-nav small {
  display: block;
}
.perspective-nav strong {
  font-size: 0.84rem;
}
.perspective-nav small {
  margin-top: 0.18rem;
  color: var(--color-copy);
  font-size: 0.74rem;
  line-height: 1.35;
}
.perspective-icon,
.breakdown-marker {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 2.3rem;
  height: 2.3rem;
  border-radius: 50%;
  font-size: 1.05rem;
}
.perspective-icon--green {
  background: var(--color-green-soft);
  color: var(--color-success);
}
.perspective-icon--blue {
  background: var(--color-blue-soft);
  color: var(--color-primary);
}
.perspective-icon--purple {
  background: var(--color-purple-soft);
  color: var(--color-purple);
}
.perspective-icon--warning {
  background: var(--color-warning-soft);
  color: var(--color-warning-dark);
}
.perspective-chevron {
  color: var(--color-muted);
}

.perspective-panel {
  position: relative;
  min-width: 0;
  margin-top: 1rem;
  padding: clamp(1.4rem, 3vw, 2.4rem);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}
.perspective-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  gap: 2rem;
}
.perspective-eyebrow {
  color: var(--color-success);
  font-size: 0.78rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.perspective-heading h2 {
  margin: 0.45rem 0 0;
  color: var(--color-ink);
  font-size: clamp(1.8rem, 3vw, 2.75rem);
  line-height: 1.02;
  letter-spacing: -0.045em;
}
.perspective-description {
  max-width: 54rem;
  margin: 0.65rem 0 0;
  color: var(--color-copy);
  font-size: 0.92rem;
  line-height: 1.45;
}
.metric-highlight {
  padding: 1.2rem 1.35rem;
  border-radius: var(--radius-md);
  background: var(--color-green-soft);
}
.metric-highlight--blue {
  background: var(--color-blue-soft);
}
.metric-highlight--purple {
  background: var(--color-purple-soft);
}
.metric-highlight--warning {
  background: var(--color-warning-soft);
}
.metric-highlight span,
.metric-highlight strong,
.metric-highlight small {
  display: block;
}
.metric-highlight span {
  color: var(--color-copy);
  font-size: 0.78rem;
}
.metric-highlight strong {
  margin-top: 0.25rem;
  color: var(--color-success-dark);
  font-size: clamp(1.65rem, 3vw, 2.35rem);
  line-height: 1;
  letter-spacing: -0.035em;
}
.metric-highlight--blue strong {
  color: var(--color-primary-dark);
}
.metric-highlight--purple strong {
  color: var(--color-purple);
}
.metric-highlight--warning strong {
  color: var(--color-warning-dark);
}
.metric-highlight small {
  margin-top: 0.45rem;
  color: var(--color-success-dark);
  font-weight: 750;
}
.metric-highlight small.negative,
.breakdown-row b.negative {
  color: var(--color-danger);
}

.analysis-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(15rem, 0.85fr);
  gap: 1rem;
  margin-top: 1.65rem;
}
.analysis-aside {
  display: grid;
  align-content: start;
  gap: 1rem;
  min-width: 0;
}
.chart-card,
.breakdown-card {
  min-width: 0;
  padding: 1rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}
.chart-note {
  margin: 0.4rem 0 0;
  padding: 0 0.5rem;
  color: var(--color-muted);
  font-size: 0.75rem;
  line-height: 1.4;
}
.breakdown-card h3 {
  margin: 0 0 0.7rem;
  color: var(--color-ink);
  font-size: 1rem;
}
.breakdown-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.7rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--color-line);
}
.breakdown-row:last-child {
  border-bottom: 0;
}
.breakdown-marker {
  width: 2rem;
  height: 2rem;
  color: var(--color-inverse);
  font-size: 0.95rem;
}
.breakdown-copy strong,
.breakdown-copy small {
  display: block;
}
.breakdown-copy strong {
  color: var(--color-ink);
  font-size: 0.8rem;
}
.breakdown-copy small {
  color: var(--color-muted);
  font-size: 0.7rem;
}
.breakdown-row b {
  color: var(--color-ink);
  font-size: 0.8rem;
  white-space: nowrap;
}
.breakdown-row b.positive {
  color: var(--color-success-dark);
}
.formula-card,
.coverage-note {
  margin-top: 1rem;
  padding: 0.85rem;
  border-radius: var(--radius-sm);
  background: var(--color-surface-soft);
  color: var(--color-copy);
  font-size: 0.74rem;
  line-height: 1.45;
}
.formula-card span,
.formula-card small {
  display: block;
}
.formula-card span {
  color: var(--color-ink);
  font-weight: 750;
}
.formula-card small {
  margin-top: 0.35rem;
}
.coverage-note {
  display: flex;
  gap: 0.55rem;
}

.state,
.empty-state {
  display: grid;
  place-items: center;
  gap: 0.8rem;
  min-height: 25rem;
  margin-top: 1rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  color: var(--color-copy);
  text-align: center;
}
.empty-state {
  grid-template-columns: auto auto;
  place-content: center;
  text-align: left;
}
.empty-state__icon {
  display: grid;
  place-items: center;
  width: 4rem;
  height: 4rem;
  border-radius: 50%;
  background: var(--color-blue-soft);
  color: var(--color-primary);
  font-size: 2rem;
}
.empty-state h2,
.empty-state p {
  margin: 0;
}
.empty-state p {
  max-width: 32rem;
  margin-top: 0.35rem;
}
.achievements-view {
  margin-top: 1.25rem;
}

@media (min-width: 761px) {
  .progress-tabs {
    grid-template-columns: repeat(2, 14.5rem);
    justify-content: start;
  }
  .progress-tabs button {
    min-height: 3.7rem;
  }
  .perspective-chevron {
    display: none;
  }
  .perspective-panel {
    padding: 2.2rem;
  }
  .evolution-toolbar {
    position: absolute;
    top: 1.8rem;
    right: 2.2rem;
    z-index: 1;
    margin: 0;
  }
  .perspective-header {
    padding-right: 22rem;
  }
  .metric-highlight--mobile {
    display: none;
  }
  .metric-highlight--desktop {
    position: relative;
    min-height: 7rem;
    padding: 1.15rem 7.5rem 1.15rem 1.45rem;
  }
  .metric-highlight--desktop strong {
    font-size: clamp(2rem, 3vw, 2.8rem);
  }
  .metric-highlight--desktop small {
    position: absolute;
    top: 50%;
    right: 1.25rem;
    margin: 0;
    padding: 0.5rem 0.75rem;
    border-radius: 999px;
    background: rgb(255 255 255 / 45%);
    transform: translateY(-50%);
  }
}

@media (min-width: 900px) {
  .progress-header-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(24rem, 42%);
    align-items: end;
    column-gap: clamp(2rem, 5vw, 5rem);
  }

  .progress-tabs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: 100%;
    margin-top: 0;
  }

  .progress-tabs button {
    min-height: 3.25rem;
  }
}

@media (max-width: 1050px) {
  .perspective-nav {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .analysis-grid {
    grid-template-columns: 1fr;
  }
  .breakdown-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 1rem;
  }
}

@media (max-width: 760px) {
  :deep(.app-page-header p) {
    display: none;
  }
  .progress-title-info {
    font-size: 1.35rem;
  }
  .progress-title-mark {
    display: none;
  }
  .progress-tabs {
    margin-top: 0.8rem;
  }
  .progress-tabs button {
    min-height: 3.25rem;
    font-size: 0.86rem;
  }
  .progress-tabs button .q-icon {
    font-size: 1.25rem;
  }
  .evolution-workspace {
    margin-top: 0.85rem;
  }
  .perspective-nav {
    gap: 0.65rem;
  }
  .perspective-nav button {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 0.45rem;
    min-height: 3.9rem;
    padding: 0.55rem;
    border-radius: var(--radius-md);
  }
  .perspective-nav strong {
    font-size: 0.74rem;
    line-height: 1.2;
  }
  .perspective-nav small {
    display: none;
  }
  .perspective-icon {
    width: 2rem;
    height: 2rem;
    font-size: 0.95rem;
  }
  .perspective-chevron {
    font-size: 1.1rem;
  }
  .perspective-panel {
    margin-top: 0.85rem;
    padding: 1rem 0.9rem;
    border-radius: var(--radius-lg);
  }
  .evolution-toolbar {
    display: flex;
    margin-bottom: 0.85rem;
  }
  .period-switch {
    grid-row: 1;
    width: 100%;
  }
  .period-switch button {
    flex: 1;
    min-width: 0;
  }
  .perspective-header {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  .perspective-heading h2 {
    font-size: 1.75rem;
    line-height: 1.08;
  }
  .perspective-description {
    display: none;
  }
  .metric-highlight {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    padding: 0.9rem 1rem;
  }
  .metric-highlight--desktop {
    display: none;
  }
  .metric-highlight span,
  .metric-highlight strong {
    grid-column: 1;
  }
  .metric-highlight strong {
    font-size: 1.8rem;
  }
  .metric-highlight small {
    grid-column: 2;
    grid-row: 1 / span 2;
    align-self: center;
    margin: 0;
    padding: 0.45rem 0.65rem;
    border-radius: 999px;
    background: rgb(255 255 255 / 48%);
  }
  .analysis-grid {
    margin-top: 1rem;
  }
  .chart-card,
  .breakdown-card {
    padding: 0.65rem;
  }
  .breakdown-list {
    grid-template-columns: 1fr;
  }
  .chart-note {
    font-size: 0.68rem;
  }
  .empty-state {
    grid-template-columns: 1fr;
    justify-items: center;
    padding: 2rem;
    text-align: center;
  }
}
</style>
