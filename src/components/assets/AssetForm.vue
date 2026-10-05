<template>
  <q-card class="asset-form-card">
    <q-card-section class="form-header">
      <div>
        <div class="eyebrow">{{ t(category.nameKey) }}</div>
        <h2>{{ asset ? t('assets.form.editTitle') : t(category.addLabelKey) }}</h2>
      </div>
      <q-btn
        flat
        round
        dense
        icon="close"
        :aria-label="t('common.cancel')"
        @click="$emit('cancel')"
      />
    </q-card-section>

    <q-card-section>
      <q-form class="asset-form" @submit="submit">
        <q-select
          v-if="category.subtypes.length > 1"
          v-model="subtype"
          outlined
          emit-value
          map-options
          :label="t('assets.form.type')"
          :options="subtypeOptions"
        />
        <q-input
          v-model.trim="name"
          outlined
          autofocus
          :label="t('assets.form.name')"
          maxlength="80"
          lazy-rules
          :rules="[(value) => Boolean(value) || t('assets.form.nameRequired')]"
        />
        <q-input
          v-model="currentValue"
          outlined
          type="number"
          min="0"
          step="0.01"
          prefix="€"
          :label="t('assets.form.currentValue')"
          lazy-rules
          :rules="[(value) => normalizeMoney(value) !== null || t('assets.form.valueInvalid')]"
        />

        <OwnershipEditor
          v-model="ownership"
          :members="members"
          @validity="ownershipValid = $event"
        />

        <div class="form-actions">
          <q-btn
            v-if="asset"
            flat
            no-caps
            color="negative"
            icon="delete_outline"
            :label="t('common.delete')"
            :disable="saving"
            @click="$emit('delete')"
          />
          <div class="primary-actions">
            <q-btn
              flat
              no-caps
              :label="t('common.cancel')"
              :disable="saving"
              @click="$emit('cancel')"
            />
            <q-btn
              unelevated
              no-caps
              color="primary"
              type="submit"
              :label="asset ? t('common.save') : t('common.add')"
              :loading="saving"
              :disable="!ownershipValid"
            />
          </div>
        </div>
      </q-form>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import OwnershipEditor from './OwnershipEditor.vue'
import { createSingleOwnership, isValidOwnership, normalizeMoney } from '@/utils/asset-calculations'

const props = defineProps({
  category: { type: Object, required: true },
  asset: { type: Object, default: null },
  members: { type: Array, required: true },
  saving: { type: Boolean, default: false },
})

const emit = defineEmits(['save', 'cancel', 'delete'])
const { t } = useI18n()
const subtype = ref('')
const name = ref('')
const currentValue = ref('')
const ownership = ref(createSingleOwnership(props.members[0]?.id))
const ownershipValid = ref(true)

const subtypeOptions = computed(() =>
  props.category.subtypes.map((value) => ({
    value,
    label: t(`assets.subtypes.${value}`),
  })),
)

watch(() => [props.asset, props.category.id], reset, { immediate: true })

function reset() {
  subtype.value = props.asset?.subtype || props.category.subtypes[0]
  name.value = props.asset?.name || ''
  currentValue.value = props.asset?.currentValue ?? ''
  ownership.value = props.asset?.ownership
    ? structuredClone(props.asset.ownership)
    : createSingleOwnership(props.members[0]?.id)
  ownershipValid.value = isValidOwnership(
    ownership.value,
    props.members.map((member) => member.id),
  )
}

function submit() {
  const value = normalizeMoney(currentValue.value)
  if (!name.value || value === null || !ownershipValid.value) return

  emit('save', {
    category: props.category.id,
    subtype: subtype.value || null,
    name: name.value,
    currentValue: value,
    ownership: structuredClone(ownership.value),
  })
}
</script>

<style scoped lang="scss">
.asset-form-card {
  width: min(34rem, calc(100vw - 2rem));
  border-radius: var(--radius-card);
}

.form-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.eyebrow {
  color: var(--color-primary);
  font-size: 0.72rem;
  font-weight: 750;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

h2 {
  margin: 0.25rem 0 0;
  color: var(--color-ink);
  font-size: 1.65rem;
  letter-spacing: -0.035em;
}

.asset-form {
  display: grid;
  gap: 1rem;
}

.form-actions {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.primary-actions {
  display: flex;
  gap: 0.75rem;
  margin-left: auto;
}
</style>
