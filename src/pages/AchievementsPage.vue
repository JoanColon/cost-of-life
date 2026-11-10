<template>
  <q-page class="achievements-page" :class="{ 'achievements-page--embedded': embedded }">
    <main class="achievements-shell">
      <AppPageHeader
        v-if="!embedded"
        :title="t('achievements.title')"
        :subtitle="t('achievements.subtitle')"
        :back-label="t('navigation.progress')"
        :back-to="{ name: 'progress', params: { workspaceId } }"
      >
        <template #actions>
          <section class="milestone-summary" :aria-label="t('achievements.summaryLabel')">
            <div class="summary-item summary-item--total">
              <q-icon name="emoji_events" />
              <span>
                <strong>{{ achievedCount }} / {{ visibleMilestones.length }}</strong>
                <small>{{ t('achievements.milestonesAchieved') }}</small>
              </span>
            </div>
            <div class="summary-item summary-item--achieved">
              <q-icon name="check" />
              <span>
                <strong>{{ achievedCount }}</strong>
                <small>{{ t('achievements.achieved') }}</small>
              </span>
            </div>
            <div class="summary-item summary-item--progress">
              <span class="summary-progress-ring" />
              <span>
                <strong>{{ inProgressCount }}</strong>
                <small>{{ t('achievements.inProgress') }}</small>
              </span>
            </div>
          </section>
        </template>
      </AppPageHeader>

      <section
        v-else
        class="milestone-summary milestone-summary--embedded"
        :aria-label="t('achievements.summaryLabel')"
      >
        <div class="summary-item summary-item--total">
          <q-icon name="emoji_events" />
          <span>
            <strong>{{ achievedCount }} / {{ visibleMilestones.length }}</strong>
            <small>{{ t('achievements.milestonesAchieved') }}</small>
          </span>
        </div>
        <div class="summary-item summary-item--achieved">
          <q-icon name="check" />
          <span>
            <strong>{{ achievedCount }}</strong>
            <small>{{ t('achievements.achieved') }}</small>
          </span>
        </div>
        <div class="summary-item summary-item--progress">
          <span class="summary-progress-ring" />
          <span>
            <strong>{{ inProgressCount }}</strong>
            <small>{{ t('achievements.inProgress') }}</small>
          </span>
        </div>
      </section>

      <q-banner v-if="!trackingActive && !loading" rounded class="setup-banner">
        <template #avatar>
          <q-icon name="flag" />
        </template>
        <div class="setup-banner-copy">
          <strong>{{ t('milestones.setup.title') }}</strong>
          <p>{{ t('milestones.setup.description') }}</p>
        </div>
        <template #action>
          <q-btn
            unelevated
            no-caps
            color="primary"
            icon="task_alt"
            :label="t('milestones.setup.action')"
            @click="activationDialogOpen = true"
          />
        </template>
      </q-banner>

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
      <template v-else>
        <nav class="milestone-filters" :aria-label="t('achievements.filterLabel')">
          <button
            v-for="filter in filters"
            :key="filter.id"
            type="button"
            :class="{ active: activeFilter === filter.id }"
            :aria-pressed="activeFilter === filter.id"
            @click="activeFilter = filter.id"
          >
            {{ filter.label }} ({{ filter.count }})
          </button>
        </nav>

        <div class="family-grid">
          <section
            v-for="family in filteredFamilies"
            :key="family.id"
            class="family-card"
            :class="`family--${family.id}`"
          >
            <header class="family-header">
              <span class="family-icon"><q-icon :name="family.icon" /></span>
              <div class="family-copy">
                <div class="family-title">
                  <h2>{{ t(`milestones.families.${family.id}.title`) }}</h2>
                  <q-btn
                    flat
                    round
                    dense
                    size="sm"
                    icon="info_outline"
                    class="family-info-button"
                    :aria-label="
                      t('milestones.familyInfoAction', {
                        family: t(`milestones.families.${family.id}.title`),
                      })
                    "
                    @click.stop="showFamilyInfo(family.id)"
                    @keydown.stop
                  >
                    <q-tooltip v-if="$q.screen.gt.xs" max-width="24rem">
                      {{ t(`milestones.families.${family.id}.info`) }}
                    </q-tooltip>
                  </q-btn>
                </div>
                <p>{{ t(`milestones.families.${family.id}.shortDescription`) }}</p>
                <strong class="family-count">
                  {{
                    t('achievements.familyCount', {
                      achieved: family.achieved,
                      total: family.total,
                    })
                  }}
                  {{ t('achievements.achieved').toLowerCase() }}
                </strong>
                <span class="family-progress-track">
                  <span :style="{ width: `${family.percentage}%` }" />
                </span>
              </div>
            </header>

            <div class="achievement-list">
              <article
                v-for="milestone in family.filteredMilestones"
                :key="milestone.id"
                :class="{
                  unlocked: milestoneIsUnlocked(milestone),
                  pending: milestone.pending,
                  current: family.currentIds.has(milestone.id),
                  locked: !milestoneIsUnlocked(milestone) && !family.currentIds.has(milestone.id),
                }"
              >
                <MilestoneBadge
                  :family="milestone.family"
                  :milestone-id="milestone.id"
                  :level="milestoneLevel(family, milestone)"
                  :final="family.milestones.at(-1)?.id === milestone.id"
                  :locked="!milestoneIsUnlocked(milestone) && !family.currentIds.has(milestone.id)"
                />
                <strong>{{ milestoneTitle(milestone) }}</strong>
                <div v-if="milestoneIsUnlocked(milestone)" class="milestone-state achieved">
                  <q-icon name="check_circle" />
                  <span>{{ achievedDateLabel(milestone.id) }}</span>
                </div>
                <template v-else-if="family.currentIds.has(milestone.id)">
                  <div class="milestone-current-row">
                    <q-linear-progress
                      rounded
                      size="0.42rem"
                      :value="milestone.progress"
                      :color="family.color"
                      track-color="grey-3"
                    />
                    <b>{{ Math.round(milestone.progress * 100) }}%</b>
                  </div>
                  <small>{{ currentTargetLabel(milestone) }}</small>
                </template>
                <div v-else class="milestone-state locked-label">
                  <q-icon name="lock_outline" />
                  <span>{{ t('achievements.locked') }}</span>
                </div>
              </article>
            </div>
          </section>
          <p v-if="!filteredFamilies.length" class="filter-empty">
            {{ t('achievements.filterEmpty') }}
          </p>
        </div>
      </template>

      <q-dialog v-model="infoDialogOpen" :position="$q.screen.lt.sm ? 'bottom' : undefined">
        <q-card v-if="selectedInfoFamily" class="family-info-dialog responsive-info-card">
          <span class="info-sheet-handle" aria-hidden="true" />
          <q-card-section class="family-info-heading">
            <span class="family-icon" :class="`family-info-icon--${selectedInfoFamily.id}`">
              <q-icon :name="selectedInfoFamily.icon" />
            </span>
            <h2>{{ t(`milestones.families.${selectedInfoFamily.id}.infoTitle`) }}</h2>
            <q-btn v-close-popup flat round dense icon="close" :aria-label="t('common.close')" />
          </q-card-section>
          <q-card-section class="family-info-copy">
            <p>{{ t(`milestones.families.${selectedInfoFamily.id}.info`) }}</p>
          </q-card-section>
        </q-card>
      </q-dialog>

      <q-dialog v-model="activationDialogOpen" persistent>
        <q-card class="activation-dialog">
          <q-card-section>
            <div class="activation-icon"><q-icon name="task_alt" /></div>
            <h2>{{ t('milestones.setup.confirmTitle') }}</h2>
            <p>{{ t('milestones.setup.confirmDescription') }}</p>
            <p class="activation-note">{{ t('milestones.setup.confirmNote') }}</p>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn
              v-close-popup
              flat
              no-caps
              :label="t('common.cancel')"
              :disable="activationLoading"
            />
            <q-btn
              unelevated
              no-caps
              color="primary"
              :label="t('milestones.setup.confirmAction')"
              :loading="activationLoading"
              @click="activateTracking"
            />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </main>
  </q-page>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import AppPageHeader from '@/components/layout/AppPageHeader.vue'
