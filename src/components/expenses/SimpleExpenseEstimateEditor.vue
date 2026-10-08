<template>
  <button
    type="button"
    class="estimate-button"
    :disabled="disabled"
    :aria-label="t('expenses.quickEdit.label', { value: formattedValue })"
    @click="open"
  >
    <strong>{{ formattedValue }}</strong>
    <small>/ {{ frequencyLabel }}</small>
  </button>

  <q-dialog v-model="dialog">
    <q-card class="estimate-dialog">
      <q-card-section>
        <h2>{{ t('expenses.quickEdit.title') }}</h2>
        <div class="estimate-fields">
          <q-input
            v-model.number="amount"
            type="number"
            min="0"
            step="0.01"
            outlined
            :label="t('expenses.form.amount')"
            prefix="€"
            autofocus
          />
          <q-select
            v-model="frequency"
            outlined
            emit-value
            map-options
            :label="t('expenses.form.frequency')"
            :options="frequencyOptions"
          />
        </div>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat no-caps :label="t('common.cancel')" v-close-popup />
        <q-btn
          unelevated
          no-caps
          color="primary"
          :label="t('common.save')"
          :loading="saving"
          :disable="!valid"
          @click="save"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  expenseFrequencies,
  normalizeExpenseEstimate,
} from '@/domain/financial/expense-calculations'
import { formatCurrency } from '@/utils/formatters'

const props = defineProps({
  estimate: { type: Object, required: true },
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
const frequencyOptions = computed(() =>
  expenseFrequencies.map((value) => ({ value, label: t(`expenses.frequencies.${value}`) })),
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
  width: min(32rem, calc(100vw - 2rem));
}

.estimate-dialog h2 {
  margin: 0 0 1rem;
}

.estimate-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

@media (max-width: 499px) {
  .estimate-fields {
    grid-template-columns: 1fr;
  }
}
</style>
