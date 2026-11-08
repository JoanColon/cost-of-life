<template>
  <div ref="chartElement" class="real-estate-chart" />
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { LineChart, ScatterChart } from 'echarts/charts'
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
import { formatCurrency, workspaceCurrency } from '@/utils/formatters'

use([
  LineChart,
  ScatterChart,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  AriaComponent,
  CanvasRenderer,
])

const props = defineProps({
  projection: { type: Array, default: () => [] },
  showMortgage: Boolean,
  showEquity: { type: Boolean, default: true },
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
    props.projection,
    props.showMortgage,
    props.showEquity,
    locale.value,
    workspaceCurrency.value,
  ],
  () => nextTick(renderChart),
  { deep: true },
)

function renderChart() {
  if (!chart || !props.projection.length) return chart?.clear()
  const periods = props.projection.map(({ date }) => date)
  const currentPoint = props.projection.find(({ isCurrent }) => isCurrent)
  const series = [line(t('assets.realEstate.propertyValue'), 'propertyValue', CHART_COLORS.primary)]
  if (props.showMortgage) {
    series.push(line(t('assets.realEstate.mortgageBalance'), 'mortgageBalance', '#dc4c64'))
  }
  if (props.showEquity) {
    series.push(line(t('assets.realEstate.homeEquity'), 'homeEquity', CHART_COLORS.successDark))
  }
  if (currentPoint) {
    series[0].markLine = {
      silent: true,
      symbol: 'none',
      label: { show: false },
      lineStyle: { color: CHART_COLORS.primary, type: 'dashed', width: 1.5, opacity: 0.55 },
      data: [{ xAxis: currentPoint.date }],
    }
    series.push(
      currentMarker(
        currentPoint,
        'propertyValue',
        CHART_COLORS.primary,
        t('assets.realEstate.propertyValue'),
      ),
    )
    if (props.showMortgage) {
      series.push(
        currentMarker(
          currentPoint,
          'mortgageBalance',
          '#dc4c64',
          t('assets.realEstate.mortgageBalance'),
        ),
      )
    }
    if (props.showEquity) {
      series.push(
        currentMarker(
          currentPoint,
          'homeEquity',
          CHART_COLORS.successDark,
          t('assets.realEstate.homeEquity'),
        ),
      )
    }
  }

  chart.setOption(
    {
      animationDuration: 400,
      aria: { enabled: true, label: { description: props.ariaLabel } },
      grid: { top: 50, right: 18, bottom: 42, left: 72 },
      legend: { top: 4, left: 4, textStyle: { color: CHART_COLORS.copy, fontSize: 11 } },
      tooltip: {
        trigger: 'axis',
        backgroundColor: CHART_COLORS.ink,
        borderWidth: 0,
        padding: [9, 12],
        textStyle: { color: CHART_COLORS.inverse, fontSize: 12 },
        formatter: (points) => formatTooltip(points, periods),
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
          interval: (index, value) =>
            shouldShowPeriodLabel(value, index, periods, currentPoint?.date),
          hideOverlap: true,
          margin: 12,
          showMaxLabel: true,
          formatter: (value, index) => periodLabel(value, index, periods, currentPoint?.date),
        },
      },
      yAxis: {
        type: 'value',
        splitNumber: 4,
        axisLabel: { color: CHART_COLORS.muted, fontSize: 11, formatter: compactCurrency },
        splitLine: { lineStyle: { color: CHART_COLORS.grid } },
      },
      series,
    },
    true,
  )
}

function line(name, field, color) {
  return {
    name,
    type: 'line',
    data: props.projection.map((point) => point[field]),
    showSymbol: false,
    lineStyle: { width: 3, color },
    itemStyle: { color },
    emphasis: { focus: 'series' },
  }
}

function currentMarker(point, field, color, name) {
  return {
    type: 'scatter',
    name,
    data: [[point.date, point[field]]],
    symbol: 'diamond',
    symbolSize: 13,
    itemStyle: { color, borderColor: CHART_COLORS.inverse, borderWidth: 2 },
    tooltip: { show: false },
    silent: true,
    z: 5,
  }
}

function formatTooltip(points) {
  const values = Array.isArray(points) ? points : [points]
  return `<strong>${formatMonthYear(values[0]?.axisValue)}</strong><br/>${values
    .map(
      ({ marker, seriesName, data }) =>
        `${marker}${seriesName}: <strong>${formatCurrency(data)}</strong>`,
    )
    .join('<br/>')}`
}

function periodLabel(value, index, periods, currentDate) {
  if (value === currentDate) return t('assets.realEstate.now')
  return String(value || '').slice(0, 4)
}

function shouldShowPeriodLabel(value, index, periods, currentDate) {
  const month = String(value || '').slice(5, 7)
  return index === 0 || index === periods.length - 1 || value === currentDate || month === '01'
}

function formatMonthYear(value) {
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
.real-estate-chart {
  width: 100%;
  height: clamp(17rem, 38vw, 23rem);
}
</style>
