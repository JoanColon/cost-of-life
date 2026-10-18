<template>
  <button
    type="button"
    class="estimate-button"
    :disabled="disabled"
    :aria-label="t('expenses.quickEdit.label', { value: shownValue })"
    @click="open"
  >
    <strong>{{ shownValue }}</strong>
    <small>/ {{ shownPeriod }}</small>
  </button>

  <q-dialog v-model="dialog">
    <q-card class="estimate-dialog">
      <div class="dialog-layout">
        <q-card-section class="estimate-heading">
          <h2>{{ t('expenses.quickEdit.title') }}</h2>
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
        <q-card-section class="estimate-body">
          <div class="estimate-fields">
            <div class="dialog-field">
              <label>{{ t('expenses.form.amount') }}</label>
              <q-input
                v-model.number="amount"
                type="number"
                min="0"
                step="0.01"
                outlined
                :dense="$q.screen.lt.sm"
                hide-bottom-space
                prefix="€"
                autofocus
              />
            </div>
            <div class="dialog-field">
              <label>{{ t('expenses.form.frequency') }}</label>
              <q-select
                v-model="frequency"
                outlined
                :dense="$q.screen.lt.sm"
                hide-bottom-space
                emit-value
                map-options
                :options="frequencyOptions"
              />
            </div>
          </div>
        </q-card-section>
        <q-card-actions class="estimate-actions">
          <div class="primary-actions">
            <q-btn outline no-caps :label="t('common.cancel')" v-close-popup />
            <q-btn
              unelevated
              no-caps
              color="primary"
              :label="t('common.save')"
              :loading="saving"
              :disable="!valid"
              @click="save"
            />
          </div>
        </q-card-actions>
      </div>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  normalizeExpenseEstimate,
  expenseFrequencies,
} from '@/domain/financial/expense-calculations'
import { formatCurrency } from '@/utils/formatters'

const props = defineProps({
  estimate: { type: Object, required: true },
  displayValue: { type: String, default: null },
  displayPeriod: { type: String, default: null },
  saving: Boolean,
  disabled: Boolean,
})
const emit = defineEmits(['save'])
const { t } = useI18n()
const dialog = ref(false)
const amount = ref(0)
const frequency = ref('monthly')
const valid = computed(() =>
  Boolean(normalizeExpenseEstimate({ amount: amount.value, frequency: frequency.value })),
)
const normalized = computed(
  () => normalizeExpenseEstimate(props.estimate) || { amount: 0, frequency: 'monthly' },
)
const formattedValue = computed(() => formatCurrency(normalized.value.amount))
const frequencyLabel = computed(() => t(`expenses.frequencies.${normalized.value.frequency}`))
const shownValue = computed(() => props.displayValue || formattedValue.value)
const shownPeriod = computed(() => props.displayPeriod || frequencyLabel.value)
const frequencyOptions = computed(() =>
  expenseFrequencies.map((value) => ({
    value,
    label: t(`expenses.frequencies.${value}`),
  })),
)

function open() {
  if (props.disabled) return
  amount.value = normalized.value.amount
  frequency.value = normalized.value.frequency
  dialog.value = true
}

function save() {
  const estimate = normalizeExpenseEstimate({ amount: amount.value, frequency: frequency.value })
  if (!estimate) return
  emit('save', estimate)
  dialog.value = false
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;

.estimate-button {
  display: grid;
  justify-items: end;
  min-width: 8.5rem;
  padding: 0.45rem 0.65rem;
  border: 0;
  border-radius: 0.65rem;
  background: transparent;
  color: var(--color-ink);
  cursor: pointer;
}

.estimate-button:hover:not(:disabled) {
  background: #f4f7f9;
}

.estimate-button:disabled {
  cursor: default;
}

.estimate-button strong {
  font-size: 1rem;
}

.estimate-button small {
  color: var(--color-muted);
}

.estimate-dialog {
  @include financial-dialog-card(32rem);
}

.dialog-layout {
  @include financial-dialog-layout;
}

.estimate-heading {
  @include financial-dialog-header;
}

.estimate-body {
  @include financial-dialog-body;
}

.estimate-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.dialog-field {
  @include financial-dialog-field;
  margin-bottom: 0;
}

.estimate-actions {
  @include financial-dialog-actions;
}

@media (max-width: 499px) {
  .estimate-fields {
    grid-template-columns: 1fr;
  }
}
</style>
