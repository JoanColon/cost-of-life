<template>
  <label class="expense-month-metric">
    <span class="metric-label">{{ label }}</span>
    <span class="metric-value">
      <strong>{{ periodLabel }}</strong>
      <q-icon name="calendar_month" />
    </span>
    <input v-model="period" type="month" :aria-label="label" />
  </label>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

defineProps({ label: { type: String, required: true } })
const period = defineModel({ type: String, required: true })
const { locale } = useI18n()

const periodLabel = computed(() => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period.value)) return ''
  const [year, month] = period.value.split('-').map(Number)
  return new Intl.DateTimeFormat(locale.value, { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1),
  )
})
</script>

<style scoped lang="scss">
.expense-month-metric {
  position: relative;
  display: grid;
  min-width: 13rem;
  padding-left: 1rem;
  border-left: 1px solid var(--color-line);
  cursor: pointer;
}

.metric-label {
  color: var(--color-copy);
  font-size: 0.72rem;
}

.metric-value {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  margin-top: 0.1rem;
}

.metric-value strong {
  overflow: visible;
  margin: 0;
  color: var(--color-ink);
  font-size: 1.25rem;
  line-height: 1.1;
  text-transform: capitalize;
  white-space: nowrap;
}

.metric-value .q-icon {
  flex: 0 0 auto;
  color: var(--color-copy);
  font-size: 1rem;
}

input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  opacity: 0;
  cursor: pointer;
}

.expense-month-metric:has(input:focus-visible) {
  border-radius: 0.25rem;
  box-shadow: 0 0 0 3px var(--color-primary-focus);
}

@media (max-width: 599px) {
  .expense-month-metric {
    min-width: 0;
  }

  .metric-value strong {
    font-size: 1rem;
  }

  .metric-label {
    font-size: 0.65rem;
  }
}
</style>
