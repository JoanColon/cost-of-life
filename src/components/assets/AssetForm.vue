<template>
  <q-card class="asset-form-card">
    <q-form ref="form" class="dialog-layout" @submit.prevent="submit">
      <q-card-section class="form-header">
        <h2>{{ asset ? t('assets.form.editTitle') : t(category.addLabelKey) }}</h2>
        <q-btn
          flat
          round
          dense
          icon="close"
          class="dialog-close"
          :aria-label="t('common.cancel')"
          @click="$emit('cancel')"
        />
      </q-card-section>

      <q-card-section class="form-body">
        <div class="asset-form">
          <div class="dialog-field">
            <label>{{ t('assets.form.subcategory') }}</label>
            <q-select
              v-model="subcategoryId"
              outlined
              :dense="$q.screen.lt.sm"
              hide-bottom-space
              emit-value
              map-options
              :options="subcategoryOptions"
              :disable="Boolean(asset)"
            >
              <template #prepend><q-icon :name="category.icon" /></template>
            </q-select>
          </div>
          <div class="dialog-field">
            <label>{{ t('assets.form.name') }}</label>
            <q-input
              v-model.trim="name"
              outlined
              :dense="$q.screen.lt.sm"
              hide-bottom-space
              autofocus
              maxlength="80"
              lazy-rules
              :rules="[(value) => Boolean(value) || t('assets.form.nameRequired')]"
            />
          </div>
          <div class="dialog-field">
            <label>{{ t('assets.form.notes') }}</label>
            <q-input
              v-model="notes"
              outlined
              :dense="$q.screen.lt.sm"
              hide-bottom-space
              autogrow
              type="textarea"
              :placeholder="t('assets.form.notesPlaceholder')"
            />
          </div>
          <div class="dialog-field">
            <label>{{ t('assets.form.currentValue') }}</label>
            <q-input
              v-model="currentValue"
              outlined
              :dense="$q.screen.lt.sm"
              hide-bottom-space
              type="number"
              min="0"
              step="0.01"
              :prefix="currencySymbol"
              :disable="modelManagedValue"
              lazy-rules
              :rules="[
                (value) =>
                  normalizeNonNegativeMoneyOrNull(value) !== null || t('assets.form.valueInvalid'),
              ]"
            />
            <small v-if="modelManagedValue" class="model-managed-hint">
              {{ t(managedValueHint) }}
            </small>
          </div>

          <div v-if="isMortgageEligible" class="linked-mortgage-notice">
            <q-icon name="account_balance" color="primary" size="1.4rem" />
            <div>
              <strong>{{ t('assets.form.linkedMortgage') }}</strong>
              <span>{{ linkedMortgage?.itemName || t('assets.form.noMortgage') }}</span>
              <small>{{ t('assets.form.linkedMortgageReadOnlyHint') }}</small>
            </div>
          </div>

          <OwnershipEditor
            v-model="ownership"
            :members="members"
            @validity="ownershipValid = $event"
          />
        </div>
      </q-card-section>

      <q-card-actions class="form-actions">
        <q-btn
          v-if="asset"
          flat
          no-caps
          color="negative"
          icon="delete_outline"
          :label="t('common.delete')"
          :disable="saving || submitting"
          @click="$emit('delete')"
        />
        <div class="primary-actions">
          <q-btn
            outline
            no-caps
            :label="t('common.cancel')"
            :disable="saving || submitting"
            @click="$emit('cancel')"
          />
          <q-btn
            unelevated
            no-caps
            color="primary"
            type="submit"
            :label="t('common.save')"
            :loading="saving || submitting"
            :disable="!ownershipValid || saving || submitting"
          />
        </div>
      </q-card-actions>
    </q-form>
  </q-card>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import OwnershipEditor from '@/components/financial/OwnershipEditor.vue'
import {
  cloneOwnershipAllocation,
  createEqualMemberOwnership,
  isValidOwnershipAllocation,
} from '../../../functions/shared/core/ownership.js'
import { normalizeNonNegativeMoneyOrNull } from '../../../functions/shared/core/money.js'
import { currencySymbol } from '@/utils/formatters'

