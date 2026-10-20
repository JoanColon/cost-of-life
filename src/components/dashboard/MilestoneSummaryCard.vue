<template>
  <DashboardCard
    :title="t('milestones.home.title')"
    :subtitle="t('milestones.home.subtitle')"
    icon="flag"
    icon-tone="purple"
  >
    <template v-if="showAction" #action>
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
        v-if="showAction"
        flat
        dense
        no-caps
        color="primary"
        :label="t('milestones.home.viewAll')"
        @click="$emit('open')"
      />
    </div>
    <template v-else>
      <button
        v-if="showTrackingSetup && !trackingActive"
        type="button"
        class="tracking-setup"
        @click="$emit('open')"
      >
        <q-icon name="visibility" />
        <span>
          <strong>{{ t('milestones.setup.dashboardTitle') }}</strong>
          <small>{{ t('milestones.setup.dashboardDescription') }}</small>
        </span>
        <q-icon name="arrow_forward" />
      </button>

      <div class="family-grid desktop-families">
        <MilestoneFamilyCard v-for="family in familySummaries" :key="family.id" :family="family" />
      </div>

      <q-carousel
        v-model="activeFamily"
        animated
        swipeable
        navigation
        control-color="primary"
        class="family-carousel mobile-families"
      >
        <q-carousel-slide v-for="family in familySummaries" :key="family.id" :name="family.id">
          <MilestoneFamilyCard :family="family" />
        </q-carousel-slide>
      </q-carousel>
    </template>
  </DashboardCard>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { milestoneFamilies } from '@/config/milestone-families'
import DashboardCard from './DashboardCard.vue'
import MilestoneFamilyCard from './MilestoneFamilyCard.vue'

const props = defineProps({
  milestones: { type: Array, required: true },
  trackingActive: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  error: { type: Boolean, default: false },
  showAction: { type: Boolean, default: true },
  showTrackingSetup: { type: Boolean, default: true },
})
defineEmits(['open'])
const { t } = useI18n()
const activeFamily = ref(milestoneFamilies[0]?.id)

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
    const nextMilestone = milestones.find((milestone) =>
      props.trackingActive ? !milestone.previouslyAchieved : !milestone.reached,
    )
    const completed = milestones.length > 0 && !nextMilestone
    return {
      ...family,
      completed,
      milestone: completed ? milestones.at(-1) : nextMilestone,
    }
  }),
)
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

.tracking-setup {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  width: 100%;
  margin-bottom: 0.9rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-blue-soft);
  color: var(--color-primary);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.tracking-setup span {
  display: grid;
  flex: 1;
}

.tracking-setup small {
  margin-top: 0.1rem;
  color: var(--color-copy);
}

.family-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.9rem;
}

.mobile-families {
  display: none;
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
  :deep(.card-header) {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.45rem;
    margin-bottom: 0.85rem;
  }

  :deep(.card-heading) {
    align-items: flex-start;
    gap: 0.75rem;
  }

  :deep(.card-heading p) {
    max-width: 13rem;
    margin-top: 0.2rem;
    font-size: 0.82rem;
    line-height: 1.35;
  }

  :deep(.card-action) {
    justify-self: end;
  }

  .desktop-families {
    display: none;
  }

  .mobile-families {
    display: block;
  }

  .family-carousel {
    height: 16.25rem;
    border-radius: var(--radius-card);
    background: transparent;
  }

  .family-carousel :deep(.q-carousel__slide) {
    padding: 0;
  }

  .family-carousel :deep(.family-card) {
    height: calc(100% - 2.5rem);
  }

  .family-carousel :deep(.q-carousel__navigation--bottom) {
    bottom: 0;
    height: 2.5rem;
    align-items: center;
  }

  .view-progress {
    min-height: 2rem;
    padding: 0 0.25rem;
    font-size: 0.75rem;
  }
}
</style>
