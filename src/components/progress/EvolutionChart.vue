<template>
  <div class="evolution-chart-shell">
    <div ref="chartElement" class="evolution-chart" />
    <div v-if="!hasData" class="evolution-chart-empty">
      <q-icon name="timeline" size="1.8rem" />
      <span>{{ emptyLabel }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { BarChart, LineChart } from 'echarts/charts'
import { AriaComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { init, use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { CHART_COLORS } from '@/config/chart-theme'
import { formatCurrency } from '@/utils/formatters'

use([
  BarChart,
  LineChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  AriaComponent,
  CanvasRenderer,
])

const props = defineProps({
  mode: { type: String, required: true },
  points: { type: Array, default: () => [] },
  series: { type: Array, default: () => [] },
  bridge: { type: Array, default: () => [] },
  startValue: { type: Number, default: 0 },
  endValue: { type: Number, default: 0 },
  startLabel: { type: String, default: '' },
  endLabel: { type: String, default: '' },
  valueType: { type: String, default: 'currency' },
  ariaLabel: { type: String, required: true },
  emptyLabel: { type: String, required: true },
})

const { locale } = useI18n()
const chartElement = ref(null)
const hasData = computed(() =>
  props.mode === 'bridge'
    ? Boolean(props.bridge.length || props.startValue || props.endValue)
    : Boolean(props.points.length),
)
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
    props.mode,
    props.points,
    props.series,
    props.bridge,
    props.startValue,
    props.endValue,
    props.ariaLabel,
    locale.value,
  ],
  () => nextTick(renderChart),
  { deep: true },
)

function renderChart() {
  if (!chart) return
  if (!hasData.value) {
    chart.clear()
    return
  }
  chart.setOption(props.mode === 'bridge' ? bridgeOptions() : timeSeriesOptions(), true)
}

function baseOptions() {
  return {
    animationDuration: 450,
    aria: { enabled: true, decal: { show: false }, label: { description: props.ariaLabel } },
    grid: { top: 48, right: 18, bottom: 58, left: 76 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: CHART_COLORS.ink,
      borderWidth: 0,
      padding: [9, 12],
      textStyle: { color: CHART_COLORS.inverse, fontSize: 12 },
    },
    yAxis: {
      type: 'value',
      splitNumber: 4,
      axisLabel: { color: CHART_COLORS.muted, fontSize: 11, formatter: compactValue },
      splitLine: { lineStyle: { color: CHART_COLORS.grid } },
    },
  }
}

function bridgeOptions() {
  const labels = [props.startLabel, ...props.bridge.map(({ label }) => label), props.endLabel]
  let running = props.startValue
  const bases = [0]
  const values = [props.startValue]
  const colors = [CHART_COLORS.ink]
  for (const item of props.bridge) {
    const next = running + item.value
    bases.push(Math.min(running, next))
    values.push(Math.abs(item.value))
    colors.push(item.value >= 0 ? CHART_COLORS.success : '#c44750')
    running = next
  }
  bases.push(0)
  values.push(props.endValue)
  colors.push(CHART_COLORS.ink)

  return {
    ...baseOptions(),
    grid: { top: 26, right: 16, bottom: 72, left: 76 },
    legend: { show: false },
    tooltip: {
      ...baseOptions().tooltip,
      formatter(items) {
        const index = items?.[0]?.dataIndex || 0
        const value =
          index === 0
            ? props.startValue
            : index === labels.length - 1
              ? props.endValue
              : props.bridge[index - 1]?.value || 0
        const signed = index > 0 && index < labels.length - 1
        return `<strong>${labels[index]}</strong><br/>${signed ? signedCurrency(value) : formatCurrency(value)}`
      },
    },
    xAxis: {
      type: 'category',
      data: labels,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: CHART_COLORS.axisSoft } },
      axisLabel: {
        color: CHART_COLORS.copy,
        fontSize: 10,
        interval: 0,
        width: 84,
        overflow: 'break',
      },
    },
    series: [
      {
        type: 'bar',
        stack: 'bridge',
        data: bases,
        silent: true,
        itemStyle: { color: 'transparent' },
        emphasis: { disabled: true },
      },
      {
        type: 'bar',
        stack: 'bridge',
        barMaxWidth: 62,
        data: values.map((value, index) => ({ value, itemStyle: { color: colors[index] } })),
        label: {
          show: labels.length <= 8,
          position: 'top',
          color: CHART_COLORS.ink,
          fontWeight: 650,
          fontSize: 10,
          formatter: ({ dataIndex }) => {
            if (dataIndex === 0) return compactValue(props.startValue)
            if (dataIndex === labels.length - 1) return compactValue(props.endValue)
            return signedCompact(props.bridge[dataIndex - 1]?.value || 0)
          },
        },
      },
    ],
  }
}

