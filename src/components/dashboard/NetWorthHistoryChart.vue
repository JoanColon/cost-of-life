<template>
  <div class="chart-shell">
    <div ref="chartElement" class="net-worth-chart" />

    <div v-if="loading" class="chart-state">
      <q-spinner color="primary" size="1.8rem" />
      <span>{{ t('dashboard.financialPosition.historyLoading') }}</span>
    </div>
    <div v-else-if="error" class="chart-state error-state">
      <q-icon name="error_outline" size="1.6rem" />
      <span>{{ t('dashboard.financialPosition.historyError') }}</span>
    </div>
    <div v-else-if="!points.length" class="chart-state empty-state">
      <div class="empty-icon"><q-icon name="show_chart" /></div>
      <strong>{{ t('dashboard.financialPosition.historyEmptyTitle') }}</strong>
      <span>{{ t('dashboard.financialPosition.historyEmptyDescription') }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { LineChart } from 'echarts/charts'
import { AriaComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { init, use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { assetCategories } from '@/config/asset-categories'
import { liabilityCategories } from '@/config/liability-categories'
import { formatCurrency } from '@/utils/formatters'

use([LineChart, GridComponent, LegendComponent, TooltipComponent, AriaComponent, CanvasRenderer])

const props = defineProps({
  points: { type: Array, required: true },
  breakdownPoints: { type: Array, default: () => [] },
  mode: { type: String, default: 'netWorth' },
  loading: { type: Boolean, default: false },
  error: { type: Boolean, default: false },
})

const { t, locale } = useI18n()
const chartElement = ref(null)
const periods = computed(() => props.points.map((point) => point.period))
const categorySeries = computed(() => [
  ...activeCategorySeries(assetCategories, 'assets', ASSET_COLORS),
  ...activeCategorySeries(liabilityCategories, 'liabilities', LIABILITY_COLORS),
])
let chart = null
let resizeObserver = null

const ASSET_COLORS = ['#159f73', '#1688f8', '#39a8a3', '#8754ed', '#4f7cac', '#73bfb8']
const LIABILITY_COLORS = ['#f27177', '#e58b43', '#d95568', '#b66d57', '#a85567', '#ef6c57']

onMounted(() => {
  chart = init(chartElement.value)
  resizeObserver = new ResizeObserver(() => chart?.resize())
  resizeObserver.observe(chartElement.value)
  renderChart()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  chart?.dispose()
})

watch(
  () => [props.points, props.breakdownPoints, props.mode, locale.value],
  () => nextTick(renderChart),
  { deep: true },
)

function renderChart() {
  if (!chart) return
  if (!props.points.length) {
    chart.clear()
    return
  }

  chart.setOption(
    {
      animationDuration: 500,
      aria: {
        enabled: true,
        decal: { show: false },
        label: {
          description: t(
            props.mode === 'breakdown'
              ? 'progress.chartBreakdownAria'
              : 'dashboard.financialPosition.chartAria',
          ),
        },
      },
      color: categorySeries.value.map(({ color }) => color),
      grid: { top: props.mode === 'breakdown' ? 64 : 20, right: 12, bottom: 38, left: 66 },
      legend:
        props.mode === 'breakdown'
          ? {
              show: true,
              type: 'scroll',
              top: 4,
              left: 8,
              right: 8,
              itemWidth: 18,
              itemHeight: 8,
              textStyle: { color: '#526987', fontSize: 11 },
              pageTextStyle: { color: '#526987' },
            }
          : { show: false },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0b1633',
        borderWidth: 0,
        padding: [9, 12],
        textStyle: { color: '#fff', fontSize: 12 },
        formatter: formatTooltip,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: periods.value,
        axisLine: { lineStyle: { color: '#dbe4eb' } },
        axisTick: { show: false },
        axisLabel: {
          color: '#64748b',
          fontSize: 11,
          hideOverlap: true,
          margin: 12,
          formatter: axisLabel,
        },
      },
      yAxis: {
        type: 'value',
        splitNumber: 4,
        axisLabel: { color: '#64748b', fontSize: 11, formatter: compactCurrency },
        splitLine: { lineStyle: { color: '#edf2f5' } },
      },
      series: props.mode === 'breakdown' ? breakdownChartSeries() : netWorthChartSeries(),
    },
    true,
  )
}

function netWorthChartSeries() {
  return [
    {
      name: t('dashboard.financialPosition.netWorth'),
      type: 'line',
      data: props.points.map((point) => point.value),
      smooth: 0.25,
      symbol: 'circle',
      symbolSize: props.points.length === 1 ? 9 : 6,
      showSymbol: props.points.length < 18,
      lineStyle: { width: 3, color: '#18b981' },
      itemStyle: { color: '#18b981', borderColor: '#fff', borderWidth: 2 },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(24, 185, 129, 0.24)' },
            { offset: 1, color: 'rgba(24, 185, 129, 0.02)' },
          ],
        },
      },
      emphasis: { focus: 'series' },
    },
  ]
}

