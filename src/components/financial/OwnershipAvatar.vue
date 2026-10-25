<template>
  <q-avatar
    v-if="displayId"
    :size="size"
    class="ownership-avatar"
    :class="{ 'ownership-avatar--all': displayId === 'all' }"
    :aria-label="label"
    role="img"
  >
    <q-icon v-if="displayId === 'all'" name="group" :size="iconSize" />
    <img v-else-if="member?.photoURL" :src="member.photoURL" :alt="label" />
    <span v-else>{{ initials(label) }}</span>
    <q-tooltip>{{ label }}</q-tooltip>
  </q-avatar>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ownershipDisplayId } from '@/domain/financial/ownership'

const props = defineProps({
  ownership: { type: Object, default: null },
  members: { type: Array, default: () => [] },
  size: { type: String, default: '2.25rem' },
})

const { t } = useI18n()
const displayId = computed(() => ownershipDisplayId(props.ownership))
const member = computed(() => props.members.find(({ id }) => id === displayId.value) || null)
const label = computed(() =>
  displayId.value === 'all'
    ? t('dashboard.allMembers')
    : member.value?.name || t('financial.ownership.individual'),
)
const iconSize = computed(() => `calc(${props.size} * 0.5)`)

function initials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}
</script>

<style scoped>
.ownership-avatar {
  flex: 0 0 auto;
  border: 2px solid var(--color-surface);
  background: var(--color-surface-muted);
  color: var(--color-ink-soft);
  font-size: 0.72rem;
  font-weight: 750;
  box-shadow: 0 0 0 1px var(--color-line);
}

.ownership-avatar--all {
  background: var(--color-blue-soft);
  color: var(--color-primary);
}
</style>
