<template>
  <q-card class="liability-form-card">
    <q-card-section class="form-header">
      <div>
        <div class="eyebrow">{{ t(category.nameKey) }}</div>
        <h2>{{ liability ? t('liabilities.form.editTitle') : t(category.addLabelKey) }}</h2>
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
      <q-form ref="form" class="liability-form" @submit.prevent="submit">
        <q-input
          v-model.trim="name"
          outlined
          autofocus
          :label="t('liabilities.form.name')"
          maxlength="80"
          lazy-rules
          :rules="[(value) => Boolean(value) || t('liabilities.form.nameRequired')]"
        />
        <q-input
          v-model="balance"
          outlined
          type="number"
          min="0"
          step="0.01"
          prefix="€"
          :label="t('liabilities.form.balance')"
          lazy-rules
          :rules="[
            (value) => normalizeMoney(value) !== null || t('liabilities.form.balanceInvalid'),
          ]"
        />

        <OwnershipEditor
          v-model="ownership"
          :members="members"
          @validity="ownershipValid = $event"
        />

        <div class="form-actions">
          <q-btn
            v-if="liability"
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
              flat
              no-caps
              :label="t('common.cancel')"
              :disable="saving || submitting"
              @click="$emit('cancel')"
            />
            <q-btn
              unelevated
              no-caps
              color="primary"
              type="button"
              :label="liability ? t('common.save') : t('common.add')"
              :loading="saving || submitting"
              :disable="!ownershipValid || saving || submitting"
              @click="submit"
            />
          </div>
        </div>
      </q-form>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import OwnershipEditor from '@/components/assets/OwnershipEditor.vue'
import {
  cloneOwnership,
  createEqualOwnership,
  isValidOwnership,
} from '@/domain/financial/ownership'
import { normalizeMoney } from '@/domain/financial/money'

const props = defineProps({
  category: { type: Object, required: true },
  liability: { type: Object, default: null },
  defaults: { type: Object, default: null },
  members: { type: Array, required: true },
  saving: { type: Boolean, default: false },
})

const emit = defineEmits(['save', 'cancel', 'delete'])
const { t } = useI18n()
const form = ref(null)
const name = ref('')
const balance = ref('')
const ownership = ref(createEqualOwnership(props.members.map((member) => member.id)))
const ownershipValid = ref(true)
const submitting = ref(false)

watch(() => [props.liability, props.defaults, props.category.id], reset, { immediate: true })
watch(
  () => props.saving,
  (saving) => {
    if (!saving) submitting.value = false
  },
)

function reset() {
  const initial = props.liability || props.defaults
  name.value = initial?.name || ''
  balance.value = initial?.balance ?? ''
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
  const normalizedBalance = normalizeMoney(balance.value)
  if (!formIsValid || !name.value || normalizedBalance === null || !ownershipValid.value) return

  submitting.value = true
  emit('save', {
    category: props.category.id,
    name: name.value,
    balance: normalizedBalance,
    ownership: cloneOwnership(ownership.value),
  })
}
</script>

<style scoped lang="scss">
.liability-form-card {
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
.liability-form {
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