function breakdownChartSeries() {
  return categorySeries.value.map(({ categoryId, color, name, section }) => ({
    name,
    type: 'line',
    data: props.breakdownPoints.map((point) => point[section]?.[categoryId] || 0),
    smooth: 0.2,
    symbol: 'circle',
    symbolSize: 5,
    showSymbol: props.breakdownPoints.length < 18,
    lineStyle: { width: 2, color },
    itemStyle: { color, borderColor: '#fff', borderWidth: 1 },
    emphasis: { focus: 'series', lineStyle: { width: 3 } },
  }))
}

function activeCategorySeries(categories, section, colors) {
  return categories
    .filter(({ id }) =>
      props.breakdownPoints.some((point) => Number(point[section]?.[id] || 0) !== 0),
    )
    .map((category, index) => ({
      categoryId: category.id,
      color: colors[index % colors.length],
      name: t(category.nameKey),
      section,
    }))
}

function formatTooltip(points) {
  const values = Array.isArray(points) ? points : [points]
  const lines = values
    .filter((point) => Number(point.data) !== 0 || props.mode !== 'breakdown')
    .map(
      (point) =>
        `${point.marker}<span style="display:inline-block;min-width:8rem">${point.seriesName}</span> <strong>${formatCurrency(point.data)}</strong>`,
    )
  return `<strong>${formatPeriod(values[0]?.axisValue)}</strong><br/>${lines.join('<br/>')}`
}

function axisLabel(period, index) {
  if (periods.value.length <= 18) return shortPeriod(period)
  return period.endsWith('-01') || index === 0 ? period.slice(0, 4) : ''
}

function shortPeriod(period) {
  const [year, month] = period.split('-').map(Number)
  return new Intl.DateTimeFormat(locale.value, { month: 'short', year: '2-digit' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  )
}

function formatPeriod(period) {
  const [year, month] = period.split('-').map(Number)
  return new Intl.DateTimeFormat(locale.value, { month: 'long', year: 'numeric' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  )
}

function compactCurrency(value) {
  return new Intl.NumberFormat(locale.value, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}
</script>

<style scoped lang="scss">
.chart-shell {
  position: relative;
  min-width: 0;
  min-height: 15.5rem;
}

.net-worth-chart {
  width: 100%;
  height: 15.5rem;
}

.chart-state {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 0.45rem;
  padding: 1.5rem;
  border-radius: var(--radius-md);
  background: linear-gradient(145deg, #f7fbfa, #f4f8fb);
  color: var(--color-copy);
  text-align: center;
}

.chart-state strong {
  color: var(--color-ink);
  font-size: 1rem;
}

.chart-state span {
  max-width: 22rem;
  font-size: 0.82rem;
  line-height: 1.45;
}

.empty-icon {
  display: grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
  margin-bottom: 0.2rem;
  border-radius: 50%;
  background: var(--color-green-soft);
  color: var(--color-success-dark);
  font-size: 1.45rem;
}

.error-state {
  color: var(--color-danger);
}
</style>
