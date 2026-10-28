<template>
  <div class="comparison-chart">
    <div class="chart-legend" aria-hidden="true">
      <span><i class="normal" />{{ normalLabel }}</span>
      <span><i class="accelerated" />{{ acceleratedLabel }}</span>
    </div>
    <svg viewBox="0 0 720 260" preserveAspectRatio="none" role="img" :aria-label="ariaLabel">
      <line v-for="line in gridLines" :key="line" x1="0" x2="720" :y1="line" :y2="line" />
      <path v-if="chart.normal" class="balance-line normal" :d="chart.normal" />
      <path v-if="chart.accelerated" class="balance-line accelerated" :d="chart.accelerated" />
      <circle
        v-if="chart.normalEnd"
        class="endpoint normal"
        :cx="chart.normalEnd.x"
        :cy="chart.normalEnd.y"
        r="5"
      />
      <circle
        v-if="chart.acceleratedEnd"
        class="endpoint accelerated"
        :cx="chart.acceleratedEnd.x"
        :cy="chart.acceleratedEnd.y"
        r="5"
      />
    </svg>
    <div v-if="normalSchedule.length" class="chart-labels">
      <span>{{ formatMonthYear(startDate) }}</span>
      <span>{{ formatMonthYear(normalSchedule.at(-1)?.date) }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  normalSchedule: { type: Array, default: () => [] },
  acceleratedSchedule: { type: Array, default: () => [] },
  startingBalance: { type: Number, default: 0 },
  startDate: { type: String, default: '' },
  normalLabel: { type: String, required: true },
  acceleratedLabel: { type: String, required: true },
  ariaLabel: { type: String, required: true },
})

const gridLines = [20, 80, 140, 200, 260]
const chart = computed(() => buildChart(props))

function buildChart({ normalSchedule, acceleratedSchedule, startingBalance }) {
  if (!normalSchedule.length) return {}
  const width = 720
  const height = 260
  const padding = 8
  const maximum = Math.max(1, Number(startingBalance) || 0)
  const totalMonths = Math.max(1, normalSchedule.length)

  function lineFor(schedule) {
    const points = [
      { paymentNumber: 0, remainingBalance: maximum },
      ...schedule.filter(
        (payment, index) => (index + 1) % 12 === 0 || index === schedule.length - 1,
      ),
    ].map(({ paymentNumber, remainingBalance }) => ({
      x: padding + (paymentNumber / totalMonths) * (width - padding * 2),
      y: padding + (1 - remainingBalance / maximum) * (height - padding * 2),
    }))
    return {
      path: points
        .map(({ x, y }, index) => `${index ? 'L' : 'M'} ${x.toFixed(2)} ${y.toFixed(2)}`)
        .join(' '),
      end: points.at(-1),
    }
  }

  const normal = lineFor(normalSchedule)
  const accelerated = lineFor(acceleratedSchedule)
  return {
    normal: normal.path,
    accelerated: accelerated.path,
    normalEnd: normal.end,
    acceleratedEnd: accelerated.end,
  }
}

function formatMonthYear(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-IE', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}
</script>

<style scoped lang="scss">
.comparison-chart {
  min-width: 0;
}

.chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 0.75rem;
  color: var(--color-copy);
  font-size: 0.78rem;
  font-weight: 650;
}

.chart-legend span {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.chart-legend i {
  width: 1.5rem;
  height: 0.2rem;
  border-radius: 999px;
}

.chart-legend i.normal {
  background: var(--color-primary);
}

.chart-legend i.accelerated {
  background: var(--color-success-dark);
}

svg {
  display: block;
  width: 100%;
  height: clamp(13rem, 36vw, 21rem);
  overflow: visible;
}

svg > line {
  stroke: var(--color-line);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.balance-line {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 3;
  vector-effect: non-scaling-stroke;
}

.balance-line.normal,
.endpoint.normal {
  stroke: var(--color-primary);
}

.balance-line.accelerated,
.endpoint.accelerated {
  stroke: var(--color-success-dark);
}

.endpoint {
  fill: white;
  stroke-width: 3;
  vector-effect: non-scaling-stroke;
}

.chart-labels {
  display: flex;
  justify-content: space-between;
  color: var(--color-copy);
  font-size: 0.75rem;
  font-weight: 650;
}
</style>
