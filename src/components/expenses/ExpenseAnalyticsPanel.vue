<template>
  <section class="analytics-card">
    <header class="analytics-heading">
      <div class="analytics-heading-copy">
        <div class="analytics-title">
          <h2>{{ t('expenseTracker.analytics.title') }}</h2>
          <q-btn
            flat
            round
            dense
            icon="info_outline"
            class="analytics-info"
            :aria-label="infoAction"
            @click="openInfo"
          >
            <q-tooltip v-if="$q.screen.gt.xs" max-width="22rem">
              {{ infoDescription }}
            </q-tooltip>
          </q-btn>
        </div>
      </div>
    </header>

    <div v-show="categories.length" class="analytics-content">
      <div class="chart-wrap">
        <div ref="chartElement" class="expense-donut" />
        <div class="chart-total" aria-hidden="true">
          <strong>{{ formatCurrency(total) }}</strong>
          <span>{{ t('expenseTracker.analytics.spent') }}</span>
        </div>
      </div>

      <div class="legend-panel">
        <div class="category-breakdown">
          <button
            v-for="(category, index) in visibleCategories"
            :key="category.id"
            type="button"
            :class="{ selected: selectedCategoryId === category.id }"
            @click="selectCategory(category.id)"
          >
            <i :style="{ backgroundColor: COLORS[index % COLORS.length] }" aria-hidden="true" />
            <span>
              <strong>{{ category.name }}</strong>
              <small>{{ formatPercentage(category.percentage) }}</small>
            </span>
            <b>{{ formatCurrency(category.value) }}</b>
            <q-icon name="chevron_right" />
          </button>
        </div>

        <button
          v-if="hiddenCategoryCount"
          type="button"
          class="legend-toggle"
          :aria-expanded="legendExpanded"
          @click="legendExpanded = !legendExpanded"
        >
          <span>
            {{
              legendExpanded
                ? t('expenseTracker.analytics.showFewerCategories')
                : t('expenseTracker.analytics.showMoreCategories', {
                    count: hiddenCategoryCount,
                  })
            }}
          </span>
          <q-icon :name="legendExpanded ? 'expand_less' : 'expand_more'" />
        </button>
      </div>
    </div>

    <section v-if="selectedCategory" class="subcategory-analysis">
      <header>
        <div>
          <h3>
            {{ t('expenseTracker.analytics.breakdownTitle', { category: selectedCategory.name }) }}
          </h3>
          <p>{{ t('expenseTracker.analytics.breakdownDescription') }}</p>
        </div>
        <strong>{{ formatCurrency(selectedCategory.value) }}</strong>
      </header>

      <div class="subcategory-bars">
        <article v-for="subcategory in selectedCategory.subcategories" :key="subcategory.id">
          <div class="subcategory-label">
            <span>{{ subcategory.name }}</span>
            <strong>{{ formatCurrency(subcategory.value) }}</strong>
          </div>
          <div class="subcategory-track" aria-hidden="true">
            <span
              :style="{
                width: `${subcategoryShare(subcategory.value)}%`,
                backgroundColor: selectedCategoryColor,
              }"
            />
          </div>
          <small>{{ formatPercentage(subcategoryShare(subcategory.value)) }}</small>
        </article>
      </div>
    </section>

    <div v-if="!categories.length" class="analytics-empty">
      <span><q-icon name="donut_large" /></span>
      <h2>{{ emptyTitle }}</h2>
      <p>{{ emptyDescription }}</p>
    </div>

    <q-dialog v-model="infoOpen" position="bottom">
      <q-card class="app-info-dialog responsive-info-card">
        <span class="info-sheet-handle" aria-hidden="true" />
        <q-card-section class="app-info-heading">
          <h2>{{ infoTitle }}</h2>
          <q-btn v-close-popup flat round dense icon="close" :aria-label="t('common.close')" />
        </q-card-section>
        <q-card-section class="app-info-copy">
          <p>{{ infoDescription }}</p>
        </q-card-section>
      </q-card>
    </q-dialog>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { PieChart } from 'echarts/charts'
