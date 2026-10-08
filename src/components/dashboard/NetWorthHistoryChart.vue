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
import { AriaComponent, GridComponent, TooltipComponent } from 'echarts/components'
import { init, use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { formatCurrency } from '@/utils/formatters'

use([LineChart, GridComponent, TooltipComponent, AriaComponent, CanvasRenderer])

const props = defineProps({
  points: { type: Array, required: true },
  loading: { type: Boolean, default: false },
  error: { type: Boolean, default: false },
})

const { t, locale } = useI18n()
const chartElement = ref(null)
const periods = computed(() => props.points.map((point) => point.period))
let chart = null
let resizeObserver = null

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
  () => [props.points, locale.value],
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
        label: { description: t('dashboard.financialPosition.chartAria') },
      },
      grid: { top: 20, right: 12, bottom: 38, left: 66 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0b1633',
        borderWidth: 0,
        padding: [9, 12],
        textStyle: { color: '#fff', fontSize: 12 },
        formatter: ([point]) =>
          `<strong>${formatPeriod(point.axisValue)}</strong><br/>${formatCurrency(point.data)}`,
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
      series: [
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
      ],
    },
    true,
  )
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
