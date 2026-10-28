<template>
  <div ref="chartElement" class="mortgage-comparison-chart" />
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { LineChart } from 'echarts/charts'
import { AriaComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { init, use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { formatCurrency } from '@/utils/formatters'

use([LineChart, GridComponent, LegendComponent, TooltipComponent, AriaComponent, CanvasRenderer])

const props = defineProps({
  normalSchedule: { type: Array, default: () => [] },
  acceleratedSchedule: { type: Array, default: () => [] },
  startingBalance: { type: Number, default: 0 },
  startDate: { type: String, default: '' },
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
    props.startingBalance,
    props.startDate,
    props.normalLabel,
    props.acceleratedLabel,
    props.ariaLabel,
    locale.value,
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

  const periods = [props.startDate, ...props.normalSchedule.map(({ date }) => date)]
  const normalValues = [
    props.startingBalance,
    ...props.normalSchedule.map(({ remainingBalance }) => remainingBalance),
  ]
  const acceleratedValues = [
    props.startingBalance,
    ...props.acceleratedSchedule.map(({ remainingBalance }) => remainingBalance),
  ]
  while (acceleratedValues.length < periods.length) acceleratedValues.push(null)

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
        textStyle: { color: '#526987', fontSize: 11 },
      },
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
        data: periods,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#dce5ed' } },
        axisLabel: {
          color: '#64748b',
          fontSize: 11,
          hideOverlap: true,
          margin: 12,
          formatter: (value, index) => yearLabel(value, index, periods.length),
        },
      },
      yAxis: {
        type: 'value',
        min: 0,
        splitNumber: 4,
        axisLabel: { color: '#64748b', fontSize: 11, formatter: compactCurrency },
        splitLine: { lineStyle: { color: '#edf2f5' } },
      },
      series: [
        payoffSeries(props.normalLabel, normalValues, '#0870d8'),
        payoffSeries(props.acceleratedLabel, acceleratedValues, '#0c6b4d'),
      ],
    },
    true,
  )
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
    itemStyle: { color, borderColor: '#fff', borderWidth: 2 },
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

function yearLabel(value, index, length) {
  const year = String(value || '').slice(0, 4)
  const month = String(value || '').slice(5, 7)
  return index === 0 || index === length - 1 || month === '01' ? year : ''
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
    currency: 'EUR',
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
