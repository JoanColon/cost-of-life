<template>
  <div ref="chartElement" class="mortgage-comparison-chart" />
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { LineChart } from 'echarts/charts'
import {
  AriaComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components'
import { init, use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { CHART_COLORS } from '@/config/chart-theme'
import { calendarYearTickIndices } from '@/utils/chart-time-axis'
import { formatCurrency, workspaceCurrency } from '@/utils/formatters'

use([
  LineChart,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  AriaComponent,
  CanvasRenderer,
])

const props = defineProps({
  normalSchedule: { type: Array, default: () => [] },
  acceleratedSchedule: { type: Array, default: () => [] },
  historySchedule: { type: Array, default: () => [] },
  originalBalance: { type: Number, default: 0 },
  startingBalance: { type: Number, default: 0 },
  startDate: { type: String, default: '' },
  currentDate: { type: String, default: '' },
  normalLabel: { type: String, required: true },
  acceleratedLabel: { type: String, required: true },
  ariaLabel: { type: String, required: true },
})

const { locale } = useI18n()
const chartElement = ref(null)
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
  () => [
    props.normalSchedule,
    props.acceleratedSchedule,
    props.historySchedule,
    props.originalBalance,
    props.startingBalance,
    props.startDate,
    props.currentDate,
    props.normalLabel,
    props.acceleratedLabel,
    props.ariaLabel,
    locale.value,
    workspaceCurrency.value,
  ],
  () => nextTick(renderChart),
  { deep: true },
)

function renderChart() {
  if (!chart) return
  if (!props.normalSchedule.length) {
    chart.clear()
    return
  }

  const historicalPoints = []
  appendPoint(historicalPoints, props.startDate, props.originalBalance || props.startingBalance)
  props.historySchedule.forEach(({ date, remainingBalance }) =>
    appendPoint(historicalPoints, date, remainingBalance),
  )
  appendPoint(historicalPoints, props.currentDate, props.startingBalance)

  const periods = [
    ...historicalPoints.map(({ date }) => date),
    ...props.normalSchedule.map(({ date }) => date),
  ]
  const historicalValues = historicalPoints.map(({ balance }) => balance)
  const normalValues = [
    ...historicalValues,
    ...props.normalSchedule.map(({ remainingBalance }) => remainingBalance),
  ]
  const acceleratedValues = [
    ...historicalValues.slice(0, -1).map(() => null),
    historicalValues.at(-1),
    ...props.acceleratedSchedule.map(({ remainingBalance }) => remainingBalance),
  ]
  while (acceleratedValues.length < periods.length) acceleratedValues.push(null)
  const yearLabels = calendarYearTickIndices(periods)

  const normalSeries = payoffSeries(props.normalLabel, normalValues, CHART_COLORS.primary)
  if (props.currentDate) {
    normalSeries.markLine = {
      silent: true,
      symbol: 'none',
      label: { show: false },
      lineStyle: { color: CHART_COLORS.mutedLight, type: 'dashed', width: 1.5 },
      data: [{ xAxis: props.currentDate }],
    }
  }

  chart.setOption(
    {
      animationDuration: 400,
      aria: { enabled: true, label: { description: props.ariaLabel } },
      grid: { top: 48, right: 18, bottom: 42, left: 72 },
      legend: {
        top: 4,
        left: 4,
        itemWidth: 22,
        itemHeight: 8,
        textStyle: { color: CHART_COLORS.copy, fontSize: 11 },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: CHART_COLORS.ink,
        borderWidth: 0,
        padding: [9, 12],
        textStyle: { color: CHART_COLORS.inverse, fontSize: 12 },
        formatter: formatTooltip,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: periods,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: CHART_COLORS.axis } },
        axisLabel: {
          color: CHART_COLORS.muted,
          fontSize: 11,
          interval: (index) => yearLabels.has(index),
          hideOverlap: true,
          margin: 12,
          showMaxLabel: true,
          formatter: (_value, index) => yearLabels.get(index) || '',
        },
      },
      yAxis: {
        type: 'value',
        min: 0,
        splitNumber: 4,
        axisLabel: { color: CHART_COLORS.muted, fontSize: 11, formatter: compactCurrency },
        splitLine: { lineStyle: { color: CHART_COLORS.grid } },
      },
      series: [
        normalSeries,
        payoffSeries(props.acceleratedLabel, acceleratedValues, CHART_COLORS.successDark),
      ],
    },
    true,
  )
}

function appendPoint(points, date, balance) {
  if (!date) return
  const point = { date, balance: Number(balance) || 0 }
  if (points.at(-1)?.date === date) points[points.length - 1] = point
  else points.push(point)
}

function payoffSeries(name, data, color) {
  return {
    name,
    type: 'line',
    data,
    connectNulls: false,
    showSymbol: false,
    symbol: 'circle',
    lineStyle: { width: 3, color },
    itemStyle: { color, borderColor: CHART_COLORS.inverse, borderWidth: 2 },
    emphasis: { focus: 'series', lineStyle: { width: 4 } },
  }
}

function formatTooltip(points) {
  const values = (Array.isArray(points) ? points : [points]).filter(({ data }) => data != null)
  return `<strong>${formatMonthYear(values[0]?.axisValue)}</strong><br/>${values
    .map(
      ({ marker, seriesName, data }) =>
        `${marker}<span style="display:inline-block;min-width:9rem">${seriesName}</span> <strong>${formatCurrency(data)}</strong>`,
    )
    .join('<br/>')}`
}

function formatMonthYear(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat(locale.value, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

function compactCurrency(value) {
  return new Intl.NumberFormat(locale.value, {
    notation: 'compact',
    style: 'currency',
    currency: workspaceCurrency.value,
    maximumFractionDigits: 1,
  }).format(value)
}
</script>

<style scoped>
.mortgage-comparison-chart {
  width: 100%;
  height: 21rem;
}

@media (max-width: 760px) {
  .mortgage-comparison-chart {
    height: 17rem;
  }
}
</style>
