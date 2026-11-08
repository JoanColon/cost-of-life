<template>
  <div class="progress-chart-shell">
    <div ref="chartElement" class="progress-trend-chart" />
    <div v-if="!points.length" class="progress-chart-empty">
      <q-icon name="timeline" size="1.7rem" />
      <span>{{ emptyLabel }}</span>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { LineChart } from 'echarts/charts'
import { AriaComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { init, use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { CHART_COLORS } from '@/config/chart-theme'
import { formatCurrency } from '@/utils/formatters'

use([LineChart, GridComponent, LegendComponent, TooltipComponent, AriaComponent, CanvasRenderer])

const props = defineProps({
  points: { type: Array, required: true },
  series: { type: Array, required: true },
  valueType: { type: String, default: 'currency' },
  periodType: { type: String, default: 'month' },
  ariaLabel: { type: String, required: true },
  emptyLabel: { type: String, required: true },
})

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
  () => [props.points, props.series, props.valueType, props.periodType, props.ariaLabel],
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
      animationDuration: 450,
      aria: { enabled: true, decal: { show: false }, label: { description: props.ariaLabel } },
      color: props.series.map(({ color }) => color),
      grid: { top: props.series.length > 1 ? 46 : 18, right: 12, bottom: 34, left: 72 },
      legend:
        props.series.length > 1
          ? {
              top: 4,
              left: 4,
              itemWidth: 18,
              itemHeight: 8,
              textStyle: { color: CHART_COLORS.copy, fontSize: 11 },
            }
          : { show: false },
      tooltip: {
        trigger: 'axis',
        backgroundColor: CHART_COLORS.ink,
        borderWidth: 0,
        padding: [9, 12],
        textStyle: { color: CHART_COLORS.inverse, fontSize: 12 },
        formatter: tooltipFormatter,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: props.points.map(({ period }) => period),
        axisLine: { lineStyle: { color: CHART_COLORS.axisSoft } },
        axisTick: { show: false },
        axisLabel: {
          color: CHART_COLORS.muted,
          fontSize: 11,
          hideOverlap: true,
          margin: 12,
          formatter: shortPeriod,
        },
      },
      yAxis: {
        type: 'value',
        splitNumber: 4,
        axisLabel: { color: CHART_COLORS.muted, fontSize: 11, formatter: compactValue },
        splitLine: { lineStyle: { color: CHART_COLORS.grid } },
      },
      series: props.series.map((item) => ({
        name: item.name,
        type: 'line',
        data: props.points.map((point) => Number(point[item.key]) || 0),
        smooth: 0.25,
        symbol: 'circle',
        symbolSize: 6,
        showSymbol: props.points.length < 18,
        lineStyle: { width: 3, color: item.color },
        itemStyle: { color: item.color, borderColor: CHART_COLORS.inverse, borderWidth: 2 },
        areaStyle: item.area
          ? {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: item.area },
                  { offset: 1, color: 'rgba(255,255,255,0)' },
                ],
              },
            }
          : undefined,
      })),
    },
    true,
  )
}

function tooltipFormatter(items) {
  const values = Array.isArray(items) ? items : [items]
  const rows = values.map(
    (item) =>
      `${item.marker}<span style="display:inline-block;min-width:7rem">${item.seriesName}</span> <strong>${formatValue(item.data)}</strong>`,
  )
  return `<strong>${formatPeriod(values[0]?.axisValue)}</strong><br/>${rows.join('<br/>')}`
}

function formatValue(value) {
  return props.valueType === 'years' ? `${Number(value).toFixed(1)} years` : formatCurrency(value)
}

function compactValue(value) {
  if (props.valueType === 'years') return `${Number(value).toFixed(0)}y`
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  )
}

function shortPeriod(period) {
  if (props.periodType === 'year') return String(period).slice(0, 4)
  const [year, month] = String(period).split('-').map(Number)
  return new Intl.DateTimeFormat('en', { month: 'short', year: '2-digit' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  )
}

function formatPeriod(period) {
  if (props.periodType === 'year') return String(period).slice(0, 4)
  const [year, month] = String(period).split('-').map(Number)
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  )
}
</script>

<style scoped>
.progress-chart-shell {
  position: relative;
  min-height: 15rem;
}

.progress-trend-chart {
  width: 100%;
  height: 15rem;
}

.progress-chart-empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 0.6rem;
  color: var(--color-muted);
  font-size: 0.85rem;
}
</style>
