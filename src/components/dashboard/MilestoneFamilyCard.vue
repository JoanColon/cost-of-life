<template>
  <article class="family-card" :class="`family--${family.id}`">
    <header class="family-heading">
      <span class="family-icon"><q-icon :name="family.icon" /></span>
      <div>
        <strong>{{ t(`milestones.families.${family.id}.title`) }}</strong>
        <span>{{ t(`milestones.families.${family.id}.shortDescription`) }}</span>
      </div>
    </header>

    <template v-if="family.milestone">
      <div class="target-heading">
        <strong>{{ t(`milestones.items.${family.milestone.id}`) }}</strong>
        <b :class="{ completed: family.completed }">
          <q-icon v-if="family.completed" name="check_circle" />
          {{ percentage }}%
        </b>
      </div>
      <p>{{ description }}</p>
      <div class="current-target">{{ currentTargetLabel }}</div>
      <q-linear-progress
        rounded
        size="0.65rem"
        color="primary"
        track-color="grey-3"
        :value="progressValue"
      />
    </template>
    <p v-else class="unavailable">{{ t('milestones.upNext.notRelevant') }}</p>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatCurrency } from '@/utils/formatters'

const props = defineProps({
  family: { type: Object, required: true },
})
const { t } = useI18n()

const progressValue = computed(() =>
  props.family.completed ? 1 : props.family.milestone?.progress || 0,
)
const percentage = computed(() => Math.round(progressValue.value * 100))
const currentTargetLabel = computed(() => {
  const milestone = props.family.milestone
  if (!milestone) return ''

  const currentValue = props.family.completed ? milestone.target : milestone.currentValue
  if (milestone.family === 'safety') {
    return t('milestones.values.monthsCurrentTarget', {
      current: formatDecimal(currentValue),
      target: milestone.target,
    })
  }
  if (milestone.family === 'freedom') {
    return t('milestones.values.yearsCurrentTarget', {
      current: formatDecimal(currentValue),
      target: milestone.target,
    })
  }
  if (milestone.family === 'debt') {
    return t('milestones.values.remaining', { value: formatCurrency(currentValue) })
  }
  if (milestone.id === 'net_worth_positive') {
    return t('milestones.values.netWorth', { value: formatCurrency(currentValue) })
  }
  return `${formatCurrency(currentValue)} / ${formatCurrency(milestone.target)}`
})
const description = computed(() => {
  const milestone = props.family.milestone
  if (!milestone) return ''

  if (milestone.family === 'safety') {
    return t('milestones.descriptions.safety', { target: milestone.target })
  }
  if (milestone.family === 'freedom') {
    return t('milestones.descriptions.freedom', { target: milestone.target })
  }
  if (milestone.family === 'netWorth') {
    return milestone.id === 'net_worth_positive'
      ? t('milestones.descriptions.netWorthPositive')
      : t('milestones.descriptions.netWorth', { target: formatCurrency(milestone.target) })
  }
  return t(`milestones.descriptions.${milestone.id}`)
})

function formatDecimal(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(Number(value || 0))
}
</script>

<style scoped lang="scss">
.family-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 1.1rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  color: var(--color-ink);
  text-align: left;
}

.family-heading,
.target-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.family-heading > div {
  display: grid;
  flex: 1;
  min-width: 0;
}

.family-heading span,
.family-card p,
.current-target,
.unavailable {
  color: var(--color-copy);
}

.family-heading > div > span {
  margin-top: 0.15rem;
  font-size: 0.78rem;
}

.family-icon {
  display: grid;
  place-items: center;
  flex: 0 0 2.75rem;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 50%;
  background: var(--color-green-soft);
  color: var(--color-success-dark);
  font-size: 1.25rem;
}

.family--netWorth .family-icon {
  background: var(--color-blue-soft);
  color: var(--color-primary);
}

.family--debt .family-icon {
  background: var(--color-red-soft);
  color: var(--color-danger);
}

.family--freedom .family-icon {
  background: var(--color-purple-soft);
  color: var(--color-purple);
}

.target-heading {
  align-items: flex-start;
  margin-top: 1.4rem;
}

.target-heading strong {
  font-size: 0.95rem;
}

.target-heading b {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 1.25rem;
}

.target-heading b.completed {
  color: var(--color-success-dark);
}

.family-card p {
  min-height: 2.5em;
  margin: 0.25rem 0 0;
  font-size: 0.75rem;
}

.current-target {
  margin: auto 0 0.4rem;
  padding-top: 1.1rem;
  font-size: 0.78rem;
}

.unavailable {
  display: flex;
  align-items: center;
  min-height: 7.3rem;
  margin: 0;
}

@media (max-width: 599px) {
  .family-card {
    padding: 1rem;
  }

  .target-heading {
    margin-top: 1rem;
  }

  .current-target {
    padding-top: 0.75rem;
  }
}
</style>
