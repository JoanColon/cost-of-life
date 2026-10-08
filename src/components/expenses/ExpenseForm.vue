<template>
  <q-card class="expense-form-card">
    <q-form @submit.prevent="submit">
      <q-card-section>
        <div class="form-heading">
          <div>
            <span>{{ t(category.nameKey) }}</span>
            <h2>{{ expense ? t('expenses.form.editTitle') : t('expenses.form.addTitle') }}</h2>
          </div>
          <q-btn
            flat
            round
            dense
            icon="close"
            :aria-label="t('common.cancel')"
            @click="$emit('cancel')"
          />
        </div>

        <q-select
          v-model="expenseType"
          outlined
          emit-value
          map-options
          :label="t('expenses.form.suggestion')"
          :options="suggestionOptions"
          :rules="[(value) => Boolean(value) || t('expenses.validation.typeRequired')]"
          class="form-field"
          @update:model-value="applySuggestion"
        />
        <q-input
          v-model="name"
          outlined
          :label="t('expenses.form.name')"
          :rules="[(value) => Boolean(value?.trim()) || t('expenses.validation.nameRequired')]"
          class="form-field"
        />

        <div class="form-grid">
          <q-input
            v-model.number="amount"
            type="number"
            min="0"
            step="0.01"
            outlined
            prefix="€"
            :label="t('expenses.form.amount')"
            :rules="[(value) => value >= 0 || t('expenses.validation.amount')]"
          />
          <q-select
            v-model="frequency"
            outlined
            emit-value
            map-options
            :label="t('expenses.form.frequency')"
            :options="frequencyOptions"
          />
          <q-select
            v-model="variability"
            outlined
            emit-value
            map-options
            :label="t('expenses.form.variability')"
            :options="variabilityOptions"
          />
          <q-select
            v-model="recurrence"
            outlined
            emit-value
            map-options
            :label="t('expenses.form.recurrence')"
            :options="recurrenceOptions"
          />
          <q-select
            v-model="necessity"
            outlined
            clearable
            emit-value
            map-options
            :label="t('expenses.form.necessity')"
            :hint="t('expenses.form.necessityHint')"
            :options="necessityOptions"
            class="full-width"
          />
        </div>

        <div v-if="breakdown" class="calculation-preview">
          <span>{{ t('expenses.form.normalizedCost') }}</span>
          <strong>{{ formatCurrency(breakdown.annual) }} / {{ t('dashboard.year') }}</strong>
          <small>{{ formatCurrency(breakdown.monthly) }} / {{ t('dashboard.month') }}</small>
        </div>

        <div class="ownership-section">
          <h3>{{ t('expenses.ownership.label') }}</h3>
          <OwnershipEditor
            v-model="ownership"
            :members="members"
            @validity="ownershipValid = $event"
          />
        </div>
      </q-card-section>

      <q-card-actions align="between">
        <q-btn
          v-if="expense"
          flat
          no-caps
          color="negative"
          :label="t('common.delete')"
          @click="$emit('delete')"
        />
        <span v-else />
        <div>
          <q-btn flat no-caps :label="t('common.cancel')" @click="$emit('cancel')" />
          <q-btn
            type="submit"
            unelevated
            no-caps
            color="primary"
            :label="t('common.save')"
            :loading="saving"
            :disable="!formValid"
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
  expenseFrequencies,
  expenseNecessities,
  expenseRecurrences,
  expenseVariabilities,
  annualExpenseValue,
  monthlyExpenseValue,
  normalizeExpenseAttributes,
  normalizeExpenseEstimate,
} from '@/domain/financial/expense-calculations'
import {
  cloneOwnership,
  createEqualOwnership,
  isValidOwnership,
} from '@/domain/financial/ownership'
import { formatCurrency } from '@/utils/formatters'

const props = defineProps({
  category: { type: Object, required: true },
  expense: { type: Object, default: null },
  defaults: { type: Object, default: null },
  members: { type: Array, required: true },
  saving: Boolean,
})
const emit = defineEmits(['save', 'cancel', 'delete'])
const { t } = useI18n()
const expenseType = ref(null)
const name = ref('')
const amount = ref(0)
const frequency = ref('monthly')
const variability = ref('fixed')
const recurrence = ref('recurring')
const necessity = ref(null)
const ownership = ref(createEqualOwnership(props.members.map((member) => member.id)))
const ownershipValid = ref(true)

