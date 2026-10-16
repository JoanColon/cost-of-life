<template>
  <q-dialog v-model="dialogModel" persistent :maximized="$q.screen.lt.sm">
    <q-card class="entry-card">
      <q-form @submit.prevent="submit">
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
          <q-input
            v-model.number="amount"
            autofocus
            outlined
            type="number"
            inputmode="decimal"
            min="0.01"
            step="0.01"
            prefix="€"
            :label="t('expenseTracker.entry.amount')"
            :rules="[(value) => Number(value) > 0 || t('expenseTracker.validation.amount')]"
          />

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

          <q-input
            v-model="date"
            outlined
            type="date"
            :min="`${period}-01`"
            :max="lastDate"
            :label="t('expenseTracker.entry.date')"
            :rules="[(value) => Boolean(value) || t('expenseTracker.validation.date')]"
          />

          <OwnershipEditor
            v-if="members.length > 1"
            v-model="ownership"
            :members="members"
            @validity="ownershipValid = $event"
          />

          <q-input
            v-model="notes"
            outlined
            autogrow
            type="textarea"
            :label="t('expenseTracker.entry.notes')"
          />
        </q-card-section>

        <q-card-actions align="right" class="entry-actions">
          <q-btn flat no-caps :label="t('common.cancel')" v-close-popup />
          <q-btn
            type="submit"
            unelevated
            no-caps
            color="primary"
            :label="t('common.save')"
            :loading="saving"
            :disable="!valid"
          />
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
.entry-card {
  width: min(34rem, calc(100vw - 2rem));
  max-height: calc(100dvh - 2rem);
  overflow: auto;
}

.entry-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.entry-heading h2 {
  margin: 0;
}

.entry-fields {
  display: grid;
  gap: 1rem;
}

.quick-amounts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-top: -0.65rem;
}

.entry-actions {
  padding: 0.75rem 1rem 1rem;
}
</style>