const props = defineProps({
  category: { type: Object, required: true },
  asset: { type: Object, default: null },
  defaults: { type: Object, default: null },
  members: { type: Array, required: true },
  saving: { type: Boolean, default: false },
  mortgages: { type: Array, default: () => [] },
})

const emit = defineEmits(['save', 'cancel', 'delete'])
const { t } = useI18n()
const form = ref(null)
const subcategoryId = ref('')
const name = ref('')
const notes = ref('')
const currentValue = ref('')
const ownership = ref(createEqualMemberOwnership(props.members.map((member) => member.id)))
const ownershipValid = ref(true)
const submitting = ref(false)

const subcategoryOptions = computed(() =>
  props.category.subcategories.map((value) => ({
    value,
    label: t(`assets.subtypes.${value}`),
  })),
)
const isMortgageEligible = computed(() =>
  ['primary_home', 'rental_property'].includes(subcategoryId.value),
)
const linkedMortgage = computed(
  () =>
    props.mortgages.find((mortgage) => mortgage.id === props.asset?.mortgageLiabilityId) || null,
)
const portfolioManagedValue = computed(() =>
  Boolean(props.asset?.detail?.portfolio?.spreadsheetUrl),
)
const modelManagedValue = computed(
  () => props.asset?.detail?.realEstate?.schemaVersion === 2 || portfolioManagedValue.value,
)
const managedValueHint = computed(() =>
  portfolioManagedValue.value
    ? 'assets.form.portfolioManagedValueHint'
    : 'assets.form.modelManagedValueHint',
)

watch(() => [props.asset, props.defaults, props.category.id], reset, { immediate: true })
watch(
  () => props.saving,
  (saving) => {
    if (!saving) submitting.value = false
  },
)

function reset() {
  const initial = props.asset || props.defaults
  subcategoryId.value = initial?.subcategoryId || props.category.subcategories[0]
  name.value = initial?.itemName || ''
  notes.value = initial?.notes || ''
  currentValue.value = initial?.currentValue ?? ''
  ownership.value = initial?.ownership
    ? cloneOwnershipAllocation(initial.ownership)
    : createEqualMemberOwnership(props.members.map((member) => member.id))
  ownershipValid.value = isValidOwnershipAllocation(
    ownership.value,
    props.members.map((member) => member.id),
  )
}

async function submit() {
  if (props.saving || submitting.value) return

  const formIsValid = await form.value?.validate()
  const value = normalizeNonNegativeMoneyOrNull(currentValue.value)
  if (!formIsValid || value === null || !ownershipValid.value) return

  submitting.value = true
  emit('save', {
    categoryId: props.category.id,
    subcategoryId: subcategoryId.value,
    itemName: name.value.trim(),
    notes: notes.value.trim(),
    currentValue: value,
    ownership: cloneOwnershipAllocation(ownership.value),
    detail: { ...(initialDetail() || {}) },
    mortgageLiabilityId: isMortgageEligible.value ? props.asset?.mortgageLiabilityId || null : null,
  })
}

function initialDetail() {
  return (props.asset || props.defaults)?.detail
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;

.asset-form-card {
  @include financial-dialog-card(38rem);
}

.dialog-layout {
  @include financial-dialog-layout;
}

.form-header {
  @include financial-dialog-header;
}

.form-body {
  @include financial-dialog-body;
}

.asset-form {
  display: grid;
  gap: 1rem;
}

.dialog-field {
  @include financial-dialog-field;
  margin-bottom: 0;
}

.linked-mortgage-notice {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  padding: 0.9rem 1rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface-soft);
}

.linked-mortgage-notice div {
  display: grid;
  gap: 0.2rem;
}

.linked-mortgage-notice span,
.linked-mortgage-notice small {
  color: var(--color-copy);
}

.model-managed-hint {
  color: var(--color-copy);
}

.form-actions {
  @include financial-dialog-actions;
}
</style>
