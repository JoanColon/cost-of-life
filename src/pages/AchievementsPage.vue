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
            :label="t('navigation.progress')"
            :to="{ name: 'progress', params: { workspaceId } }"
            class="back-button"
          />
          <h1>{{ t('achievements.title') }}</h1>
          <p v-if="visibleMilestones.length">
            {{
              t(trackingActive ? 'milestones.reachedSummary' : 'milestones.setup.previewSummary', {
                achieved: achievedCount,
                total: visibleMilestones.length,
              })
            }}
          </p>
        </div>
      </header>

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
        <MilestoneSummaryCard
          class="milestone-summary"
          :milestones="progress"
          :tracking-active="trackingActive"
          :loading="loading"
          :error="Boolean(error)"
          :show-action="false"
          :show-tracking-setup="false"
        />

        <div class="family-grid">
          <section
            v-for="family in families"
            :key="family.id"
            class="family-card"
            :class="`family--${family.id}`"
          >
            <div
              class="family-header"
              :class="{ expanded: isExpanded(family.id) }"
              @click="toggleFamily(family.id)"
            >
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
                  />
                </div>
                <p>{{ t(`milestones.families.${family.id}.description`) }}</p>
              </div>
              <button
                type="button"
                class="family-meta"
                :aria-expanded="isExpanded(family.id)"
                :aria-controls="`achievements-${family.id}`"
                :aria-label="
                  t('achievements.toggleFamily', {
                    family: t(`milestones.families.${family.id}.title`),
                  })
                "
                @click.stop="toggleFamily(family.id)"
              >
                <strong>{{
                  t('achievements.familyCount', {
                    achieved: family.achieved,
                    total: family.milestones.length,
                  })
                }}</strong>
                <q-icon name="expand_more" class="expand-icon" />
              </button>
            </div>

            <q-slide-transition>
              <div
                v-show="isExpanded(family.id)"
                :id="`achievements-${family.id}`"
                class="achievement-list"
              >
                <article
                  v-for="milestone in family.milestones"
                  :key="milestone.id"
                  :class="{
                    unlocked: milestoneIsUnlocked(milestone),
                    pending: milestone.pending,
                    preview: !trackingActive && milestone.reached,
                  }"
                >
                  <span class="status-icon">
                    <q-icon :name="milestoneStatusIcon(milestone)" />
                  </span>
                  <div>
                    <strong>{{ t(`milestones.items.${milestone.id}`) }}</strong>
                    <p>{{ descriptionFor(milestone) }}</p>
                    <small v-if="milestone.pending">{{
                      t('milestones.status.pendingConfirmation')
                    }}</small>
                    <small v-else-if="trackingActive && milestone.previouslyAchieved">{{
                      achievedDateLabel(milestone.id)
                    }}</small>
                    <small v-else-if="!trackingActive && milestone.reached">{{
                      t('milestones.setup.previewReached')
                    }}</small>
                  </div>
                  <q-icon
                    v-if="milestoneIsUnlocked(milestone) && !milestone.pending"
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
      </template>

      <q-dialog v-model="infoDialogOpen">
        <q-card v-if="selectedInfoFamily" class="family-info-dialog">
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
import MilestoneSummaryCard from '@/components/dashboard/MilestoneSummaryCard.vue'
import { milestoneFamilies } from '@/config/milestone-families'
import { useMilestonesStore } from '@/stores/milestones-store'
import { formatCurrency } from '@/utils/formatters'

const { t } = useI18n()
const $q = useQuasar()
const route = useRoute()
const milestonesStore = useMilestonesStore()
const workspaceId = computed(() => String(route.params.workspaceId))
const { achievements, activationLoading, error, loading, progress, trackingActive } =
  storeToRefs(milestonesStore)
const expandedFamilies = ref(new Set())
const infoDialogOpen = ref(false)
const activationDialogOpen = ref(false)
const selectedInfoFamilyId = ref(null)

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
  () => visibleMilestones.value.filter((milestone) => milestoneIsUnlocked(milestone)).length,
)
const families = computed(() =>
  milestoneFamilies.map((family) => {
    const milestones = visibleMilestones.value.filter(
      ({ family: familyId }) => familyId === family.id,
    )
    return {
      ...family,
      milestones,
      achieved: milestones.filter((milestone) => milestoneIsUnlocked(milestone)).length,
    }
  }),
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

function isExpanded(familyId) {
  return expandedFamilies.value.has(familyId)
}

function toggleFamily(familyId) {
  const next = new Set(expandedFamilies.value)
  if (next.has(familyId)) next.delete(familyId)
  else next.add(familyId)
  expandedFamilies.value = next
}

function showFamilyInfo(familyId) {
  selectedInfoFamilyId.value = familyId
  infoDialogOpen.value = true
}

function milestoneIsUnlocked(milestone) {
  return trackingActive.value ? milestone.previouslyAchieved : milestone.reached
}

function milestoneStatusIcon(milestone) {
  if (milestone.pending) return 'schedule'
  if (milestoneIsUnlocked(milestone)) return trackingActive.value ? 'emoji_events' : 'visibility'
  return 'lock_outline'
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
.pending {
  opacity: 1 !important;
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