import { AriaComponent, TooltipComponent } from 'echarts/components'
import { init, use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { CHART_COLORS } from '@/config/chart-theme'
import { formatCurrency } from '@/utils/formatters'

use([PieChart, TooltipComponent, AriaComponent, CanvasRenderer])

const props = defineProps({
  categories: { type: Array, default: () => [] },
  granularity: {
    type: String,
    default: 'monthly',
    validator: (value) => ['monthly', 'annual'].includes(value),
  },
})
const granularity = computed(() => props.granularity)
const $q = useQuasar()
const { t, locale } = useI18n()
const chartElement = ref(null)
const selectedCategoryId = ref(null)
const legendExpanded = ref(false)
const infoOpen = ref(false)
const infoDescription = computed(() =>
  t(
    granularity.value === 'annual'
      ? 'expenseTracker.analytics.annualInfoDescription'
      : 'expenseTracker.analytics.infoDescription',
  ),
)
const infoAction = computed(() =>
  t(
    granularity.value === 'annual'
      ? 'expenseTracker.analytics.annualInfoAction'
      : 'expenseTracker.analytics.infoAction',
  ),
)
const infoTitle = computed(() =>
  t(
    granularity.value === 'annual'
      ? 'expenseTracker.analytics.annualInfoTitle'
      : 'expenseTracker.analytics.infoTitle',
  ),
)
const emptyTitle = computed(() =>
  t(
    granularity.value === 'annual'
      ? 'expenseTracker.analytics.annualEmptyTitle'
      : 'expenseTracker.analytics.emptyTitle',
  ),
)
const emptyDescription = computed(() =>
  t(
    granularity.value === 'annual'
      ? 'expenseTracker.analytics.annualEmptyDescription'
      : 'expenseTracker.analytics.emptyDescription',
  ),
)
const total = computed(() => props.categories.reduce((sum, category) => sum + category.value, 0))
const visibleCategories = computed(() =>
  legendExpanded.value ? props.categories : props.categories.slice(0, 5),
)
const hiddenCategoryCount = computed(() => Math.max(0, props.categories.length - 5))
const selectedCategory = computed(
  () => props.categories.find(({ id }) => id === selectedCategoryId.value) || null,
)
const selectedCategoryColor = computed(() => {
  const index = props.categories.findIndex(({ id }) => id === selectedCategoryId.value)
  return COLORS[(index < 0 ? 0 : index) % COLORS.length]
})
let chart = null
let resizeObserver = null

const COLORS = [
  '#1677ff',
  '#f59e0b',
  '#16a34a',
  '#7c3aed',
  '#0891b2',
  '#db2777',
  '#dc2626',
  '#4f46e5',
  '#65a30d',
  '#475569',
]

onMounted(() => {
  chart = init(chartElement.value)
  chart.on('click', handleChartClick)
  resizeObserver = new ResizeObserver(() => chart?.resize())
  resizeObserver.observe(chartElement.value)
  renderChart()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  chart?.off('click', handleChartClick)
  chart?.dispose()
})

watch(
  () => [props.categories, locale.value],
  () => nextTick(renderChart),
  { deep: true },
)

watch(
  () => props.categories,
  (categories) => {
    selectedCategoryId.value = categories[0]?.id || null
    legendExpanded.value = false
  },
  { deep: true, immediate: true },
)

function renderChart() {
  if (!chart) return
  if (!props.categories.length) {
    chart.clear()
    return
  }
  chart.setOption(
    {
      animationDuration: 350,
      aria: {
        enabled: true,
        label: {
          description: t(
            granularity.value === 'annual'
              ? 'expenseTracker.analytics.annualAriaLabel'
              : 'expenseTracker.analytics.ariaLabel',
          ),
        },
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: CHART_COLORS.ink,
        borderWidth: 0,
        padding: [9, 12],
        textStyle: { color: CHART_COLORS.inverse, fontSize: 12 },
        formatter: ({ name, value, percent, marker }) =>
          `${marker}<strong>${escapeHtml(name)}</strong><br/>${formatCurrency(value)} · ${formatPercentage(percent)}`,
      },
      series: [
        {
          type: 'pie',
          radius: ['66%', '96%'],
          center: ['50%', '50%'],
          label: { show: false },
          labelLine: { show: false },
          emphasis: { scaleSize: 5 },
          itemStyle: { borderColor: CHART_COLORS.inverse, borderWidth: 3, borderRadius: 4 },
          data: props.categories.map((category, index) => ({
            name: category.name,
            value: category.value,
            itemStyle: { color: COLORS[index % COLORS.length] },
          })),
        },
      ],
    },
    true,
  )
}

function handleChartClick({ name }) {
  const category = props.categories.find((candidate) => candidate.name === name)
  if (category) selectCategory(category.id)
}

function selectCategory(categoryId) {
  selectedCategoryId.value = categoryId
}

function openInfo() {
  if ($q.screen.lt.sm) infoOpen.value = true
}

function subcategoryShare(value) {
  return selectedCategory.value?.value > 0
    ? Math.min(100, (value / selectedCategory.value.value) * 100)
    : 0
}

function formatPercentage(value) {
  return `${new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }).format(value)}%`
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
</script>

<style scoped lang="scss">
.analytics-card {
  margin-top: 1rem;
  padding: 1.25rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.analytics-heading,
.subcategory-analysis header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.analytics-heading h2 {
  margin: 0;
}

.analytics-heading h2 {
  color: var(--color-ink);
  font-size: 1.15rem;
}

.analytics-title {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.analytics-info {
  width: 1.5rem;
  min-height: 1.5rem;
  color: var(--color-primary);
  font-size: 0.9rem;
}

.analytics-heading-copy {
  align-self: center;
}

.subcategory-analysis header > strong {
  color: var(--color-ink);
  font-size: 1.25rem;
  white-space: nowrap;
}

.analytics-content {
  display: grid;
  grid-template-columns: minmax(16rem, 0.9fr) minmax(18rem, 1.1fr);
  align-items: center;
  gap: 1.25rem;
  margin-top: 0.75rem;
}

.chart-wrap {
  position: relative;
  min-width: 0;
}

.expense-donut {
  width: 100%;
  height: clamp(18rem, 30vw, 21rem);
}

.chart-total {
  position: absolute;
  inset: 50% auto auto 50%;
  display: grid;
  max-width: 8rem;
  text-align: center;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.chart-total strong {
  overflow: hidden;
  color: var(--color-ink);
  font-size: 1.5rem;
  line-height: 1.1;
  text-overflow: ellipsis;
}

.chart-total span {
  margin-top: 0.2rem;
  color: var(--color-copy);
  font-size: 0.7rem;
}

.legend-panel,
.category-breakdown {
  display: grid;
  min-width: 0;
}

.category-breakdown button {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  min-height: 3.4rem;
  padding: 0 0.45rem;
  border: 0;
  border-bottom: 1px solid var(--color-line);
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.category-breakdown button:last-child {
  border-bottom: 0;
}

.category-breakdown button:hover,
.category-breakdown button.selected {
  border-radius: 0.65rem;
  background: var(--color-surface-soft);
}

.category-breakdown button:focus-visible {
  outline: 3px solid var(--color-primary-focus);
  outline-offset: 1px;
}

.category-breakdown i {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 50%;
}

.category-breakdown span {
  display: grid;
  min-width: 0;
}

.category-breakdown strong {
  overflow: hidden;
  color: var(--color-ink);
  font-size: 0.9rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-breakdown small {
  color: var(--color-copy);
  font-size: 0.72rem;
}

.category-breakdown b {
  color: var(--color-ink);
  font-size: 0.9rem;
  white-space: nowrap;
}

.category-breakdown .q-icon {
  color: var(--color-copy);
  font-size: 1.1rem;
}

.legend-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  min-height: 2.5rem;
  margin-top: 0.2rem;
  border: 0;
  border-top: 1px solid var(--color-line);
  background: transparent;
  color: var(--color-primary);
  font: inherit;
  font-size: 0.75rem;
  font-weight: 650;
  cursor: pointer;
}

.legend-toggle:hover {
  background: var(--color-surface-soft);
}

.legend-toggle:focus-visible {
  outline: 3px solid var(--color-primary-focus);
  outline-offset: 1px;
}

.legend-toggle .q-icon {
  font-size: 1.1rem;
}

.subcategory-analysis {
  margin-top: 1rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--color-line);
}

.subcategory-analysis header h3,
.subcategory-analysis header p {
  margin: 0;
}

.subcategory-analysis header h3 {
  color: var(--color-ink);
  font-size: 1rem;
}

.subcategory-analysis header p {
  margin-top: 0.2rem;
  color: var(--color-copy);
  font-size: 0.75rem;
}

.subcategory-bars {
  display: grid;
  gap: 0.85rem;
  margin-top: 1rem;
}

.subcategory-bars article {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.35rem 0.75rem;
}

.subcategory-label {
  display: flex;
  grid-column: 1 / -1;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  color: var(--color-ink);
  font-size: 0.82rem;
}

.subcategory-label strong {
  white-space: nowrap;
}

.subcategory-track {
  height: 0.62rem;
  overflow: hidden;
  border-radius: 999px;
  background: var(--color-surface-muted);
}

.subcategory-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  transition: width 220ms ease;
}

.subcategory-bars small {
  min-width: 3.5rem;
  color: var(--color-copy);
  font-size: 0.72rem;
  text-align: right;
}

.analytics-empty {
  display: grid;
  min-height: 20rem;
  place-content: center;
  justify-items: center;
  text-align: center;
}

.analytics-empty > span {
  display: grid;
  width: 4rem;
  height: 4rem;
  place-items: center;
  border-radius: 50%;
  background: var(--color-blue-soft);
  color: var(--color-primary);
  font-size: 2rem;
}

.analytics-empty h2 {
  margin: 1rem 0 0;
  color: var(--color-ink);
  font-size: 1.1rem;
}

.analytics-empty p {
  max-width: 28rem;
  margin: 0.35rem 0 0;
  color: var(--color-copy);
}

@media (max-width: 760px) {
  .analytics-card {
    padding: 1rem;
  }

  .analytics-content {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .analytics-heading {
    display: grid;
  }

  .expense-donut {
    height: 17rem;
  }

  header > strong {
    font-size: 1rem;
  }
}
</style>
