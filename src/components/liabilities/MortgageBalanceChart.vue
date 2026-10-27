<template>
  <div class="mortgage-chart">
    <svg viewBox="0 0 720 240" preserveAspectRatio="none" role="img" :aria-label="ariaLabel">
      <line v-for="line in gridLines" :key="line" x1="0" x2="720" :y1="line" :y2="line" />
      <path v-if="chart.area" class="chart-area" :d="chart.area" />
      <path v-if="chart.line" class="chart-line" :d="chart.line" />
      <template v-if="chart.marker">
        <line class="current-guide" :x1="chart.marker.x" :x2="chart.marker.x" y1="8" y2="232" />
        <path class="current-marker" :d="chart.marker.path">
          <title>{{ currentLabel }}</title>
        </path>
      </template>
    </svg>
    <div v-if="sampledPoints.length" class="chart-labels">
      <span>{{ formatYear(sampledPoints[0].date) }}</span>
      <span
        v-if="chart.marker"
        class="current-label"
        :style="{ left: `${chart.marker.labelPercent}%` }"
      >
        <i aria-hidden="true" />{{ currentLabel }} · {{ formatMonthYear(currentDate) }}
      </span>
      <span>{{ formatYear(sampledPoints.at(-1).date) }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  schedule: { type: Array, default: () => [] },
  startingBalance: { type: Number, default: 0 },
  startDate: { type: String, default: '' },
  currentDate: { type: String, default: '' },
  currentBalance: { type: Number, default: 0 },
  currentLabel: { type: String, required: true },
  ariaLabel: { type: String, required: true },
})

const gridLines = [24, 84, 144, 204]
const sampledPoints = computed(() => {
  if (!props.schedule.length) return []
  const points = [
    {
      paymentNumber: 0,
      date: props.startDate || props.schedule[0].date,
      remainingBalance: props.startingBalance,
    },
  ]
  props.schedule.forEach((payment, index) => {
    if ((index + 1) % 12 === 0 || index === props.schedule.length - 1) points.push(payment)
  })
  return points
})
const currentPaymentNumber = computed(() => {
  if (!props.schedule.length || !props.currentDate) return null
  if (props.startDate && props.currentDate <= props.startDate) return 0
  const currentPayment = props.schedule.find(({ date }) => date >= props.currentDate)
  return currentPayment?.paymentNumber ?? props.schedule.at(-1).paymentNumber
})
const chart = computed(() =>
  buildChart(sampledPoints.value, {
    totalPayments: props.schedule.length,
    currentPaymentNumber: currentPaymentNumber.value,
    currentBalance: props.currentBalance,
    startingBalance: props.startingBalance,
  }),
)

function buildChart(
  points,
  { totalPayments, currentPaymentNumber, currentBalance, startingBalance },
) {
  if (!points.length) return { line: '', area: '' }
  const width = 720
  const height = 240
  const padding = 8
  const maximum = Math.max(startingBalance, 1)
  const coordinates = points.map(({ paymentNumber, remainingBalance }) => ({
    x: padding + (paymentNumber / Math.max(1, totalPayments)) * (width - padding * 2),
    y: padding + (1 - remainingBalance / maximum) * (height - padding * 2),
  }))
  const line = coordinates
    .map(({ x, y }, index) => `${index ? 'L' : 'M'} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(' ')
  const first = coordinates[0]
  const last = coordinates.at(-1)
  const markerX =
    currentPaymentNumber == null
      ? null
      : padding + (currentPaymentNumber / Math.max(1, totalPayments)) * (width - padding * 2)
  const markerY =
    currentPaymentNumber == null
      ? null
      : padding + (1 - Math.min(maximum, currentBalance) / maximum) * (height - padding * 2)
  const markerSize = 7
  return {
    line,
    area: `${line} L ${last.x.toFixed(2)} ${height} L ${first.x.toFixed(2)} ${height} Z`,
    marker:
      markerX == null
        ? null
        : {
            x: markerX,
            y: markerY,
            labelPercent: Math.min(88, Math.max(12, (markerX / width) * 100)),
            path: `M ${markerX} ${markerY - markerSize} L ${markerX + markerSize} ${markerY} L ${markerX} ${markerY + markerSize} L ${markerX - markerSize} ${markerY} Z`,
          },
  }
}

function formatYear(date) {
  return String(date || '').slice(0, 4)
}

function formatMonthYear(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-IE', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}
</script>

<style scoped lang="scss">
.mortgage-chart {
  min-width: 0;
}

svg {
  display: block;
  width: 100%;
  height: clamp(12rem, 32vw, 18rem);
  overflow: visible;
}

line {
  stroke: var(--color-line);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.chart-area {
  fill: var(--color-primary);
  opacity: 0.08;
}

.chart-line {
  fill: none;
  stroke: var(--color-primary);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 3;
  vector-effect: non-scaling-stroke;
}

.current-guide {
  stroke: var(--color-primary);
  stroke-dasharray: 5 5;
  stroke-width: 1.5;
  opacity: 0.55;
}

.current-marker {
  fill: var(--color-primary);
  stroke: var(--color-surface);
  stroke-width: 3;
  vector-effect: non-scaling-stroke;
}

.chart-labels {
  position: relative;
  display: flex;
  justify-content: space-between;
  color: var(--color-copy);
  font-size: 0.75rem;
  font-weight: 650;
}

.current-label {
  position: absolute;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  transform: translateX(-50%);
  color: var(--color-primary);
  white-space: nowrap;
}

.current-label i {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 1px;
  background: var(--color-primary);
  transform: rotate(45deg);
}
</style>