import MilestoneBadge from '@/components/milestones/MilestoneBadge.vue'
import { milestoneFamilies } from '@/config/milestone-families'
import { calculateMilestoneProgress } from '@/domain/milestones/calculations'
import { authUser } from '@/services/auth'
import { useFinancialScopeStore } from '@/stores/financial-scope-store'
import { useMilestonesStore } from '@/stores/milestones-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { formatCurrency } from '@/utils/formatters'
import { getWorkspaceMembers } from '@/utils/workspace-members'

defineProps({
  embedded: { type: Boolean, default: false },
})

const { t } = useI18n()
const $q = useQuasar()
const route = useRoute()
const milestonesStore = useMilestonesStore()
const scopeStore = useFinancialScopeStore()
const workspaceStore = useWorkspaceStore()
const workspaceId = computed(() => String(route.params.workspaceId))
const {
  achievements,
  activationLoading,
  currentMonth,
  error,
  excludedLiabilityIds,
  financialYear,
  historyDocuments,
  liabilities,
  loading,
  trackingActive,
} = storeToRefs(milestonesStore)
const workspace = computed(
  () => workspaceStore.workspaces.find(({ id }) => id === workspaceId.value) || null,
)
const members = computed(() => getWorkspaceMembers(workspace.value, authUser.value))
const memberIds = computed(() => members.value.map(({ id }) => id))
const selectedMemberId = computed(() =>
  scopeStore.get(workspaceId.value, memberIds.value, authUser.value?.uid),
)
const progress = computed(() =>
  calculateMilestoneProgress({
    financialYear: financialYear.value,
    financialHistory: historyDocuments.value,
    liabilities: liabilities.value,
    excludedLiabilityIds: excludedLiabilityIds.value,
    achievements: trackingActive.value ? achievements.value : [],
    month: currentMonth.value,
    memberId: selectedMemberId.value,
  }),
)
const activeFilter = ref('all')
const infoDialogOpen = ref(false)
const activationDialogOpen = ref(false)
const selectedInfoFamilyId = ref(null)

