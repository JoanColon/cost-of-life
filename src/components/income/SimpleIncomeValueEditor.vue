<template>
  <span
    class="simple-value"
    :class="{ disabled: disabled || saving }"
    role="button"
    :tabindex="disabled || saving ? -1 : 0"
  >
    <q-spinner v-if="saving" color="primary" size="1.1rem" />
    <template v-else
      ><span>{{ formattedValue }}</span
      ><q-icon v-if="!disabled" name="edit" class="edit-icon"
    /></template>
    <q-popup-edit
      v-model="editorValue"
      buttons
      :disable="disabled || saving"
      :title="t('income.quickEdit.title')"
      :label-set="t('common.save')"
      :label-cancel="t('common.cancel')"
      :validate="isValidValue"
      anchor="bottom right"
      self="top right"
      @before-show="editorValue = value"
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
          :suffix="t('income.perYear')"
          :label="t('income.form.annualIncome')"
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
import { normalizeMoney } from '@/domain/financial/money'
import { currencySymbol } from '@/utils/formatters'
const props = defineProps({
  value: { type: Number, default: 0 },
  formattedValue: { type: String, required: true },
  saving: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['save'])
const { t } = useI18n()
const editorValue = ref(props.value)
watch(
  () => props.value,
  (value) => (editorValue.value = value),
)
const isValidValue = (value) => normalizeMoney(value) !== null
const valueRule = (value) => isValidValue(value) || t('income.form.valueInvalid')
function save(value) {
  const normalized = normalizeMoney(value)
  if (normalized !== null) emit('save', normalized)
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;
.simple-value {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.35rem;
  min-width: 7rem;
  min-height: 2.5rem;
  padding: 0.35rem 0.55rem;
  border-radius: 0.55rem;
  color: var(--color-ink);
  font-size: 1.15rem;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
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
  font-size: 0.9rem;
  opacity: 0;
}
.simple-value:hover .edit-icon,
.simple-value:focus-visible .edit-icon {
  opacity: 1;
}
</style>
