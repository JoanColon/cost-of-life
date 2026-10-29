<template>
  <article class="allocation-chart-card">
    <header>
      <div>
        <h3>{{ title }}</h3>
        <p>{{ subtitle }}</p>
      </div>
      <strong>{{ formattedTotal }}</strong>
    </header>

    <div v-if="groups.length" class="allocation-chart-content">
      <div ref="chartElement" class="allocation-donut" />
      <div class="allocation-breakdown">
        <button
          v-for="group in groups"
          :key="group.name"
          type="button"
          @click="$emit('select', group)"
        >
          <i :style="{ backgroundColor: colorForLabel(group.name) }" aria-hidden="true" />
          <span>
            <b>{{ group.name }}</b>
            <small>{{ formatPercentage(group.percentage) }}</small>
          </span>
          <strong>{{ formatCurrencyValue(group.value, baseCurrency, 0) }}</strong>
        </button>
      </div>
    </div>
    <div v-else class="allocation-chart-empty">{{ emptyLabel }}</div>
  </article>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { PieChart } from 'echarts/charts'
import { AriaComponent, TooltipComponent } from 'echarts/components'
import { init, use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { formatCurrencyValue } from '@/domain/financial/investment-portfolio'

use([PieChart, TooltipComponent, AriaComponent, CanvasRenderer])

const props = defineProps({
  groups: { type: Array, default: () => [] },
  colorLabels: { type: Array, default: () => [] },
  title: { type: String, required: true },
  subtitle: { type: String, required: true },
  baseCurrency: { type: String, default: '' },
  ariaLabel: { type: String, required: true },
  emptyLabel: { type: String, required: true },
})

const emit = defineEmits(['select'])
const chartElement = ref(null)
const total = computed(() => props.groups.reduce((sum, group) => sum + group.value, 0))
const formattedTotal = computed(() => formatCurrencyValue(total.value, props.baseCurrency, 0))
let chart = null
let resizeObserver = null

const COLORS = [
  '#2563eb',
  '#f97316',
  '#16a34a',
  '#dc2626',
  '#7c3aed',
  '#0891b2',
  '#ca8a04',
  '#db2777',
  '#4f46e5',
  '#65a30d',
  '#0f766e',
  '#be123c',
  '#9333ea',
  '#0369a1',
  '#c2410c',
  '#475569',
]

onMounted(() => {
  chart = init(chartElement.value)
  chart.on('click', handleChartClick)
  resizeObserver = new ResizeObserver(() => chart?.resize())
  resizeObserver.observe(chartElement.value)
  renderChart()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  chart?.dispose()
})

watch(
  () => [props.groups, props.colorLabels, props.title, props.ariaLabel, props.baseCurrency],
  () => nextTick(renderChart),
  { deep: true },
)

function renderChart() {
  if (!chart) return
  if (!props.groups.length) {
    chart.clear()
    return
  }

  chart.setOption(
    {
      animationDuration: 350,
      aria: { enabled: true, label: { description: props.ariaLabel } },
      tooltip: {
        trigger: 'item',
        backgroundColor: '#0b1633',
        borderWidth: 0,
        padding: [9, 12],
        textStyle: { color: '#fff', fontSize: 12 },
        formatter: ({ name, value, percent, marker }) =>
          `${marker}<strong>${escapeHtml(name)}</strong><br/>${formatCurrencyValue(value, props.baseCurrency, 0)} · ${formatPercentage(percent)}`,
      },
      series: [
        {
          type: 'pie',
          radius: ['58%', '82%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: true,
          label: { show: false },
          labelLine: { show: false },
          emphasis: { scaleSize: 6, label: { show: false } },
          itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 3 },
          data: props.groups.map((group) => ({
            name: group.name,
            value: group.value,
            itemStyle: { color: colorForLabel(group.name) },
          })),
        },
      ],
    },
    true,
  )
}

function handleChartClick({ name }) {
  const group = props.groups.find((candidate) => candidate.name === name)
  if (group) emit('select', group)
}

function colorForLabel(label) {
  const labels = props.colorLabels.length ? props.colorLabels : props.groups.map(({ name }) => name)
  const index = labels.indexOf(label)
  return COLORS[(index < 0 ? 0 : index) % COLORS.length]
}

function formatPercentage(value) {
  return `${new Intl.NumberFormat('en-IE', { maximumFractionDigits: 1 }).format(value)}%`
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
</script>

<style scoped lang="scss">
.allocation-chart-card {
  min-width: 0;
  padding: 1rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}

header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

header h3,
header p {
  margin: 0;
}

header h3 {
  color: var(--color-ink);
  font-size: 0.95rem;
}

header p {
  margin-top: 0.2rem;
  color: var(--color-copy);
  font-size: 0.72rem;
}

header > strong {
  color: var(--color-ink);
  font-size: 1rem;
  white-space: nowrap;
}

.allocation-chart-content {
  display: grid;
  grid-template-columns: minmax(10rem, 0.9fr) minmax(11rem, 1.1fr);
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.65rem;
}

.allocation-donut {
  width: 100%;
  height: 15rem;
}

.allocation-breakdown {
  display: grid;
  align-content: start;
  max-height: 15rem;
  overflow-y: auto;
}

.allocation-breakdown button {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.55rem;
  padding: 0.48rem 0.35rem;
  border: 0;
  border-bottom: 1px solid var(--color-line);
  background: transparent;
  color: var(--color-ink);
  text-align: left;
  cursor: pointer;
}

.allocation-breakdown button:hover,
.allocation-breakdown button:focus-visible {
  background: var(--color-surface-soft);
  outline: 0;
}

.allocation-breakdown i {
  width: 0.62rem;
  height: 0.62rem;
  border-radius: 50%;
}

.allocation-breakdown span {
  display: grid;
  min-width: 0;
}

.allocation-breakdown b {
  overflow: hidden;
  font-size: 0.75rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.allocation-breakdown small {
  color: var(--color-copy);
  font-size: 0.66rem;
}

.allocation-breakdown strong {
  font-size: 0.72rem;
  white-space: nowrap;
}

.allocation-chart-empty {
  display: grid;
  min-height: 15rem;
  place-items: center;
  color: var(--color-copy);
  font-size: 0.8rem;
}

@media (max-width: 760px) {
  .allocation-chart-content {
    grid-template-columns: 1fr;
  }

  .allocation-donut {
    height: 13rem;
  }

  .allocation-breakdown {
    max-height: 12rem;
  }
}
</style>
