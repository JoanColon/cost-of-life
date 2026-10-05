<template>
  <DashboardCard
    :title="t('dashboard.milestones.title')"
    :subtitle="t('dashboard.milestones.subtitle')"
    @open="$emit('open')"
  >
    <div class="milestone-list">
      <button
        v-for="milestone in milestones"
        :key="milestone.id"
        type="button"
        class="milestone-row"
      >
        <div class="milestone-icon"><q-icon :name="milestone.icon" /></div>
        <div class="milestone-copy">
          <strong>{{ t(milestone.titleKey) }}</strong>
          <span
            >{{ formatCurrency(milestone.current) }} / {{ formatCurrency(milestone.goal) }}</span
          >
        </div>
        <div class="progress-track" aria-hidden="true">
          <div class="progress-value" :style="{ width: `${progress(milestone)}%` }" />
        </div>
        <strong class="milestone-percent">{{ progress(milestone) }}%</strong>
        <q-icon name="chevron_right" class="row-chevron" />
      </button>
    </div>
  </DashboardCard>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import DashboardCard from './DashboardCard.vue'
import { formatCurrency } from '@/utils/formatters'

defineProps({ milestones: { type: Array, required: true } })
defineEmits(['open'])
const { t } = useI18n()

function progress(milestone) {
  return Math.min(Math.round((milestone.current / milestone.goal) * 100), 100)
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;

.milestone-list {
  display: grid;
  gap: 1.1rem;
}

.milestone-row {
  display: grid;
  grid-template-columns: auto minmax(10rem, 1fr) minmax(8rem, 1.25fr) auto auto;
  align-items: center;
  gap: 1rem;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-ink);
  text-align: left;
  cursor: pointer;
}

.milestone-row:focus-visible {
  border-radius: 0.75rem;
  @include focus-ring;
}

.milestone-icon {
  display: grid;
  place-items: center;
  width: 3.35rem;
  height: 3.35rem;
  border-radius: 50%;
  background: var(--color-green-soft);
  color: var(--color-success-dark);
  font-size: 1.65rem;
}

.milestone-copy strong,
.milestone-copy span {
  display: block;
}

.milestone-copy strong {
  font-size: 1rem;
}

.milestone-copy span {
  margin-top: 0.2rem;
  color: var(--color-copy);
  font-size: 0.85rem;
}

.progress-track {
  overflow: hidden;
  height: 0.65rem;
  border-radius: 99px;
  background: #e8edf1;
}

.progress-value {
  height: 100%;
  border-radius: inherit;
  background: var(--color-success);
  transition: width 240ms ease;
}

.milestone-percent {
  min-width: 2.7rem;
  text-align: right;
}

.row-chevron {
  color: var(--color-copy);
  font-size: 1.4rem;
}

@media (max-width: 699px) {
  .milestone-row {
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    gap: 0.75rem;
  }

  .progress-track {
    grid-column: 2 / 4;
    grid-row: 2;
  }

  .row-chevron {
    grid-column: 4;
    grid-row: 1 / 3;
  }
}
</style>
