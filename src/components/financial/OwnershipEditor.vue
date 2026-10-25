<template>
  <div v-if="members.length > 1" class="ownership-editor">
    <div v-if="!hideLabel" class="field-label">{{ t('financial.ownership.label') }}</div>

    <div class="ownership-options">
      <button
        v-for="member in members"
        :key="member.id"
        type="button"
        class="ownership-option"
        :class="{ selected: selection === member.id }"
        :aria-pressed="selection === member.id"
        @click="selectSingle(member.id)"
      >
        <q-avatar class="ownership-avatar" size="3rem">
          <img v-if="member.photoURL" :src="member.photoURL" :alt="member.name" />
          <span v-else>{{ initials(member.name) }}</span>
        </q-avatar>
        <span class="ownership-name">{{ member.name }}</span>
      </button>
      <button
        type="button"
        class="ownership-option"
        :class="{ selected: selection === 'shared' }"
        :aria-pressed="selection === 'shared'"
        @click="selectShared"
      >
        <q-avatar class="ownership-avatar" size="3rem">
          <q-icon name="group" size="1.55rem" />
        </q-avatar>
        <span class="ownership-name">{{ t('financial.ownership.shared') }}</span>
      </button>
    </div>

    <div v-if="selection === 'shared'" class="share-grid">
      <div v-for="share in sharedShares" :key="share.memberId" class="share-field">
        <label>{{ memberName(share.memberId) }}</label>
        <q-input
          outlined
          dense
          hide-bottom-space
          type="number"
          min="0"
          max="100"
          step="0.01"
          suffix="%"
          :model-value="share.percentage"
          @update:model-value="updateShare(share.memberId, $event)"
        />
      </div>
    </div>

    <div v-if="selection === 'shared'" class="share-total" :class="{ invalid: !valid }">
      {{ t('financial.ownership.total', { total: shareTotal }) }}
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  createEqualOwnership,
  createSingleOwnership,
  isValidOwnership,
} from '@/domain/financial/ownership'

const props = defineProps({
  modelValue: { type: Object, required: true },
  members: { type: Array, required: true },
  hideLabel: Boolean,
})

const emit = defineEmits(['update:modelValue', 'validity'])
const { t } = useI18n()

const selection = computed(() =>
  props.modelValue?.mode === 'shared' || props.modelValue?.shares?.length > 1
    ? 'shared'
    : props.modelValue?.shares?.[0]?.memberId,
)
const sharedShares = computed(() => props.modelValue?.shares || [])
const shareTotal = computed(
  () =>
    Math.round(
      sharedShares.value.reduce((sum, share) => sum + Number(share.percentage || 0), 0) * 100,
    ) / 100,
)
const valid = computed(() =>
  isValidOwnership(
    props.modelValue,
    props.members.map((member) => member.id),
  ),
)

function selectSingle(memberId) {
  update(createSingleOwnership(memberId))
}

function selectShared() {
  if (selection.value === 'shared') return
  update(createEqualOwnership(props.members.map((member) => member.id)))
}

function updateShare(memberId, percentage) {
  update({
    mode: 'shared',
    shares: sharedShares.value.map((share) =>
      share.memberId === memberId ? { ...share, percentage: Number(percentage) } : share,
    ),
  })
}

function update(ownership) {
  emit('update:modelValue', ownership)
  emit(
    'validity',
    isValidOwnership(
      ownership,
      props.members.map((member) => member.id),
    ),
  )
}

function memberName(memberId) {
  return props.members.find((member) => member.id === memberId)?.name || memberId
}

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

<style scoped lang="scss">
@use '@/css/mixins' as *;

.ownership-editor {
  display: grid;
  gap: 0.75rem;
}

.field-label {
  color: var(--color-ink);
  font-size: 0.86rem;
  font-weight: 700;
}

.ownership-options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.ownership-option {
  display: grid;
  justify-items: center;
  flex: 0 0 auto;
  gap: 0.3rem;
  min-width: 4rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-copy);
  cursor: pointer;
}

.ownership-option.selected {
  color: var(--color-primary);
  font-weight: 700;
}

.ownership-option:focus-visible {
  border-radius: 0.75rem;
  @include focus-ring;
}

.ownership-avatar {
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

.ownership-option:hover .ownership-avatar {
  transform: translateY(-1px);
}

.ownership-option.selected .ownership-avatar {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-glow);
}

.ownership-name {
  overflow: hidden;
  max-width: 6rem;
  font-size: 0.75rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.share-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: 0.75rem;
}

.share-field {
  display: grid;
  gap: 0.35rem;
}

.share-field label {
  color: var(--color-copy);
  font-size: 0.78rem;
  font-weight: 650;
}

.share-total {
  color: var(--color-success-dark);
  font-size: 0.78rem;
}

.share-total.invalid {
  color: var(--color-danger);
}
</style>
