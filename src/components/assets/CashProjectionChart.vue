<template>
  <div ref="chartElement" class="cash-projection-chart" />
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { LineChart } from 'echarts/charts'
import { AriaComponent, GridComponent, TooltipComponent } from 'echarts/components'
import { init, use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { CHART_COLORS } from '@/config/chart-theme'
import { formatCurrency, workspaceCurrency } from '@/utils/formatters'

use([LineChart, GridComponent, TooltipComponent, AriaComponent, CanvasRenderer])

const props = defineProps({
  projection: { type: Array, default: () => [] },
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
  () => [props.projection, locale.value, workspaceCurrency.value],
  () => nextTick(renderChart),
  { deep: true },
)

function renderChart() {
  if (!chart || !props.projection.length) return chart?.clear()

  chart.setOption(
    {
      animationDuration: 400,
      aria: { enabled: true, label: { description: props.ariaLabel } },
      grid: { top: 28, right: 18, bottom: 42, left: 72 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: CHART_COLORS.ink,
        borderWidth: 0,
        padding: [9, 12],
        textStyle: { color: CHART_COLORS.inverse, fontSize: 12 },
        formatter: ([point]) =>
          `<strong>${t('assets.cashModel.yearLabel', { count: point.axisValue })}</strong><br/>${point.marker}${t('assets.cashModel.projection')}: <strong>${formatCurrency(point.data)}</strong>`,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: props.projection.map(({ years }) => years),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: CHART_COLORS.axis } },
        axisLabel: {
          color: CHART_COLORS.muted,
          fontSize: 11,
          hideOverlap: true,
          margin: 12,
          formatter: (value) => t('assets.cashModel.yearShort', { count: value }),
        },
      },
      yAxis: {
        type: 'value',
        splitNumber: 4,
        axisLabel: { color: CHART_COLORS.muted, fontSize: 11, formatter: compactCurrency },
        splitLine: { lineStyle: { color: CHART_COLORS.grid } },
      },
      series: [
        {
          type: 'line',
          data: props.projection.map(({ value }) => value),
          showSymbol: false,
          lineStyle: { width: 3, color: CHART_COLORS.successDark },
          itemStyle: { color: CHART_COLORS.successDark },
          areaStyle: { color: 'rgba(12, 107, 77, 0.08)' },
          emphasis: { focus: 'series' },
        },
      ],
    },
    true,
  )
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
.cash-projection-chart {
  width: 100%;
  height: clamp(17rem, 38vw, 23rem);
}
</style>
