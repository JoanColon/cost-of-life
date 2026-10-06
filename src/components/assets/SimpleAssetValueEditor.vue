<template>
  <span
    class="simple-value"
    :class="{ disabled: disabled || saving }"
    role="button"
    :aria-label="ariaLabel || t('assets.quickEdit.editLabel', { value: formattedValue })"
    :aria-disabled="disabled || saving"
    :tabindex="disabled || saving ? -1 : 0"
  >
    <q-spinner v-if="saving" color="primary" size="1.1rem" />
    <template v-else>
      <span>{{ formattedValue }}</span>
      <q-icon v-if="!disabled" name="edit" class="edit-icon" aria-hidden="true" />
    </template>

    <q-popup-edit
      v-model="editorValue"
      buttons
      :disable="disabled || saving"
      :title="title || t('assets.quickEdit.title')"
      :label-set="t('common.save')"
      :label-cancel="t('common.cancel')"
      :validate="isValidValue"
      anchor="bottom right"
      self="top right"
      @before-show="resetEditor"
      @save="save"
    >
      <template #default="scope">
        <q-input
          v-model="scope.value"
          autofocus
          dense
          outlined
          type="number"
          inputmode="decimal"
          min="0"
          step="0.01"
          :prefix="currencySymbol"
          :label="inputLabel || t('assets.form.totalValue')"
          :rules="[valueRule]"
          @keyup.enter="scope.set"
        />
      </template>
    </q-popup-edit>
  </span>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { normalizeMoney } from '@/utils/asset-calculations'
import { currencySymbol } from '@/utils/formatters'

const props = defineProps({
  value: { type: Number, default: 0 },
  formattedValue: { type: String, required: true },
  saving: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  ariaLabel: { type: String, default: '' },
  title: { type: String, default: '' },
  inputLabel: { type: String, default: '' },
})

const emit = defineEmits(['save'])
const { t } = useI18n()
const editorValue = ref(props.value)

watch(
  () => props.value,
  (value) => {
    editorValue.value = value
  },
)

function isValidValue(value) {
  return normalizeMoney(value) !== null
}

function valueRule(value) {
  return isValidValue(value) || t('assets.form.valueInvalid')
}

function resetEditor() {
  editorValue.value = props.value
}

function save(value) {
  const normalizedValue = normalizeMoney(value)
  if (normalizedValue !== null) emit('save', normalizedValue)
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;

.simple-value {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.35rem;
  min-width: 5rem;
  min-height: 2.5rem;
  padding: 0.35rem 0.55rem;
  border: 0;
  border-radius: 0.55rem;
  background: transparent;
  color: var(--color-ink);
  font: inherit;
  font-size: 1.15rem;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color 150ms ease,
    color 150ms ease;
}

.simple-value:hover {
  background: var(--color-green-soft);
  color: var(--color-success-dark);
}

.simple-value:focus-visible {
  @include focus-ring;
}

.simple-value.disabled {
  cursor: default;
}

.simple-value.disabled:hover {
  background: transparent;
  color: var(--color-ink);
}

.edit-icon {
  width: 0;
  overflow: hidden;
  font-size: 0.9rem;
  opacity: 0;
  transition:
    width 150ms ease,
    opacity 150ms ease;
}

.simple-value:hover .edit-icon,
.simple-value:focus-visible .edit-icon {
  width: 0.9rem;
  opacity: 1;
}
</style>
