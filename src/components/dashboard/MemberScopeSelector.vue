<template>
  <div
    class="member-selector"
    :class="{ compact }"
    role="group"
    :aria-label="t('dashboard.memberScope')"
  >
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
      <q-tooltip v-if="compact">{{ member.name }}</q-tooltip>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  members: { type: Array, required: true },
  modelValue: { type: String, required: true },
  compact: { type: Boolean, default: false },
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
  background: var(--color-surface-muted);
  color: var(--color-ink-soft);
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
  box-shadow: 0 0 0 3px var(--color-primary-glow);
}

.member-name {
  overflow: hidden;
  max-width: 4.8rem;
  font-size: 0.75rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-selector.compact {
  align-items: center;
  gap: 0.3rem;
  padding: 0.15rem;
}

.compact .member-option {
  min-width: 2.5rem;
}

.compact .member-avatar {
  width: 2.35rem !important;
  height: 2.35rem !important;
  font-size: 0.72rem;
}

.compact .member-name {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 760px) {
  .member-selector {
    gap: 0.2rem;
    max-width: 48vw;
    padding: 0 0 0.15rem;
  }

  .member-option {
    gap: 0.12rem;
    min-width: 2.65rem;
  }

  .member-avatar {
    width: 2.15rem !important;
    height: 2.15rem !important;
    font-size: 0.7rem;
  }

  .member-avatar :deep(.q-avatar__content),
  .member-avatar :deep(.q-avatar__content > span) {
    display: grid;
    width: 100%;
    height: 100%;
    place-items: center;
    line-height: 1;
  }

  .member-avatar :deep(.q-avatar__content > span) {
    font-size: 0.62rem;
    transform: translateY(-0.03em);
  }

  .member-avatar :deep(.q-icon) {
    font-size: 1.1rem !important;
  }

  .member-name {
    max-width: 3.4rem;
    font-size: 0.64rem;
  }

  .member-option.selected .member-avatar {
    box-shadow: 0 0 0 2px var(--color-primary-glow);
  }
}
</style>
