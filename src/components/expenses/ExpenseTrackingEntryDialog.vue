<template>
  <q-dialog v-model="dialogModel" persistent :maximized="$q.screen.lt.sm">
    <q-card class="entry-card">
      <q-form class="dialog-layout" @submit.prevent="submit">
        <q-card-section class="entry-heading">
          <div>
            <h2>{{ t(subcategory.nameKey) }}</h2>
          </div>
          <q-btn
            flat
            round
            dense
            icon="close"
            class="dialog-close"
            :aria-label="t('common.cancel')"
            v-close-popup
          />
        </q-card-section>

        <q-card-section class="entry-fields">
          <div class="dialog-field">
            <label>{{ t('expenseTracker.entry.amount') }}</label>
            <q-input
              v-model.number="amount"
              autofocus
              outlined
              hide-bottom-space
              type="number"
              inputmode="decimal"
              min="0.01"
              step="0.01"
              prefix="€"
              :rules="[(value) => Number(value) > 0 || t('expenseTracker.validation.amount')]"
            >
              <template #prepend><q-icon :name="subcategory.icon" /></template>
            </q-input>
          </div>

          <div class="quick-amounts" :aria-label="t('expenseTracker.entry.quickAmounts')">
            <q-btn
              v-for="quickAmount in subcategory.quickAmounts"
              :key="quickAmount"
              outline
              no-caps
              color="primary"
              :label="formatCurrency(quickAmount)"
              @click="amount = quickAmount"
            />
          </div>

          <div class="dialog-field">
            <label>{{ t('expenseTracker.entry.date') }}</label>
            <q-input
              v-model="date"
              outlined
              hide-bottom-space
              type="date"
              :min="`${period}-01`"
              :max="lastDate"
              :rules="[(value) => Boolean(value) || t('expenseTracker.validation.date')]"
            />
          </div>

          <OwnershipEditor
            v-if="members.length > 1"
            v-model="ownership"
            :members="members"
            @validity="ownershipValid = $event"
          />

          <div class="dialog-field">
            <label>{{ t('expenseTracker.entry.notes') }}</label>
            <q-input v-model="notes" outlined hide-bottom-space autogrow type="textarea" />
          </div>
        </q-card-section>

        <q-card-actions class="entry-actions">
          <div class="primary-actions">
            <q-btn outline no-caps :label="t('common.cancel')" v-close-popup />
            <q-btn
              type="submit"
              unelevated
              no-caps
              color="primary"
              :label="t('common.save')"
              :loading="saving"
              :disable="!valid"
            />
          </div>
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import OwnershipEditor from '@/components/financial/OwnershipEditor.vue'
import {
  cloneOwnership,
  createSingleOwnership,
  isValidOwnership,
} from '@/domain/financial/ownership'
import { formatCurrency } from '@/utils/formatters'

const props = defineProps({
  modelValue: Boolean,
  subcategory: { type: Object, required: true },
  item: { type: Object, default: null },
  period: { type: String, required: true },
  members: { type: Array, required: true },
  preferredMemberId: { type: String, default: '' },
  saving: Boolean,
})
const emit = defineEmits(['update:modelValue', 'save'])
const $q = useQuasar()
const { t } = useI18n()
const amount = ref(null)
const date = ref('')
const notes = ref('')
const ownership = ref(createSingleOwnership(props.preferredMemberId))
const ownershipValid = ref(false)

const dialogModel = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})
const lastDate = computed(() => {
  const [year, month] = props.period.split('-').map(Number)
  return `${props.period}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`
})
const valid = computed(
  () =>
    Number(amount.value) > 0 &&
    Boolean(date.value) &&
    (props.members.length === 1 || ownershipValid.value),
)

watch(
  () => props.modelValue,
  (open) => {
    if (open) seed()
  },
  { immediate: true },
)

function seed() {
  amount.value = props.item?.amount ?? null
  date.value = props.item ? timestampDate(props.item.date) : defaultDate()
  notes.value = props.item?.notes || ''
  ownership.value = props.item?.ownership
    ? cloneOwnership(props.item.ownership)
    : createSingleOwnership(props.preferredMemberId || props.members[0]?.id)
  ownershipValid.value = isValidOwnership(
    ownership.value,
    props.members.map(({ id }) => id),
  )
}

function defaultDate() {
  const today = new Date()
  const localDate = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-')
  return localDate.startsWith(props.period) ? localDate : `${props.period}-01`
}

function timestampDate(value) {
  const parsed = value?.toDate ? value.toDate() : new Date(value)
  return [
    parsed.getFullYear(),
    String(parsed.getMonth() + 1).padStart(2, '0'),
    String(parsed.getDate()).padStart(2, '0'),
  ].join('-')
}

function submit() {
  if (!valid.value) return
  emit('save', {
    amount: Number(amount.value),
    date: date.value,
    notes: notes.value,
    ownership: cloneOwnership(ownership.value),
  })
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;

.entry-card {
  @include financial-dialog-card(34rem);
}

.dialog-layout {
  @include financial-dialog-layout;
}

.entry-heading {
  @include financial-dialog-header;
}

.entry-fields {
  @include financial-dialog-body;
  display: grid;
  gap: 1rem;
}

.dialog-field {
  @include financial-dialog-field;
  margin-bottom: 0;
}

.quick-amounts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-top: -0.65rem;
}

.entry-actions {
  @include financial-dialog-actions;
}
</style>