watch(
  workspaceId,
  (id) => {
    activeFilter.value = 'all'
    milestonesStore.load(id)
  },
  { immediate: true },
)

const visibleMilestones = computed(() =>
  progress.value.filter(
    (milestone) => milestone.family !== 'debt' || milestone.relevant || milestone.achieved,
  ),
)
const achievedCount = computed(
  () => visibleMilestones.value.filter((milestone) => milestoneIsUnlocked(milestone)).length,
)
const inProgressCount = computed(() => visibleMilestones.value.length - achievedCount.value)
const filters = computed(() => [
  { id: 'all', label: t('achievements.filters.all'), count: visibleMilestones.value.length },
  { id: 'achieved', label: t('achievements.filters.achieved'), count: achievedCount.value },
  {
    id: 'inProgress',
    label: t('achievements.filters.inProgress'),
    count: inProgressCount.value,
  },
])
const families = computed(() =>
  milestoneFamilies.map((family) => {
    const milestones = visibleMilestones.value.filter(
      ({ family: familyId }) => familyId === family.id,
    )
    const achieved = milestones.filter((milestone) => milestoneIsUnlocked(milestone)).length
    const remaining = milestones.filter((milestone) => !milestoneIsUnlocked(milestone))
    const currentIds = new Set(
      (family.id === 'debt'
        ? remaining.filter(({ relevant }) => relevant)
        : remaining.slice(0, 1)
      ).map(({ id }) => id),
    )
    return {
      ...family,
      milestones,
      achieved,
      total: milestones.length,
      percentage: milestones.length ? (achieved / milestones.length) * 100 : 0,
      currentIds,
    }
  }),
)
const filteredFamilies = computed(() =>
  families.value
    .map((family) => ({
      ...family,
      filteredMilestones: family.milestones.filter((milestone) => {
        if (activeFilter.value === 'achieved') return milestoneIsUnlocked(milestone)
        if (activeFilter.value === 'inProgress') return !milestoneIsUnlocked(milestone)
        return true
      }),
    }))
    .filter(({ filteredMilestones }) => filteredMilestones.length),
)
const achievementById = computed(
  () => new Map(achievements.value.map((achievement) => [achievement.milestoneId, achievement])),
)
const selectedInfoFamily = computed(() =>
  milestoneFamilies.find(({ id }) => id === selectedInfoFamilyId.value),
)

function retry() {
  milestonesStore.load(workspaceId.value, true)
}

function showFamilyInfo(familyId) {
  if (!$q.screen.lt.sm) return
  selectedInfoFamilyId.value = familyId
  infoDialogOpen.value = true
}

