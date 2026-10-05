<template>
  <button
    class="achievement-badge"
    :class="{
      'achievement-badge--locked': !unlocked,
      'achievement-badge--conviction': achievement.type === 'conviction',
    }"
    type="button"
    @click="$emit('select', achievement)"
  >
    <div class="achievement-badge__image-wrap">
      <img class="achievement-badge__image" :src="achievement.asset" :alt="imageAlt" />
    </div>
    <div class="achievement-badge__name">{{ displayName }}</div>
    <div class="achievement-badge__state">{{ stateLabel }}</div>
    <div v-if="!unlocked" class="achievement-badge__lock">
      <q-icon name="lock" />
    </div>
  </button>
</template>

<script setup>
import { computed } from 'vue'

defineEmits(['select'])

const props = defineProps({
  achievement: {
    type: Object,
    required: true,
  },
  unlock: {
    type: Object,
    default: null,
  },
})

const unlocked = computed(() => Boolean(props.unlock))
const isSecretLocked = computed(() => props.achievement.secret && !unlocked.value)
const displayName = computed(() => (isSecretLocked.value ? '???' : props.achievement.name))
const stateLabel = computed(() => {
  if (unlocked.value) return 'Unlocked'
  if (isSecretLocked.value) return 'Undiscovered'
  return 'Locked'
})
const imageAlt = computed(() => `${displayName.value} badge`)
</script>
