<template>
  <DashboardCard
    :title="t('milestones.home.title')"
    :subtitle="t('milestones.home.subtitle')"
    icon="flag"
    icon-tone="purple"
  >
    <template #action>
      <q-btn
        flat
        no-caps
        color="primary"
        icon-right="arrow_forward"
        :label="t('milestones.home.viewAll')"
        class="view-progress"
        @click="$emit('open')"
      />
    </template>

    <div v-if="loading" class="milestone-loading">
      <q-spinner color="primary" size="1.5rem" />
      <span>{{ t('milestones.loading') }}</span>
    </div>
    <div v-else-if="error" class="milestone-error">
      <q-icon name="cloud_off" size="1.5rem" />
      <span>{{ t('milestones.error') }}</span>
      <q-btn
        flat
        dense
        no-caps
        color="primary"
        :label="t('milestones.home.viewAll')"
        @click="$emit('open')"
      />
    </div>
    <div v-else class="family-grid">
      <article
        v-for="family in familySummaries"
        :key="family.id"
        class="family-card"
        :class="`family--${family.id}`"
      >
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
              {{ percentage(family) }}%
            </b>
          </div>
          <p>{{ descriptionFor(family.milestone) }}</p>
          <div class="current-target">{{ currentTargetLabel(family) }}</div>
          <q-linear-progress
            rounded
            size="0.65rem"
            color="primary"
            track-color="grey-3"
            :value="progressValue(family)"
          />
        </template>
        <p v-else class="unavailable">{{ t('milestones.upNext.notRelevant') }}</p>
      </article>
    </div>
  </DashboardCard>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { milestoneFamilies } from '@/config/milestone-families'
import { formatCurrency } from '@/utils/formatters'
import DashboardCard from './DashboardCard.vue'

const props = defineProps({
  milestones: { type: Array, required: true },
  loading: { type: Boolean, default: false },
  error: { type: Boolean, default: false },
})
defineEmits(['open'])
const { t } = useI18n()

const visibleMilestones = computed(() =>
  props.milestones.filter(
    (milestone) =>
      milestone.family !== 'debt' || milestone.relevant || milestone.previouslyAchieved,
  ),
)
const familySummaries = computed(() =>
  milestoneFamilies.map((family) => {
    const milestones = visibleMilestones.value.filter(
      ({ family: familyId }) => familyId === family.id,
    )
    const nextMilestone = milestones.find(({ previouslyAchieved }) => !previouslyAchieved)
    const completed = milestones.length > 0 && !nextMilestone
    return {
      ...family,
      completed,
      milestone: completed ? milestones.at(-1) : nextMilestone,
    }
  }),
)

function percentage(family) {
  return Math.round(progressValue(family) * 100)
}

function progressValue(family) {
  return family.completed ? 1 : family.milestone.progress
}

function currentTargetLabel(family) {
  const milestone = family.milestone
  const currentValue = family.completed ? milestone.target : milestone.currentValue
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
}

function descriptionFor(milestone) {
  if (milestone.family === 'safety')
    return t('milestones.descriptions.safety', { target: milestone.target })
  if (milestone.family === 'freedom')
    return t('milestones.descriptions.freedom', { target: milestone.target })
  if (milestone.family === 'netWorth') {
    return milestone.id === 'net_worth_positive'
      ? t('milestones.descriptions.netWorthPositive')
      : t('milestones.descriptions.netWorth', { target: formatCurrency(milestone.target) })
  }
  return t(`milestones.descriptions.${milestone.id}`)
}

function formatDecimal(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(Number(value || 0))
}
</script>

<style scoped lang="scss">
.milestone-loading,
.milestone-error {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 7rem;
  color: var(--color-copy);
}

.milestone-error .q-btn {
  margin-left: auto;
}

.family-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.9rem;
}

.family-card {
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
  margin: 1.1rem 0 0.4rem;
  font-size: 0.78rem;
}

.unavailable {
  display: flex;
  align-items: center;
  min-height: 7.3rem;
  margin: 0;
}

.view-progress {
  white-space: nowrap;
}

@media (max-width: 1099px) {
  .family-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 599px) {
  .family-grid {
    grid-template-columns: 1fr;
  }

  .family-card {
    padding: 1rem;
  }

  .view-progress {
    padding-right: 0;
    font-size: 0.75rem;
  }
}
</style>
