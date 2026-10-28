<template>
  <div ref="chartElement" class="portfolio-history-chart" />
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { LineChart } from 'echarts/charts'
import { AriaComponent, GridComponent, TooltipComponent } from 'echarts/components'
import { init, use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { formatCurrency } from '@/utils/formatters'

use([LineChart, GridComponent, TooltipComponent, AriaComponent, CanvasRenderer])

const props = defineProps({
  points: { type: Array, default: () => [] },
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
  () => [props.points, props.ariaLabel, locale.value],
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
      animationDuration: 350,
      aria: { enabled: true, label: { description: props.ariaLabel } },
      grid: { top: 10, right: 8, bottom: 24, left: 8 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0b1633',
        borderWidth: 0,
        textStyle: { color: '#fff', fontSize: 11 },
        formatter: (points) => {
          const point = Array.isArray(points) ? points[0] : points
          return `<strong>${point.axisValue}</strong><br/>${formatCurrency(point.data)}`
        },
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: props.points.map(({ year }) => year),
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: { color: '#64748b', fontSize: 10, hideOverlap: true },
      },
      yAxis: { type: 'value', show: false, scale: true },
      series: [
        {
          type: 'line',
          data: props.points.map(({ value }) => value),
          smooth: 0.25,
          showSymbol: props.points.length <= 4,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 3, color: '#0870d8' },
          itemStyle: { color: '#0870d8', borderColor: '#fff', borderWidth: 2 },
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
      ],
    },
    true,
  )
}
</script>

<style scoped>
.portfolio-history-chart {
  width: 100%;
  height: 7.5rem;
}

@media (max-width: 760px) {
  .portfolio-history-chart {
    height: 6rem;
  }
}
</style>
