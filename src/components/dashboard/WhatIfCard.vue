<template>
  <DashboardCard
    :title="t('dashboard.whatIf.title')"
    :subtitle="t('dashboard.whatIf.subtitle')"
    @open="$emit('open')"
  >
    <div class="scenario-grid">
      <button v-for="scenario in scenarios" :key="scenario.id" type="button" class="scenario">
        <div class="scenario-icon" :class="scenario.tone"><q-icon :name="scenario.icon" /></div>
        <div class="scenario-copy">
          <strong>{{ t(scenario.titleKey) }}</strong>
          <span>{{ t('dashboard.scenarios.run') }}</span>
        </div>
        <q-icon name="chevron_right" />
      </button>
    </div>
  </DashboardCard>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import DashboardCard from './DashboardCard.vue'

defineProps({ scenarios: { type: Array, required: true } })
defineEmits(['open'])
const { t } = useI18n()
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;

.scenario-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr));
  gap: 0.75rem;
}

.scenario {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.7rem;
  min-width: 0;
  padding: 0.7rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  text-align: left;
  cursor: pointer;
}

.scenario:hover {
  border-color: #cbd8e3;
  background: var(--color-surface-soft);
}

.scenario:focus-visible {
  @include focus-ring;
}

.scenario-icon {
  display: grid;
  place-items: center;
  width: 2.7rem;
  height: 2.7rem;
  border-radius: 50%;
  font-size: 1.35rem;
}

.scenario-icon.blue {
  background: var(--color-blue-soft);
  color: var(--color-primary);
}

.scenario-icon.green {
  background: var(--color-green-soft);
  color: var(--color-success-dark);
}

.scenario-icon.purple {
  background: var(--color-purple-soft);
  color: var(--color-purple);
}

.scenario-copy {
  min-width: 0;
}

.scenario-copy strong,
.scenario-copy span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scenario-copy span {
  margin-top: 0.15rem;
  color: var(--color-copy);
  font-size: 0.75rem;
}

.scenario > .q-icon {
  color: var(--color-copy);
}

@container (max-width: 34rem) {
  .scenario-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 699px) {
  .scenario-grid {
    display: flex;
    overflow-x: auto;
    margin-right: -1.2rem;
    padding-right: 1.2rem;
    scroll-snap-type: x proximity;
    scrollbar-width: none;
  }

  .scenario-grid::-webkit-scrollbar {
    display: none;
  }

  .scenario {
    flex: 0 0 min(10.5rem, 76vw);
    scroll-snap-align: start;
  }
}
</style>
