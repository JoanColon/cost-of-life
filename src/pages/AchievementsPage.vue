<template>
  <q-page class="achievements-page">
    <main class="achievements-shell">
      <header class="page-header">
        <div>
          <q-btn
            flat
            dense
            no-caps
            color="grey-7"
            icon="arrow_back"
            :label="t('navigation.backToWorkspaceHome')"
            :to="{ name: 'workspace-dashboard', params: { workspaceId } }"
            class="back-button"
          />
          <h1>{{ t('achievements.title') }}</h1>
          <p v-if="visibleMilestones.length">
            {{
              t('milestones.reachedSummary', {
                achieved: achievedCount,
                total: visibleMilestones.length,
              })
            }}
          </p>
        </div>
      </header>

      <div v-if="loading && !progress.length" class="state">
        <q-spinner color="primary" size="2rem" />
        <span>{{ t('milestones.loading') }}</span>
      </div>
      <section v-else-if="error && !progress.length" class="state">
        <q-icon name="cloud_off" size="2rem" />
        <p>{{ t('milestones.error') }}</p>
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon="refresh"
          :label="t('common.retry')"
          @click="retry"
        />
      </section>
      <div v-else class="family-grid">
        <section
          v-for="family in families"
          :key="family.id"
          class="family-card"
          :class="`family--${family.id}`"
        >
          <button
            type="button"
            class="family-header"
            :class="{ expanded: isExpanded(family.id) }"
            :aria-expanded="isExpanded(family.id)"
            :aria-controls="`achievements-${family.id}`"
            @click="toggleFamily(family.id)"
          >
            <span class="family-icon"><q-icon :name="family.icon" /></span>
            <div class="family-copy">
              <h2>{{ t(`milestones.families.${family.id}.title`) }}</h2>
              <p>{{ t(`milestones.families.${family.id}.description`) }}</p>
            </div>
            <span class="family-meta">
              <strong>{{
                t('achievements.familyCount', {
                  achieved: family.achieved,
                  total: family.milestones.length,
                })
              }}</strong>
              <q-icon name="expand_more" class="expand-icon" />
            </span>
          </button>

          <q-slide-transition>
            <div
              v-show="isExpanded(family.id)"
              :id="`achievements-${family.id}`"
              class="achievement-list"
            >
              <article
                v-for="milestone in family.milestones"
                :key="milestone.id"
                :class="{ unlocked: milestone.previouslyAchieved }"
              >
                <span class="status-icon">
                  <q-icon :name="milestone.previouslyAchieved ? 'emoji_events' : 'lock_outline'" />
                </span>
                <div>
                  <strong>{{ t(`milestones.items.${milestone.id}`) }}</strong>
                  <p>{{ descriptionFor(milestone) }}</p>
                  <small v-if="milestone.previouslyAchieved">{{
                    achievedDateLabel(milestone.id)
                  }}</small>
                </div>
                <q-icon
                  v-if="milestone.previouslyAchieved"
                  class="check-icon"
                  name="check_circle"
                />
              </article>
              <p v-if="!family.milestones.length" class="empty-family">
                {{ t('achievements.noRelevantDebt') }}
              </p>
            </div>
          </q-slide-transition>
        </section>
      </div>
    </main>
  </q-page>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { milestoneFamilies } from '@/config/milestone-families'
import { useMilestonesStore } from '@/stores/milestones-store'
import { formatCurrency } from '@/utils/formatters'

const { t } = useI18n()
const route = useRoute()
const milestonesStore = useMilestonesStore()
const workspaceId = computed(() => String(route.params.workspaceId))
const { achievements, error, loading, progress } = storeToRefs(milestonesStore)
const expandedFamilies = ref(new Set())

watch(
  workspaceId,
  (id) => {
    expandedFamilies.value = new Set()
    milestonesStore.load(id)
  },
  { immediate: true },
)

const visibleMilestones = computed(() =>
  progress.value.filter(
    (milestone) =>
      milestone.family !== 'debt' || milestone.relevant || milestone.previouslyAchieved,
  ),
)
const achievedCount = computed(
  () => visibleMilestones.value.filter(({ previouslyAchieved }) => previouslyAchieved).length,
)
const families = computed(() =>
  milestoneFamilies.map((family) => {
    const milestones = visibleMilestones.value.filter(
      ({ family: familyId }) => familyId === family.id,
    )
    return {
      ...family,
      milestones,
      achieved: milestones.filter(({ previouslyAchieved }) => previouslyAchieved).length,
    }
  }),
)
const achievementById = computed(
  () => new Map(achievements.value.map((achievement) => [achievement.milestoneId, achievement])),
)