const option = (namespace) => (value) => ({ value, label: t(`expenses.${namespace}.${value}`) })
const frequencyOptions = computed(() => expenseFrequencies.map(option('frequencies')))
const variabilityOptions = computed(() => expenseVariabilities.map(option('variabilities')))
const recurrenceOptions = computed(() => expenseRecurrences.map(option('recurrences')))
const necessityOptions = computed(() => expenseNecessities.map(option('necessities')))
const suggestionOptions = computed(() => [
  ...props.category.suggestions.map((item) => ({ value: item.id, label: t(item.nameKey) })),
  { value: 'other', label: t('expenses.suggestions.other') },
])
const normalizedEstimate = computed(() =>
  normalizeExpenseEstimate({ amount: amount.value, frequency: frequency.value }),
)
const normalizedAttributes = computed(() =>
  normalizeExpenseAttributes({
    variability: variability.value,
    recurrence: recurrence.value,
    necessity: necessity.value,
  }),
)
const breakdown = computed(() =>
  normalizedEstimate.value
    ? {
        annual: annualExpenseValue(normalizedEstimate.value),
        monthly: monthlyExpenseValue(normalizedEstimate.value),
      }
    : null,
)
const formValid = computed(
  () =>
    Boolean(expenseType.value) &&
    Boolean(name.value.trim()) &&
    Boolean(normalizedEstimate.value) &&
    Boolean(normalizedAttributes.value) &&
    ownershipValid.value,
)

watch(() => [props.expense, props.defaults], seed, { immediate: true, deep: true })

function seed() {
  const initial = props.expense || props.defaults || {}
  expenseType.value = initial.type || (props.expense ? 'other' : null)
  name.value = initial.name || ''
  amount.value = initial.estimate?.amount ?? 0
  frequency.value = initial.estimate?.frequency || 'monthly'
  variability.value = initial.variability || 'fixed'
  recurrence.value = initial.recurrence || 'recurring'
  necessity.value = initial.necessity ?? null
  ownership.value = initial.ownership
    ? cloneOwnership(initial.ownership)
    : createEqualOwnership(props.members.map((member) => member.id))
  ownershipValid.value = isValidOwnership(
    ownership.value,
    props.members.map((member) => member.id),
  )
}

function applySuggestion(value) {
  const suggestion = props.category.suggestions.find((item) => item.id === value)
  if (suggestion) {
    frequency.value = suggestion.defaults.frequency
    variability.value = suggestion.defaults.variability
    recurrence.value = suggestion.defaults.recurrence
    necessity.value = suggestion.defaults.necessity
    return
  }

  if (value === 'other') {
    frequency.value = 'monthly'
    variability.value = 'fixed'
    recurrence.value = 'recurring'
    necessity.value = null
  }
}

function submit() {
  if (!formValid.value) return
  emit('save', {
    category: props.category.id,
    type: expenseType.value,
    name: name.value.trim(),
    estimate: normalizedEstimate.value,
    ...normalizedAttributes.value,
    ownership: cloneOwnership(ownership.value),
  })
}
</script>

<style scoped lang="scss">
.expense-form-card {
  width: min(46rem, calc(100vw - 2rem));
  max-height: calc(100vh - 2rem);
  overflow: auto;
}

.form-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.form-heading span {
  color: var(--color-primary);
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
}

.form-heading h2 {
  margin: 0.2rem 0 1.25rem;
}

.form-field {
  margin-bottom: 0.85rem;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
}

.full-width {
  grid-column: 1 / -1;
}

.calculation-preview {
  display: grid;
  margin-top: 1rem;
  padding: 1rem;
  border-radius: var(--radius-md);
  background: #f1fbf7;
}

.calculation-preview span,
.calculation-preview small {
  color: var(--color-copy);
}

.calculation-preview strong {
  margin-top: 0.25rem;
  font-size: 1.2rem;
}

.ownership-section {
  margin-top: 1.25rem;
}

.ownership-section h3 {
  margin: 0 0 0.75rem;
}

@media (max-width: 599px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .full-width {
    grid-column: auto;
  }
}
</style>