function timeSeriesOptions() {
  const stacked = props.mode === 'composition'
  return {
    ...baseOptions(),
    legend: {
      type: 'scroll',
      top: 4,
      left: 4,
      right: 4,
      itemWidth: 18,
      itemHeight: 8,
      textStyle: { color: CHART_COLORS.copy, fontSize: 11 },
    },
    tooltip: {
      ...baseOptions().tooltip,
      formatter(items) {
        const values = (Array.isArray(items) ? items : [items]).filter(
          (item) => Number(item.data) !== 0,
        )
        return `<strong>${formatPeriod(values[0]?.axisValue)}</strong><br/>${values
          .map(
            (item) =>
              `${item.marker}<span style="display:inline-block;min-width:8rem">${item.seriesName}</span> <strong>${formatValue(item.data)}</strong>`,
          )
          .join('<br/>')}`
      },
    },
    xAxis: {
      type: 'category',
      boundaryGap: props.series.some(({ type }) => type === 'bar'),
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
    series: props.series.map((item) => ({
      name: item.name,
      type: item.type || 'line',
      data: props.points.map((point) => Number(point[item.key]) || 0),
      stack: stacked ? item.stack || item.section : undefined,
      smooth: item.type === 'bar' ? false : 0.2,
      symbol: 'circle',
      symbolSize: 5,
      showSymbol: props.points.length < 15,
      barMaxWidth: 24,
      lineStyle: { width: stacked ? 1.5 : 3, color: item.color },
      itemStyle: { color: item.color, borderColor: CHART_COLORS.inverse, borderWidth: 1 },
      areaStyle: stacked
        ? { opacity: 0.65 }
        : item.area
          ? { color: item.area, opacity: 0.35 }
          : undefined,
      emphasis: { focus: 'series' },
    })),
  }
}

function formatValue(value) {
  return props.valueType === 'years'
    ? `${new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }).format(value)} years`
    : formatCurrency(value)
}

function compactValue(value) {
  if (props.valueType === 'years') return `${Number(value).toFixed(0)}y`
  return new Intl.NumberFormat(locale.value, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function signedCompact(value) {
  return `${value >= 0 ? '+' : '−'}${compactValue(Math.abs(value))}`
}

function signedCurrency(value) {
  return `${value >= 0 ? '+' : '−'}${formatCurrency(Math.abs(value))}`
}

function shortPeriod(period) {
  const [year, month] = String(period).split('-').map(Number)
  return new Intl.DateTimeFormat(locale.value, { month: 'short', year: '2-digit' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  )
}

function formatPeriod(period) {
  const [year, month] = String(period).split('-').map(Number)
  return new Intl.DateTimeFormat(locale.value, { month: 'long', year: 'numeric' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  )
}
</script>

<style scoped>
.evolution-chart-shell {
  position: relative;
  min-width: 0;
  min-height: 21rem;
}

.evolution-chart {
  width: 100%;
  height: 21rem;
}

.evolution-chart-empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 0.65rem;
  color: var(--color-muted);
  font-size: 0.88rem;
}

@media (max-width: 760px) {
  .evolution-chart-shell,
  .evolution-chart {
    min-height: 18rem;
    height: 18rem;
  }
}
</style>
