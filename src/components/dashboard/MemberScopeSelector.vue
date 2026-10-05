<template>
  <div class="member-selector" role="group" :aria-label="t('dashboard.memberScope')">
    <button
      v-for="member in options"
      :key="member.id"
      type="button"
      class="member-option"
      :class="{ selected: modelValue === member.id }"
      :aria-pressed="modelValue === member.id"
      @click="$emit('update:modelValue', member.id)"
    >
      <q-avatar class="member-avatar" size="3rem">
        <q-icon v-if="member.id === 'all'" name="group" size="1.55rem" />
        <img v-else-if="member.photoURL" :src="member.photoURL" :alt="member.name" />
        <span v-else>{{ initials(member.name) }}</span>
      </q-avatar>
      <span class="member-name">{{ member.name }}</span>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  members: { type: Array, required: true },
  modelValue: { type: String, required: true },
})

defineEmits(['update:modelValue'])

const { t } = useI18n()
const options = computed(() => [...props.members, { id: 'all', name: t('dashboard.allMembers') }])

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;

.member-selector {
  display: flex;
  gap: 0.55rem;
  overflow-x: auto;
  padding: 0.2rem 0.2rem 0.35rem;
  scrollbar-width: none;
}

.member-selector::-webkit-scrollbar {
  display: none;
}

.member-option {
  display: grid;
  justify-items: center;
  flex: 0 0 auto;
  gap: 0.3rem;
  min-width: 3.65rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-copy);
  cursor: pointer;
}

.member-option:focus-visible {
  border-radius: 0.75rem;
  @include focus-ring;
}

.member-avatar {
  border: 2px solid transparent;
  background: #edf2f6;
  color: #334964;
  font-size: 0.86rem;
  font-weight: 750;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease;
}

.member-option:hover .member-avatar {
  transform: translateY(-1px);
}

.member-option.selected {
  color: var(--color-primary);
}

.member-option.selected .member-avatar {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgb(22 136 248 / 12%);
}

.member-name {
  overflow: hidden;
  max-width: 4.8rem;
  font-size: 0.75rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
