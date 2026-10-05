<template>
  <div ref="chartEl" class="basic-chart" :style="{ height }" />
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { init, use } from 'echarts/core'
import { CanvasRenderer, SVGRenderer } from 'echarts/renderers'

use([BarChart, LineChart, GridComponent, TooltipComponent, CanvasRenderer, SVGRenderer])

const props = defineProps({
  options: {
    type: Object,
    required: true,
  },
  height: {
    type: String,
    default: '180px',
  },
  renderer: {
    type: String,
    default: 'canvas',
  },
  autoresize: {
    type: Boolean,
    default: true,
  },
})
const emit = defineEmits(['chart-click'])

const chartEl = ref(null)
let chart = null
let resizeObserver = null

watch(
  () => props.options,
  (options) => {
    if (!chart) return
    chart.setOption(options, true)
  },
  { deep: true },
)

onMounted(async () => {
  await nextTick()
  if (!chartEl.value) return

  chart = init(chartEl.value, null, { renderer: props.renderer })
  chart.setOption(props.options, true)
  chart.on('click', handleChartClick)

  if (props.autoresize) {
    resizeObserver = new ResizeObserver(() => {
      chart?.resize()
    })
    resizeObserver.observe(chartEl.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  chart?.off('click', handleChartClick)
  chart?.dispose()
  chart = null
})

function handleChartClick(params) {
  emit('chart-click', params)
}
</script>
