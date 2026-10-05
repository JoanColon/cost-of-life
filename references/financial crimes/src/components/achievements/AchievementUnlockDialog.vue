<template>
  <q-dialog v-model="dialogOpen" persistent class="achievement-unlock-dialog-shell">
    <q-card v-if="currentAchievement" class="achievement-unlock-dialog">
      <q-btn
        v-close-popup
        class="achievement-detail-dialog__close"
        flat
        round
        dense
        icon="close"
        color="white"
        aria-label="Close"
        @click="dismiss"
      />
      <q-card-section class="achievement-unlock-dialog__body">
        <div class="section-kicker">{{ unlockKindLabel }} UNLOCKED</div>
        <img
          class="achievement-unlock-dialog__image"
          :src="currentAchievement.asset"
          :alt="`${currentAchievement.name} badge`"
        />
        <h2>{{ currentAchievement.name }}</h2>
        <p>{{ currentAchievement.description }}</p>
        <div class="achievement-unlock-dialog__month">Earned {{ unlockedMonthLabel }}</div>
      </q-card-section>

      <q-card-actions align="center">
        <q-btn
          class="achievement-unlock-dialog__button"
          color="warning"
          text-color="black"
          unelevated
          no-caps
          :label="hasNext ? 'NEXT' : 'CASE CLOSED'"
          @click="advance"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { getAchievementDefinition } from '@/config/achievements'

const emit = defineEmits(['update:modelValue', 'finished'])

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  unlocks: {
    type: Array,
    default: () => [],
  },
})

const activeIndex = ref(0)

const dialogOpen = computed({
  get: () => props.modelValue && Boolean(currentUnlock.value),
  set: (value) => {
    if (!value) emit('update:modelValue', false)
  },
})
const currentUnlock = computed(() => props.unlocks[activeIndex.value] || null)
const currentAchievement = computed(() =>
  currentUnlock.value ? getAchievementDefinition(currentUnlock.value.achievementId) : null,
)
const hasNext = computed(() => activeIndex.value < props.unlocks.length - 1)
const unlockKindLabel = computed(() =>
  currentAchievement.value?.type === 'conviction' ? 'CONVICTION' : 'ACHIEVEMENT',
)
const unlockedMonthLabel = computed(() => {
  if (!currentUnlock.value?.unlockedMonth) return 'this month'

  const [year, month] = currentUnlock.value.unlockedMonth.split('-').map(Number)
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1),
  )
})

watch(
  () => props.modelValue,
  (value) => {
    if (value) activeIndex.value = 0
  },
)

function advance() {
  if (hasNext.value) {
    activeIndex.value += 1
    return
  }

  emit('update:modelValue', false)
  emit('finished')
}

function dismiss() {
  emit('finished')
}
</script>
