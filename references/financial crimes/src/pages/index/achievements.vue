<template>
  <q-page class="page achievements-page">
    <header class="screen-header">
      <div>
        <h1>ACHIEVEMENTS</h1>
        <div class="section-kicker">Your criminal career, documented.</div>
      </div>
    </header>

    <section class="achievements-filters" aria-label="Achievement filters">
      <q-btn
        v-for="option in filterOptions"
        :key="option.value"
        class="achievements-filter"
        :color="activeFilter === option.value ? 'warning' : 'dark'"
        :text-color="activeFilter === option.value ? 'black' : 'white'"
        unelevated
        no-caps
        :label="option.label"
        @click="activeFilter = option.value"
      />
    </section>

    <section class="achievements-collection">
      <div class="achievements-collection__header">
        <div class="section-heading">{{ activeSectionTitle }}</div>
        <span>{{ filteredUnlockedCount }} / {{ filteredAchievements.length }}</span>
      </div>

      <div class="achievements-grid" :class="`achievements-grid--${activeFilter}`">
        <AchievementBadge
          v-for="achievement in filteredAchievements"
          :key="achievement.id"
          :achievement="achievement"
          :unlock="unlockById.get(achievement.id)"
          @select="openAchievement"
        />
      </div>
    </section>

    <q-dialog v-model="detailDialog">
      <q-card v-if="selectedAchievement" class="achievement-detail-dialog">
        <q-btn
          v-close-popup
          class="achievement-detail-dialog__close"
          flat
          round
          dense
          icon="close"
          color="white"
          aria-label="Close badge details"
        />
        <q-card-section class="achievement-detail-dialog__body">
          <img
            class="achievement-detail-dialog__image"
            :class="{ 'achievement-detail-dialog__image--locked': !selectedUnlock }"
            :src="selectedAchievement.asset"
            :alt="`${detailName} badge`"
          />
          <div class="section-kicker">{{ detailTypeLabel }}</div>
          <h2>{{ detailName }}</h2>
          <p>{{ detailCopy }}</p>
          <div v-if="selectedUnlock" class="achievement-detail-dialog__month">
            Unlocked {{ selectedMonthLabel }}
          </div>
        </q-card-section>
        <q-inner-loading :showing="isSharingAchievement" dark label="Generating badge..." />
        <q-card-actions v-if="selectedUnlock" class="achievement-detail-dialog__actions">
          <q-btn
            class="achievement-detail-dialog__share"
            text-color="white"
            unelevated
            no-caps
            icon="ios_share"
            :loading="isSharingAchievement"
            :disable="isSharingAchievement"
            :label="isSharingAchievement ? 'GENERATING...' : 'SHARE BADGE'"
            @click="shareAchievement"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <div class="share-export-host" aria-hidden="true">
      <AchievementShareCard
        v-if="selectedAchievement && selectedUnlock"
        ref="achievementShareCard"
        v-bind="achievementShareData"
      />
    </div>
  </q-page>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useQuasar } from 'quasar'
import AchievementBadge from '@/components/achievements/AchievementBadge.vue'
import AchievementShareCard from '@/components/achievements/AchievementShareCard.vue'
import { achievementDefinitions, achievementTypes } from '@/config/achievements'
import { useAchievementsStore } from '@/stores/achievementsStore'
import { nodeToPngBlob, shareImageBlob } from '@/utils/shareImage'

const achievementsStore = useAchievementsStore()
const $q = useQuasar()

const activeFilter = ref('all')
const selectedAchievement = ref(null)
const achievementShareCard = ref(null)
const detailDialog = ref(false)
const isSharingAchievement = ref(false)

const filterOptions = [
  { label: 'ALL', value: 'all' },
  { label: 'ACHIEVEMENTS', value: achievementTypes.ACHIEVEMENT },
  { label: 'CONVICTIONS', value: achievementTypes.CONVICTION },
]

const unlockById = computed(
  () => new Map(achievementsStore.unlocks.map((unlock) => [unlock.achievementId, unlock])),
)
const filteredAchievements = computed(() => {
  if (activeFilter.value === 'all') return achievementDefinitions
  return achievementDefinitions.filter((achievement) => achievement.type === activeFilter.value)
})
const filteredUnlockedCount = computed(
  () =>
    filteredAchievements.value.filter((achievement) => unlockById.value.has(achievement.id)).length,
)
const activeSectionTitle = computed(() => {
  if (activeFilter.value === achievementTypes.ACHIEVEMENT) return 'ACHIEVEMENTS'
  if (activeFilter.value === achievementTypes.CONVICTION) return 'CONVICTIONS'
  return 'BADGE CABINET'
})
const selectedUnlock = computed(() =>
  selectedAchievement.value ? unlockById.value.get(selectedAchievement.value.id) : null,
)
const isSecretLocked = computed(() => selectedAchievement.value?.secret && !selectedUnlock.value)
const detailName = computed(() => (isSecretLocked.value ? '???' : selectedAchievement.value?.name))
const detailCopy = computed(() => {
  if (!selectedAchievement.value) return ''
  if (isSecretLocked.value) return 'Undiscovered'
  if (selectedUnlock.value) return selectedAchievement.value.description
  return selectedAchievement.value.requirement
})
const detailTypeLabel = computed(() => {
  if (isSecretLocked.value) return 'UNDISCOVERED'
  return selectedAchievement.value?.type === achievementTypes.CONVICTION
    ? 'CONVICTION'
    : 'ACHIEVEMENT'
})
const selectedMonthLabel = computed(() => {
  if (!selectedUnlock.value?.unlockedMonth) return ''

  const [year, month] = selectedUnlock.value.unlockedMonth.split('-').map(Number)
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1),
  )
})
const achievementShareData = computed(() => ({
  asset: selectedAchievement.value?.asset || '',
  name: detailName.value || '',
  description: selectedAchievement.value?.description || '',
  typeLabel: detailTypeLabel.value,
  monthLabel: selectedMonthLabel.value.toUpperCase(),
}))
const achievementShareTitle = computed(() =>
  selectedAchievement.value
    ? `Financial Crimes badge: ${detailName.value}`
    : 'Financial Crimes badge',
)
const achievementShareText = computed(() =>
  [
    `${detailTypeLabel.value}: ${detailName.value}`,
    selectedAchievement.value?.description || '',
    selectedMonthLabel.value ? `Unlocked ${selectedMonthLabel.value}` : '',
  ]
    .filter(Boolean)
    .join('\n'),
)
const achievementShareImageName = computed(
  () => `financial-crimes-badge-${slugify(detailName.value)}.png`,
)

function openAchievement(achievement) {
  selectedAchievement.value = achievement
  detailDialog.value = true
}

async function shareAchievement() {
  if (!selectedAchievement.value || !selectedUnlock.value || isSharingAchievement.value) return

  isSharingAchievement.value = true
  try {
    const blob = await nodeToPngBlob(achievementShareCard.value?.$el)
    const result = await shareImageBlob({
      blob,
      fileName: achievementShareImageName.value,
      title: achievementShareTitle.value,
      text: achievementShareText.value,
    })

    if (result === 'copied') {
      $q.notify({ type: 'positive', message: 'Badge image copied to clipboard.' })
    } else if (result === 'downloaded') {
      $q.notify({ type: 'positive', message: 'Badge image downloaded.' })
    }
  } catch (error) {
    if (error?.name === 'AbortError') return

    $q.notify({ type: 'negative', message: 'Unable to share this badge.' })
  } finally {
    isSharingAchievement.value = false
  }
}

function slugify(value) {
  return String(value || 'badge')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
</script>
