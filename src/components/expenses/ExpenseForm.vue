<template>
  <q-card class="expense-form-card">
    <q-form class="dialog-layout" @submit.prevent="submit">
      <q-card-section class="form-header">
        <h2>{{ expense ? t('expenses.form.editTitle') : t('expenses.form.addTitle') }}</h2>
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
        <div class="dialog-field">
          <label>{{ t('expenses.form.subcategory') }}</label>
          <q-select
            v-model="subcategoryId"
            outlined
            :dense="$q.screen.lt.sm"
            hide-bottom-space
            emit-value
            map-options
            :options="subcategoryOptions"
            :disable="Boolean(expense)"
            :rules="[(value) => Boolean(value) || t('expenses.validation.typeRequired')]"
            @update:model-value="applySuggestion"
          >
            <template #prepend>
              <q-icon :name="suggestionIcon" />
            </template>
          </q-select>
        </div>

        <div class="dialog-field">
          <label>{{ t('expenses.form.itemName') }}</label>
          <q-input
            v-model="itemName"
            outlined
            :dense="$q.screen.lt.sm"
            hide-bottom-space
            :rules="[
              (value) => Boolean(value?.trim()) || t('expenses.validation.itemNameRequired'),
            ]"
          />
        </div>

        <div class="dialog-field">
          <label>{{ t('expenses.form.notes') }}</label>
          <q-input
            v-model="notes"
            outlined
            :dense="$q.screen.lt.sm"
            hide-bottom-space
            autogrow
            type="textarea"
            :placeholder="t('expenses.form.notesPlaceholder')"
          />
        </div>

        <div class="form-grid">
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
              :rules="[(value) => value >= 0 || t('expenses.validation.amount')]"
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

        <q-expansion-item
          icon="tune"
          :label="t('expenses.form.advancedOptions')"
          class="advanced-options"
        >
          <div class="form-grid">
            <div class="dialog-field">
              <label>{{ t('expenses.form.variability') }}</label>
              <q-select
                v-model="variability"
                outlined
                :dense="$q.screen.lt.sm"
                hide-bottom-space
                emit-value
                map-options
                :options="variabilityOptions"
              />
            </div>
            <div class="dialog-field">
              <label>{{ t('expenses.form.recurrence') }}</label>
              <q-select
                v-model="recurrence"
                outlined
                :dense="$q.screen.lt.sm"
                hide-bottom-space
                emit-value
                map-options
                :options="recurrenceOptions"
              />
            </div>
            <div class="dialog-field full-width">
              <label>{{ t('expenses.form.necessity') }}</label>
              <q-select
                v-model="necessity"
                outlined
                :dense="$q.screen.lt.sm"
                hide-bottom-space
                clearable
                emit-value
                map-options
                :options="necessityOptions"
              />
              <p class="field-hint">{{ t('expenses.form.necessityHint') }}</p>
            </div>
          </div>
        </q-expansion-item>

        <q-expansion-item
          v-if="monthlyAmounts"
          icon="calendar_month"
          :label="t('expenses.form.yearBreakdown')"
          class="year-breakdown"
        >
          <q-markup-table flat bordered dense class="monthly-schedule">
            <thead>
              <tr>
                <th class="text-left">{{ t('income.form.month') }}</th>
                <th class="text-right">{{ t('expenses.form.modelAmount') }}</th>
                <th class="text-right">
                  {{ t('expenses.form.actualAmount') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="month in incomeMonths" :key="month">
                <td>{{ t(`income.months.${month}`) }}</td>
                <td class="model-amount-cell">
                  <q-btn
                    flat
                    dense
                    no-caps
                    class="model-amount-value"
                    :label="formatCurrency(monthAmount(month))"
                    :aria-label="
                      t('expenses.form.editMonth', { month: t(`income.months.${month}`) })
                    "
                  >
                    <q-popup-edit
                      :model-value="monthlyAmounts[month]"
                      buttons
                      :label-set="t('common.save')"
                      :label-cancel="t('common.cancel')"
                      @save="setMonthAmount(month, $event)"
                    >
                      <template #default="scope">
                        <q-input
                          v-model="scope.value"
                          autofocus
                          dense
                          type="number"
                          min="0"
                          step="0.01"
                          prefix="€"
                          :label="
                            t('expenses.form.amountForMonth', {
                              month: t(`income.months.${month}`),
                            })
                          "
                          @keyup.enter="scope.set"
                        />
                      </template>
                    </q-popup-edit>
                  </q-btn>
                </td>
                <td class="text-right actual-amount">
                  {{ actualAmount(month) == null ? '—' : formatCurrency(actualAmount(month)) }}
                </td>
              </tr>
            </tbody>
          </q-markup-table>
        </q-expansion-item>

        <div v-if="members.length > 1" class="ownership-section">
          <h3>{{ t('expenses.ownership.label') }}</h3>
          <OwnershipEditor
            v-model="ownership"
            :members="members"
            hide-label
            @validity="ownershipValid = $event"
          />
        </div>
      </q-card-section>

      <q-card-actions class="form-actions">
        <q-btn
          v-if="expense"
          flat
          no-caps
          color="negative"
          icon="delete_outline"
          :label="t('common.delete')"
          @click="$emit('delete')"
        />
        <div class="primary-actions">
          <q-btn outline no-caps :label="t('common.cancel')" @click="$emit('cancel')" />
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
import { expenseTrackingCategories } from '@/config/expense-tracking-categories'
import {
  expenseNecessities,
  expenseRecurrences,
  expenseVariabilities,
  generateMonthlyExpenseAmounts,
  normalizeExpenseAttributes,
  normalizeExpenseEstimate,
  normalizeMonthlyExpenseAmounts,
  expenseFrequencies,
  updateMonthlyExpenseAmounts,
} from '@/domain/financial/expense-calculations'
import { incomeMonths } from '@/domain/financial/income-calculations'
import { normalizeNonNegativeMoney } from '@/domain/financial/money'
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
  financialYear: { type: Object, default: null },
  saving: Boolean,
})
const emit = defineEmits(['save', 'cancel', 'delete'])
const { t } = useI18n()
const subcategoryId = ref(null)
const itemName = ref('')
const notes = ref('')
const amount = ref(0)
const frequency = ref('monthly')
const variability = ref('fixed')
const recurrence = ref('recurring')
const necessity = ref(null)
const ownership = ref(createEqualOwnership(props.members.map((member) => member.id)))
const ownershipValid = ref(true)
const monthlyAmounts = ref(null)
let seeding = false

