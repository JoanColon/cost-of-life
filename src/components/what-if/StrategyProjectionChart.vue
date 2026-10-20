<template>
  <div ref="chartElement" class="strategy-projection-chart" />
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { LineChart } from 'echarts/charts'
import { AriaComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { init, use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { formatCurrency } from '@/utils/formatters'

use([LineChart, GridComponent, LegendComponent, TooltipComponent, AriaComponent, CanvasRenderer])

const props = defineProps({
  strategyPoints: { type: Array, required: true },
  seriesName: { type: String, default: 'Scenario' },
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
  () => [props.strategyPoints, props.seriesName],
  () => nextTick(renderChart),
  { deep: true },
)

function renderChart() {
  if (!chart) return
  const years = props.strategyPoints.map(({ month }) => month / 12)
  chart.setOption(
    {
      animationDuration: 350,
      aria: { enabled: true },
      grid: { top: 16, right: 18, bottom: 28, left: 62 },
      legend: { show: false },
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
      series: [
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
      ],
    },
    true,
  )
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