function milestoneIsUnlocked(milestone) {
  return trackingActive.value ? milestone.achieved : milestone.reached
}

async function activateTracking() {
  try {
    await milestonesStore.activateTracking()
    activationDialogOpen.value = false
    $q.notify({ type: 'positive', message: t('milestones.setup.activated') })
  } catch {
    $q.notify({ type: 'negative', message: t('milestones.setup.activationError') })
  }
}

function milestoneTitle(milestone) {
  return t(`milestones.items.${milestone.id}`, {
    amount: formatCurrency(milestone.target),
  })
}

function milestoneLevel(family, milestone) {
  const index = family.milestones.findIndex(({ id }) => id === milestone.id)
  if (index < 0 || family.milestones.length < 2) return 0
  return Math.round((index / (family.milestones.length - 1)) * 3)
}

function currentTargetLabel(milestone) {
  const current = milestone.currentValue
  if (milestone.family === 'safety') {
    return t('milestones.values.monthsCurrentTarget', {
      current: formatDecimal(current),
      target: milestone.target,
    })
  }
  if (milestone.family === 'freedom') {
    return t('milestones.values.yearsCurrentTarget', {
      current: formatDecimal(current),
      target: milestone.target,
    })
  }
  if (milestone.family === 'debt') {
    return t('milestones.values.remaining', { value: formatCurrency(current) })
  }
  return `${formatCurrency(current)} / ${formatCurrency(milestone.target)}`
}