const option = (namespace) => (value) => ({ value, label: t(`expenses.${namespace}.${value}`) })
const frequencyOptions = computed(() => expenseFrequencies.map(option('frequencies')))
const variabilityOptions = computed(() => expenseVariabilities.map(option('variabilities')))
const recurrenceOptions = computed(() => expenseRecurrences.map(option('recurrences')))
const necessityOptions = computed(() => expenseNecessities.map(option('necessities')))
const subcategoryOptions = computed(() =>
  props.category.suggestions.map((item) => ({ value: item.id, label: t(item.nameKey) })),
)
const suggestionIcon = computed(
  () =>
    expenseTrackingCategories.find(({ id }) => id === subcategoryId.value)?.icon ||
    props.category.icon ||
    'category',
)
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
const formValid = computed(
  () =>
    Boolean(subcategoryId.value) &&
    Boolean(itemName.value.trim()) &&
    Boolean(normalizedEstimate.value) &&
    ownershipValid.value,
)

watch(
  [amount, frequency],
  ([nextAmount, nextFrequency], [previousAmount, previousFrequency]) => {
    if (seeding) return
    monthlyAmounts.value = updateMonthlyExpenseAmounts(
      monthlyAmounts.value,
      { amount: previousAmount, frequency: previousFrequency },
      { amount: nextAmount, frequency: nextFrequency },
    )
  },
  { flush: 'sync' },
)
watch(() => [props.expense, props.defaults], seed, { immediate: true, deep: true })

