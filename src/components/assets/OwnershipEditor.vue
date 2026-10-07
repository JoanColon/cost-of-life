<template>
  <div v-if="members.length > 1" class="ownership-editor">
    <div class="field-label">{{ t('assets.ownership.label') }}</div>

    <div class="ownership-options">
      <button
        v-for="member in members"
        :key="member.id"
        type="button"
        class="ownership-option"
        :class="{ selected: selection === member.id }"
        @click="selectSingle(member.id)"
      >
        {{ member.name }}
      </button>
      <button
        type="button"
        class="ownership-option"
        :class="{ selected: selection === 'shared' }"
        @click="selectShared"
      >
        {{ t('assets.ownership.shared') }}
      </button>
    </div>

    <div v-if="selection === 'shared'" class="share-grid">
      <q-input
        v-for="share in sharedShares"
        :key="share.memberId"
        outlined
        dense
        type="number"
        min="0"
        max="100"
        step="0.01"
        suffix="%"
        :label="memberName(share.memberId)"
        :model-value="share.percentage"
        @update:model-value="updateShare(share.memberId, $event)"
      />
    </div>

    <div v-if="selection === 'shared'" class="share-total" :class="{ invalid: !valid }">
      {{ t('assets.ownership.total', { total: shareTotal }) }}
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
  gap: 0.55rem;
}

.ownership-option {
  min-height: 2.5rem;
  padding: 0.45rem 0.85rem;
  border: 1px solid var(--color-line);
  border-radius: 0.75rem;
  background: var(--color-surface);
  color: var(--color-copy);
  cursor: pointer;
}

.ownership-option.selected {
  border-color: var(--color-primary);
  background: var(--color-blue-soft);
  color: var(--color-primary);
  font-weight: 700;
}

.ownership-option:focus-visible {
  @include focus-ring;
}

.share-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: 0.75rem;
}

.share-total {
  color: var(--color-success-dark);
  font-size: 0.78rem;
}

.share-total.invalid {
  color: var(--color-danger);
}
</style>
