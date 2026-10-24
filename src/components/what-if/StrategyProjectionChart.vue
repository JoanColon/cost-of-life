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
import { formatCurrency } from '@/utils/formatters'

use([LineChart, GridComponent, LegendComponent, TooltipComponent, AriaComponent, CanvasRenderer])

const props = defineProps({
  strategyPoints: { type: Array, required: true },
  seriesName: { type: String, default: 'Scenario' },
  mode: { type: String, default: 'total' },
})

const { t } = useI18n()
const chartElement = ref(null)
const investmentSeries = computed(() =>
  INVESTMENT_TYPES.filter(({ id }) =>
    props.strategyPoints.some((point) => Number(point.breakdown?.[id] || 0) !== 0),
  ),
)
let chart = null
let resizeObserver = null

const INVESTMENT_TYPES = [
  { id: 'stockMarket', color: '#1688f8' },
  { id: 'realEstate', color: '#159f73' },
  { id: 'fixedIncome', color: '#8754ed' },
  { id: 'crypto', color: '#e58b43' },
  { id: 'businessEquity', color: '#39a8a3' },
  { id: 'other', color: '#7f90a5' },
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
  () => [props.strategyPoints, props.seriesName, props.mode],
  () => nextTick(renderChart),
  { deep: true },
)

function renderChart() {
  if (!chart) return
  const years = props.strategyPoints.map(({ month }) => month / 12)
  chart.setOption(
    {
      animationDuration: 350,
      aria: {
        enabled: true,
        label: {
          description: t(
            props.mode === 'breakdown'
              ? 'whatIf.strategy.chartBreakdownAria'
              : 'whatIf.strategy.chartTotalAria',
          ),
        },
      },
      grid: { top: props.mode === 'breakdown' ? 50 : 16, right: 18, bottom: 28, left: 62 },
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
            }
          : { show: false },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0b1633',
        borderWidth: 0,
        textStyle: { color: '#fff' },
        formatter: (points) =>
          `<strong>Year ${points[0]?.axisValue || 0}</strong><br/>${points
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
        axisLine: { lineStyle: { color: '#dce5ed' } },
        axisLabel: {
          color: '#7f90a5',
          formatter: (value, index) =>
            years.length <= 12 || index === 0 || Number(value) % 5 === 0 ? `${value}` : '',
        },
      },
      yAxis: {
        type: 'value',
        splitNumber: 4,
        axisLabel: { color: '#7f90a5', formatter: compactValue },
        splitLine: { lineStyle: { color: '#edf2f5' } },
      },
      series: props.mode === 'breakdown' ? breakdownChartSeries() : totalChartSeries(),
    },
    true,
  )
}

function totalChartSeries() {
  return [
    {
      name: props.seriesName,
      type: 'line',
      data: props.strategyPoints.map(({ value }) => value),
      smooth: 0.25,
      showSymbol: false,
      lineStyle: { width: 3, color: '#1688f8' },
      itemStyle: { color: '#1688f8' },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(22, 136, 248, .2)' },
            { offset: 1, color: 'rgba(22, 136, 248, .01)' },
          ],
        },
      },
    },
  ]
}

function breakdownChartSeries() {
  return investmentSeries.value.map(({ id, color }) => ({
    name: t(`plan.investments.${id}`),
    type: 'line',
    data: props.strategyPoints.map((point) => point.breakdown?.[id] || 0),
    smooth: 0.2,
    showSymbol: props.strategyPoints.length <= 12,
    symbol: 'circle',
    symbolSize: 5,
    lineStyle: { width: 2, color },
    itemStyle: { color, borderColor: '#fff', borderWidth: 1 },
    emphasis: { focus: 'series', lineStyle: { width: 3 } },
  }))
}

function compactValue(value) {
  return new Intl.NumberFormat('en', {
    notation: 'compact',
    style: 'currency',
    currency: 'EUR',
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