function seed() {
  seeding = true
  const initial = props.expense || props.defaults || {}
  subcategoryId.value = initial.subcategoryId || subcategoryOptions.value[0]?.value || null
  const suggestion = props.category.suggestions.find(({ id }) => id === subcategoryId.value)
  itemName.value = initial.itemName || ''
  notes.value = initial.notes || ''
  amount.value = initial.estimate?.amount ?? 0
  frequency.value = initial.estimate?.frequency || suggestion?.defaults.frequency || 'monthly'
  monthlyAmounts.value =
    normalizeMonthlyExpenseAmounts(initial.monthlyAmounts) ||
    generateMonthlyExpenseAmounts(initial.estimate || { amount: 0, frequency: frequency.value })
  variability.value = initial.variability || suggestion?.defaults.variability || 'fixed'
  recurrence.value = initial.recurrence || suggestion?.defaults.recurrence || 'recurring'
  necessity.value = initial.necessity ?? suggestion?.defaults.necessity ?? null
  ownership.value = initial.ownership
    ? cloneOwnership(initial.ownership)
    : createEqualOwnership(props.members.map((member) => member.id))
  ownershipValid.value = isValidOwnership(
    ownership.value,
    props.members.map((member) => member.id),
  )
  seeding = false
}

function monthAmount(month) {
  return normalizeNonNegativeMoney(monthlyAmounts.value?.[month]) || 0
}

function actualAmount(month) {
  return financialYearMonthExpense(month)?.actual ?? null
}

function financialYearMonthExpense(month) {
  const monthNumber = incomeMonths.indexOf(month) + 1
  if (monthNumber < 1 || !props.expense?.id) return null
  const monthKey = String(monthNumber).padStart(2, '0')
  return (
    props.financialYear?.months?.[monthKey]?.expenses?.categories?.[props.category.id]
      ?.subcategories?.[subcategoryId.value]?.items?.[props.expense.id] || null
  )
}

function setMonthAmount(month, value) {
  const normalized = normalizeNonNegativeMoney(value)
  if (normalized === null) return
  monthlyAmounts.value = { ...monthlyAmounts.value, [month]: normalized }
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
    categoryId: props.category.id,
    subcategoryId: subcategoryId.value,
    itemName: itemName.value.trim(),
    notes: notes.value.trim(),
    estimate: normalizedEstimate.value,
    monthlyAmounts: normalizeMonthlyExpenseAmounts(monthlyAmounts.value),
    ...normalizedAttributes.value,
    ownership: cloneOwnership(ownership.value),
  })
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;

.expense-form-card {
  @include financial-dialog-card(46rem);
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

.dialog-field {
  @include financial-dialog-field;
}

.field-hint {
  @include financial-dialog-hint;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
}

.form-grid .dialog-field {
  margin-bottom: 0;
}

.full-width {
  grid-column: 1 / -1;
}

.monthly-schedule {
  margin-top: 0.5rem;
  overflow: visible;
}

.year-breakdown {
  margin-top: 1rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.advanced-options {
  margin-top: 0.95rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface-soft);
  overflow: hidden;
}

.advanced-options :deep(.q-expansion-item__content),
.year-breakdown :deep(.q-expansion-item__content) {
  padding: 0 1rem 1rem;
}

.advanced-options :deep(.q-item),
.year-breakdown :deep(.q-item) {
  min-height: 4.25rem;
  padding: 0.75rem 1rem;
  color: var(--color-ink);
  font-weight: 700;
}

.model-amount-cell {
  width: 8rem;
  text-align: right;
}

.model-amount-value {
  min-width: 6.5rem;
  color: var(--color-ink);
  font-weight: 600;
}

.model-amount-value :deep(.q-btn__content) {
  justify-content: flex-end;
  width: 100%;
}

.actual-amount {
  color: var(--color-primary);
  font-weight: 700;
}

.ownership-section {
  margin-top: 1.25rem;
}

.ownership-section h3 {
  margin: 0 0 0.75rem;
  font-size: 1rem;
  line-height: 1.2;
  white-space: nowrap;
}

.form-actions {
  @include financial-dialog-actions;
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