function retry() {
  milestonesStore.load(workspaceId.value, true)
}

function isExpanded(familyId) {
  return expandedFamilies.value.has(familyId)
}

function toggleFamily(familyId) {
  const next = new Set(expandedFamilies.value)
  if (next.has(familyId)) next.delete(familyId)
  else next.add(familyId)
  expandedFamilies.value = next
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

function achievedDateLabel(milestoneId) {
  const value = achievementById.value.get(milestoneId)?.achievedAt
  const date = typeof value?.toDate === 'function' ? value.toDate() : value ? new Date(value) : null
  if (!date) return t('achievements.achieved')
  return t('milestones.achievedOn', {
    date: new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(date),
  })
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;

.achievements-page {
  @include financial-page;
}
.achievements-shell {
  @include financial-shell;
}
.page-header {
  @include financial-header;
}
.back-button {
  @include financial-back-button;
}
h1 {
  @include financial-title;
}
.page-header p,
.family-header p,
.achievement-list p,
.achievement-list small,
.state {
  color: var(--color-copy);
}
.page-header p {
  margin: 0.5rem 0 0;
}

.family-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  margin-top: 2rem;
  align-items: start;
}
.family-card {
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}
.family-header {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  width: 100%;
  min-height: 6.5rem;
  padding: 1rem 1.2rem;
  border: 0;
  background: transparent;
  color: var(--color-ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.family-header.expanded {
  border-bottom: 1px solid var(--color-line);
}
.family-header:hover {
  background: var(--color-surface-soft);
}
.family-copy {
  flex: 1;
  min-width: 0;
}
.family-header h2,
.family-header p {
  margin: 0;
}
.family-header h2 {
  font-size: 1.2rem;
}
.family-header p {
  margin-top: 0.2rem;
  font-size: 0.8rem;
}
.family-meta {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex: 0 0 auto;
  margin-left: auto;
}
.family-meta strong {
  color: var(--color-copy);
  font-size: 0.8rem;
}
.expand-icon {
  color: var(--color-copy);
  font-size: 1.35rem;
  transition: transform 180ms ease;
}
.family-header.expanded .expand-icon {
  transform: rotate(180deg);
}

.family-icon,
.status-icon {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 50%;
}
.family-icon {
  width: 3rem;
  height: 3rem;
  background: var(--color-blue-soft);
  color: var(--color-primary);
  font-size: 1.35rem;
}
.family--safety .family-icon {
  background: var(--color-green-soft);
  color: var(--color-success-dark);
}
.family--debt .family-icon {
  background: var(--color-red-soft);
  color: var(--color-danger);
}
.family--freedom .family-icon {
  background: var(--color-purple-soft);
  color: var(--color-purple);
}

.achievement-list article {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  min-height: 5.6rem;
  margin: 0 1rem;
  padding: 0.85rem 0;
  border-bottom: 1px solid var(--color-line);
  opacity: 0.65;
}
.achievement-list article:last-child {
  border-bottom: 0;
}
.empty-family {
  margin: 0;
  padding: 1.25rem;
  color: var(--color-copy);
  font-size: 0.82rem;
}
.achievement-list article.unlocked {
  opacity: 1;
}
.achievement-list article > div {
  min-width: 0;
}
.achievement-list strong,
.achievement-list p,
.achievement-list small {
  display: block;
}
.achievement-list p {
  margin: 0.15rem 0 0;
  font-size: 0.8rem;
}
.achievement-list small {
  margin-top: 0.2rem;
  font-size: 0.76rem;
}
.status-icon {
  width: 2.7rem;
  height: 2.7rem;
  background: var(--color-surface-soft);
  color: var(--color-muted);
  font-size: 1.2rem;
}
.unlocked .status-icon {
  background: var(--color-green-soft);
  color: var(--color-success-dark);
}
.check-icon {
  margin-left: auto;
  color: var(--color-success-dark);
  font-size: 1.45rem;
}

.state {
  display: grid;
  min-height: 18rem;
  place-content: center;
  justify-items: center;
  gap: 0.75rem;
  text-align: center;
}
.state p {
  margin: 0;
}

@media (max-width: 899px) {
  .family-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .page-header p {
    font-size: 0.82rem;
  }
  .family-grid {
    margin-top: 1.25rem;
  }
  .family-card {
    border-radius: var(--radius-md);
  }
  .family-header {
    min-height: 5.5rem;
    padding: 0.85rem 1rem;
  }
  .family-header p {
    display: none;
  }
  .achievement-list article {
    margin: 0 0.9rem;
  }
}
</style>
