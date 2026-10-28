<template>
  <div ref="chartElement" class="mortgage-balance-chart" />
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { LineChart, ScatterChart } from 'echarts/charts'
import {
  AriaComponent,
  GridComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components'
import { init, use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { formatCurrency } from '@/utils/formatters'

use([
  LineChart,
  ScatterChart,
  GridComponent,
  MarkLineComponent,
  TooltipComponent,
  AriaComponent,
  CanvasRenderer,
])

const props = defineProps({
  schedule: { type: Array, default: () => [] },
  startingBalance: { type: Number, default: 0 },
  startDate: { type: String, default: '' },
  currentDate: { type: String, default: '' },
  currentBalance: { type: Number, default: 0 },
  currentLabel: { type: String, required: true },
  ariaLabel: { type: String, required: true },
})

const { t, locale } = useI18n()
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
    props.schedule,
    props.startingBalance,
    props.startDate,
    props.currentDate,
    props.currentBalance,
    props.currentLabel,
    props.ariaLabel,
    locale.value,
  ],
  () => nextTick(renderChart),
  { deep: true },
)

function renderChart() {
  if (!chart) return
  if (!props.schedule.length) {
    chart.clear()
    return
  }

  const periods = [props.startDate, ...props.schedule.map(({ date }) => date)]
  const balances = [
    props.startingBalance,
    ...props.schedule.map(({ remainingBalance }) => remainingBalance),
  ]
  const paymentNumber = currentPaymentNumber()
  const markerPeriod = periods[paymentNumber] || periods.at(-1)

  chart.setOption(
    {
      animationDuration: 400,
      aria: { enabled: true, label: { description: props.ariaLabel } },
      grid: { top: 18, right: 18, bottom: 42, left: 72 },
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
        {
          name: t('liabilities.mortgage.balanceOverTime'),
          type: 'line',
          data: balances,
          showSymbol: false,
          lineStyle: { width: 3, color: '#0870d8' },
          itemStyle: { color: '#0870d8' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(8, 112, 216, .2)' },
                { offset: 1, color: 'rgba(8, 112, 216, .02)' },
              ],
            },
          },
        },
        {
          name: props.currentLabel,
          type: 'scatter',
          data: [[markerPeriod, props.currentBalance]],
          symbol: 'diamond',
          symbolSize: 13,
          itemStyle: { color: '#0870d8', borderColor: '#fff', borderWidth: 2 },
          z: 5,
          markLine: {
            silent: true,
            symbol: 'none',
            label: { show: false },
            lineStyle: { color: '#0870d8', type: 'dashed', width: 1.5, opacity: 0.55 },
            data: [{ xAxis: markerPeriod }],
          },
        },
      ],
    },
    true,
  )
}

function currentPaymentNumber() {
  if (props.startDate && props.currentDate <= props.startDate) return 0
  const currentPayment = props.schedule.find(({ date }) => date >= props.currentDate)
  return currentPayment?.paymentNumber ?? props.schedule.at(-1).paymentNumber
}

function formatTooltip(points) {
  const values = Array.isArray(points) ? points : [points]
  const period = values[0]?.axisValue
  return `<strong>${formatMonthYear(period)}</strong><br/>${values
    .map(({ marker, seriesName, data }) => {
      const value = Array.isArray(data) ? data[1] : data
      return `${marker}${seriesName}: <strong>${formatCurrency(value)}</strong>`
    })
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
.mortgage-balance-chart {
  width: 100%;
  height: clamp(14rem, 32vw, 20rem);
}
</style>
