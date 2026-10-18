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
          <div v-if="category.subtypes.length > 1" class="dialog-field">
            <label>{{ t('assets.form.type') }}</label>
            <q-select
              v-model="subtype"
              outlined
              :dense="$q.screen.lt.sm"
              hide-bottom-space
              emit-value
              map-options
              :options="subtypeOptions"
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
              maxlength="80"
            />
          </div>
          <div class="dialog-field">
            <label>{{ t('assets.form.currentValue') }}</label>
            <q-input
              v-model="currentValue"
              outlined
              :dense="$q.screen.lt.sm"
              hide-bottom-space
              autofocus
              type="number"
              min="0"
              step="0.01"
              prefix="€"
              lazy-rules
              :rules="[
                (value) =>
                  normalizeNonNegativeMoney(value) !== null || t('assets.form.valueInvalid'),
              ]"
            />
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
  cloneOwnership,
  createEqualOwnership,
  isValidOwnership,
} from '@/domain/financial/ownership'
import { normalizeNonNegativeMoney } from '@/domain/financial/money'

const props = defineProps({
  category: { type: Object, required: true },
  asset: { type: Object, default: null },
  defaults: { type: Object, default: null },
  members: { type: Array, required: true },
  saving: { type: Boolean, default: false },
})

const emit = defineEmits(['save', 'cancel', 'delete'])
const { t } = useI18n()
const form = ref(null)
const subtype = ref('')
const name = ref('')
const currentValue = ref('')
const ownership = ref(createEqualOwnership(props.members.map((member) => member.id)))
const ownershipValid = ref(true)
const submitting = ref(false)

const subtypeOptions = computed(() =>
  props.category.subtypes.map((value) => ({
    value,
    label: t(`assets.subtypes.${value}`),
  })),
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
  subtype.value = initial?.subtype || props.category.subtypes[0]
  name.value = initial?.name || ''
  currentValue.value = initial?.currentValue ?? ''
  ownership.value = initial?.ownership
    ? cloneOwnership(initial.ownership)
    : createEqualOwnership(props.members.map((member) => member.id))
  ownershipValid.value = isValidOwnership(
    ownership.value,
    props.members.map((member) => member.id),
  )
}

async function submit() {
  if (props.saving || submitting.value) return

  const formIsValid = await form.value?.validate()
  const value = normalizeNonNegativeMoney(currentValue.value)
  if (!formIsValid || value === null || !ownershipValid.value) return

  submitting.value = true
  emit('save', {
    category: props.category.id,
    subtype: subtype.value || null,
    name: name.value,
    currentValue: value,
    ownership: cloneOwnership(ownership.value),
  })
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

.form-actions {
  @include financial-dialog-actions;
}
</style>
