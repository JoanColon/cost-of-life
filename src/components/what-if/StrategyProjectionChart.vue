<template>
  <div ref="chartElement" class="strategy-projection-chart" />
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { LineChart } from 'echarts/charts'
import { AriaComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { init, use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { CHART_COLORS } from '@/config/chart-theme'
import { currentFinancialYear } from '@/domain/financial/financial-year'
import { calendarYearAtMonth } from '@/utils/chart-time-axis'
import { formatCurrency, workspaceCurrency } from '@/utils/formatters'

use([LineChart, GridComponent, LegendComponent, TooltipComponent, AriaComponent, CanvasRenderer])

const props = defineProps({
  strategyPoints: { type: Array, required: true },
  baselinePoints: { type: Array, default: () => [] },
  mode: { type: String, default: 'total' },
  breakdownTypes: { type: Array, default: () => [] },
  baselineLabel: { type: String, default: '' },
  strategyLabel: { type: String, default: '' },
  ariaLabel: { type: String, default: '' },
})

const { t } = useI18n()
const chartElement = ref(null)
const investmentSeries = computed(() =>
  INVESTMENT_TYPES.filter(({ id }) =>
    props.strategyPoints.some((point) => Number(point.breakdown?.[id] || 0) !== 0),
  ),
)
const breakdownSeriesTypes = computed(() =>
  (props.breakdownTypes.length ? props.breakdownTypes : investmentSeries.value).filter(({ id }) =>
    props.strategyPoints.some((point) => Number(point.breakdown?.[id] || 0) !== 0),
  ),
)
let chart = null
let resizeObserver = null

const INVESTMENT_TYPES = [
  { id: 'stockMarket', color: CHART_COLORS.primary },
  { id: 'realEstate', color: CHART_COLORS.successDark },
  { id: 'fixedIncome', color: CHART_COLORS.purple },
  { id: 'crypto', color: CHART_COLORS.warning },
  { id: 'businessEquity', color: '#39a8a3' },
  { id: 'other', color: CHART_COLORS.mutedLight },
]

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
    props.strategyPoints,
    props.baselinePoints,
    props.mode,
    props.breakdownTypes,
    props.baselineLabel,
    props.strategyLabel,
    props.ariaLabel,
    workspaceCurrency.value,
  ],
  () => nextTick(renderChart),
  { deep: true },
)

function renderChart() {
  if (!chart) return
  const startYear = currentFinancialYear()
  const years = props.strategyPoints.map(({ month }) => calendarYearAtMonth(startYear, month))
  chart.setOption(
    {
      animationDuration: 350,
      aria: {
        enabled: true,
        label: {
          description:
            props.ariaLabel ||
            t(
              props.mode === 'breakdown'
                ? 'whatIf.strategy.chartBreakdownAria'
                : 'whatIf.strategy.chartTotalAria',
            ),
        },
      },
      grid: { top: 50, right: 18, bottom: 28, left: 62 },
      legend: {
        show: true,
        type: 'scroll',
        top: 4,
        left: 8,
        right: 8,
        itemWidth: 18,
        itemHeight: 8,
        textStyle: { color: CHART_COLORS.copy, fontSize: 11 },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: CHART_COLORS.ink,
        borderWidth: 0,
        textStyle: { color: CHART_COLORS.inverse },
        formatter: (points) =>
          `<strong>${points[0]?.axisValue || startYear}</strong><br/>${points
            .map(
              ({ marker, seriesName, data }) => `${marker}${seriesName}: ${formatCurrency(data)}`,
            )
            .join('<br/>')}`,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: years,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: CHART_COLORS.axis } },
        axisLabel: {
          color: CHART_COLORS.mutedLight,
          formatter: (value, index) =>
            years.length <= 12 ||
            index === 0 ||
            index === years.length - 1 ||
            (Number(value) - startYear) % 5 === 0
              ? `${value}`
              : '',
        },
      },
      yAxis: {
        type: 'value',
        splitNumber: 4,
        axisLabel: { color: CHART_COLORS.mutedLight, formatter: compactValue },
        splitLine: { lineStyle: { color: CHART_COLORS.grid } },
      },
      series: props.mode === 'breakdown' ? breakdownChartSeries() : totalChartSeries(),
    },
    true,
  )
}

function totalChartSeries() {
  return [
    {
      name: props.baselineLabel || t('whatIf.strategy.regularInvestment'),
      type: 'line',
      data: props.baselinePoints.map(({ value }) => value),
      smooth: 0.25,
      showSymbol: false,
      lineStyle: { width: 3, color: CHART_COLORS.primary },
      itemStyle: { color: CHART_COLORS.primary },
      emphasis: { focus: 'series', lineStyle: { width: 4 } },
    },
    {
      name: props.strategyLabel || t('whatIf.strategy.strategyInvestment'),
      type: 'line',
      data: props.strategyPoints.map(({ value }) => value),
      smooth: 0.25,
      showSymbol: false,
      lineStyle: { width: 3, color: CHART_COLORS.successDark },
      itemStyle: { color: CHART_COLORS.successDark },
      emphasis: { focus: 'series', lineStyle: { width: 4 } },
    },
  ]
}

function breakdownChartSeries() {
  return breakdownSeriesTypes.value.map(({ id, color, label }) => ({
    name: label || t(`plan.investments.${id}`),
    type: 'line',
    data: props.strategyPoints.map((point) => point.breakdown?.[id] || 0),
    smooth: 0.2,
    showSymbol: props.strategyPoints.length <= 12,
    symbol: 'circle',
    symbolSize: 5,
    lineStyle: { width: 2, color },
    itemStyle: { color, borderColor: CHART_COLORS.inverse, borderWidth: 1 },
    emphasis: { focus: 'series', lineStyle: { width: 3 } },
  }))
}

function compactValue(value) {
  return new Intl.NumberFormat('en', {
    notation: 'compact',
    style: 'currency',
    currency: workspaceCurrency.value,
    maximumFractionDigits: 1,
  }).format(value)
}
</script>

<style scoped>
.strategy-projection-chart {
  width: 100%;
  height: 18rem;
}

@media (max-width: 760px) {
  .strategy-projection-chart {
    height: 15rem;
  }
}
</style>