function formatDecimal(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(Number(value || 0))
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
.achievements-page--embedded {
  min-height: 0;
  padding: 0;
  background: transparent;
}
.achievements-shell {
  @include financial-shell;
}
.achievements-page--embedded .achievements-shell {
  max-width: none;
}
.family-header p,
.achievement-list p,
.achievement-list small,
.state {
  color: var(--color-copy);
}

.setup-banner {
  margin-top: 1.5rem;
  padding: 1rem 1.2rem;
  border: 1px solid var(--color-line);
  background: var(--color-blue-soft);
  color: var(--color-ink);
}
.setup-banner :deep(.q-banner__avatar) {
  color: var(--color-primary);
  font-size: 1.7rem;
}
.setup-banner-copy strong,
.setup-banner-copy p {
  display: block;
}
.setup-banner-copy p {
  max-width: 42rem;
  margin: 0.2rem 0 0;
  color: var(--color-copy);
  font-size: 0.84rem;
}

.milestone-summary {
  margin-top: 2rem;
}
.milestone-summary--embedded {
  margin-top: 0;
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
  background: var(--color-surface);
}
.family-copy {
  flex: 1;
  min-width: 0;
}
.family-title {
  display: flex;
  align-items: center;
  gap: 0.2rem;
}
.family-info-button {
  color: var(--color-copy);
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
  padding: 0;
  border: 0;
  background: transparent;
  font: inherit;
  cursor: pointer;
}
.family-meta:focus-visible {
  border-radius: var(--radius-sm);
  outline: 2px solid var(--color-primary);
  outline-offset: 3px;
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

.family-info-dialog {
  width: min(28rem, calc(100vw - 2rem));
  border-radius: var(--radius-card);
  color: var(--color-ink);
}
.family-info-heading {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding-bottom: 0.75rem;
}
.family-info-heading h2 {
  flex: 1;
  margin: 0;
  font-size: 1.15rem;
}
.family-info-icon--safety {
  background: var(--color-green-soft);
  color: var(--color-success-dark);
}
.family-info-icon--debt {
  background: var(--color-red-soft);
  color: var(--color-danger);
}
.family-info-icon--freedom {
  background: var(--color-purple-soft);
  color: var(--color-purple);
}
.family-info-copy {
  padding-top: 0;
}
.family-info-copy p {
  margin: 0;
  color: var(--color-copy);
  font-size: 0.9rem;
  line-height: 1.55;
}

.activation-dialog {
  width: min(31rem, calc(100vw - 2rem));
  border-radius: var(--radius-card);
  color: var(--color-ink);
}
.activation-dialog h2 {
  margin: 0.8rem 0 0;
  font-size: 1.3rem;
}
.activation-dialog p {
  margin: 0.55rem 0 0;
  color: var(--color-copy);
  font-size: 0.9rem;
  line-height: 1.5;
}
.activation-icon {
  display: grid;
  width: 3rem;
  height: 3rem;
  place-items: center;
  border-radius: 50%;
  background: var(--color-green-soft);
  color: var(--color-success-dark);
  font-size: 1.45rem;
}
.activation-dialog .activation-note {
  padding: 0.75rem;
  border-radius: var(--radius-sm);
  background: var(--color-surface-soft);
  font-size: 0.8rem;
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
.achievement-list article.pending {
  opacity: 1;
}
.pending .status-icon {
  background: var(--color-blue-soft);
  color: var(--color-primary);
}
.preview .status-icon {
  background: var(--color-blue-soft);
  color: var(--color-primary);
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

/* Narrative milestone board */
.achievements-shell {
  @include financial-shell(analytical);
}

.milestone-summary {
  display: grid;
  grid-template-columns: repeat(3, auto);
  min-width: min(32rem, 46vw);
  margin: 0;
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  background: rgb(255 255 255 / 90%);
  box-shadow: var(--shadow-card);
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
  padding: 0 1rem;
  border-left: 1px solid var(--color-line);
}

.summary-item:first-child {
  padding-left: 0.2rem;
  border-left: 0;
}

.summary-item:last-child {
  padding-right: 0.2rem;
}

.summary-item > .q-icon {
  display: grid;
  width: 2.15rem;
  height: 2.15rem;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 50%;
  font-size: 1.25rem;
}

.summary-item--total > .q-icon {
  background: var(--color-purple-soft);
  color: var(--color-purple);
}

.summary-item--achieved > .q-icon {
  background: var(--color-green-soft);
  color: var(--color-success);
}

.summary-item > span:not(.summary-progress-ring) {
  display: grid;
  gap: 0.08rem;
}

.summary-item strong {
  color: var(--color-ink);
  font-size: 0.95rem;
  line-height: 1;
}

.summary-item small {
  color: var(--color-copy);
  font-size: 0.67rem;
  white-space: nowrap;
}

.summary-progress-ring {
  width: 2.15rem;
  height: 2.15rem;
  flex: 0 0 auto;
  border: 0.36rem solid var(--color-blue-soft);
  border-top-color: var(--color-primary);
  border-right-color: var(--color-primary);
  border-radius: 50%;
  transform: rotate(25deg);
}

.milestone-filters {
  display: flex;
  gap: 0.55rem;
  margin-top: 1.4rem;
}

.milestone-filters button {
  @include button-reset;
  min-width: 6.6rem;
  padding: 0.55rem 1rem;
  border: 1px solid var(--color-line);
  border-radius: 999px;
  background: var(--color-surface);
  box-shadow: var(--shadow-control);
  color: var(--color-copy);
  font-size: 0.75rem;
  font-weight: 750;
  text-align: center;
}

.milestone-filters button.active {
  border-color: var(--color-ink);
  background: var(--color-ink);
  color: var(--color-inverse);
}

.milestone-filters button:focus-visible {
  @include focus-ring;
}

.family-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
  margin-top: 0.9rem;
}

.family-card {
  display: grid;
  grid-template-columns: minmax(13rem, 0.25fr) minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.family-header {
  display: flex;
  align-items: flex-start;
  gap: 0.8rem;
  width: auto;
  min-height: 10.5rem;
  padding: 1.1rem 1rem;
  border-right: 1px solid var(--color-line);
  cursor: default;
}

.family-header:hover {
  background: transparent;
}

.family-icon {
  width: 2.7rem;
  height: 2.7rem;
  border-radius: 0.8rem;
  font-size: 1.35rem;
}

.family-copy {
  display: grid;
  align-content: start;
  gap: 0.15rem;
}

.family-title {
  gap: 0.15rem;
}

.family-header h2 {
  font-size: 1.12rem;
  letter-spacing: -0.025em;
}

.family-header p {
  margin-top: 0;
  font-size: 0.72rem;
}

.family-info-button {
  min-width: 1.8rem;
  min-height: 1.8rem;
  color: var(--color-muted);
}

.family-count {
  margin-top: 0.9rem;
  color: var(--color-ink);
  font-size: 0.72rem;
}

.family-progress-track {
  display: block;
  width: 100%;
  height: 0.42rem;
  margin-top: 0.35rem;
  overflow: hidden;
  border-radius: 999px;
  background: var(--color-surface-muted);
}

.family-progress-track > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-primary);
}

.family--safety .family-progress-track > span {
  background: var(--color-success);
}

.family--freedom .family-progress-track > span {
  background: var(--color-purple);
}

.family--debt .family-progress-track > span {
  background: var(--color-danger);
}

.achievement-list {
  display: grid;
  grid-auto-columns: minmax(9rem, 1fr);
  grid-auto-flow: column;
  gap: 0.55rem;
  min-width: 0;
  overflow-x: auto;
  padding: 0.75rem;
  scrollbar-width: thin;
}

.achievement-list article {
  display: grid;
  grid-template-rows: 5rem minmax(2.8rem, auto) 1.9rem;
  align-content: center;
  justify-items: center;
  gap: 0.25rem;
  min-width: 9rem;
  min-height: 10.2rem;
  margin: 0;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--color-line);
  border-radius: 0.9rem;
  background: var(--color-surface);
  opacity: 1;
  text-align: center;
}

.family--safety .achievement-list article.unlocked {
  background: var(--color-surface);
}

.family--freedom .achievement-list article.unlocked {
  background: var(--color-surface);
}

.family--debt .achievement-list article.unlocked {
  background: var(--color-surface);
}

.family--netWorth .achievement-list article.unlocked {
  background: var(--color-surface);
}

.achievement-list article.current {
  border-color: var(--color-line-strong);
  background: var(--color-surface);
  box-shadow: 0 0.35rem 1rem rgb(23 74 135 / 9%);
}

.family--freedom .achievement-list article.current {
  border-color: var(--color-line-strong);
}

.family--debt .achievement-list article.current {
  border-color: var(--color-line-strong);
}

.achievement-list article.locked {
  background: var(--color-surface);
}

.achievement-list article > strong {
  display: block;
  max-width: 8.4rem;
  color: var(--color-ink);
  font-size: 1rem;
  line-height: 1.14;
  letter-spacing: -0.015em;
}

.milestone-state {
  display: flex;
  align-items: center;
  align-self: end;
  gap: 0.25rem;
  color: var(--color-copy);
  font-size: 0.82rem;
}

.milestone-state.achieved {
  color: var(--color-success-dark);
}

.milestone-state .q-icon {
  font-size: 1rem;
}

.locked-label {
  color: var(--color-muted);
}

.milestone-current-row {
  display: grid;
  grid-template-columns: minmax(4.2rem, 1fr) auto;
  align-self: end;
  align-items: center;
  gap: 0.45rem;
  width: 100%;
  color: var(--color-ink);
  font-size: 0.74rem;
}

.achievement-list article > small {
  overflow: hidden;
  max-width: 8.4rem;
  color: var(--color-copy);
  font-size: 0.68rem;
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filter-empty {
  margin: 0;
  padding: 2.5rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  color: var(--color-copy);
  text-align: center;
}

@media (max-width: 1050px) {
  .milestone-summary {
    min-width: 0;
  }

  .summary-item {
    padding: 0 0.65rem;
  }

  .summary-item--total small {
    white-space: normal;
  }
}

@media (max-width: 760px) {
  .milestone-summary {
    grid-template-columns: 1fr;
    width: 100%;
    padding: 0.55rem 0.8rem;
  }

  .summary-item,
  .summary-item:first-child,
  .summary-item:last-child {
    padding: 0.5rem 0;
    border-top: 1px solid var(--color-line);
    border-left: 0;
  }

  .summary-item:first-child {
    border-top: 0;
  }

  .milestone-filters {
    overflow-x: auto;
    padding-bottom: 0.25rem;
  }

  .milestone-filters button {
    min-width: max-content;
  }

  .family-card {
    grid-template-columns: 1fr;
  }

  .family-header {
    min-height: 0;
    padding: 0.9rem;
    border-right: 0;
    border-bottom: 1px solid var(--color-line);
  }

  .family-header p {
    display: block;
  }

  .family-count {
    margin-top: 0.45rem;
  }

  .achievement-list {
    grid-auto-columns: minmax(8.5rem, 42vw);
  }

  .achievement-list article {
    min-width: 8.5rem;
    margin: 0;
  }
}
</style>
