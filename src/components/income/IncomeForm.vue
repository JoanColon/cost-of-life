<template>
  <q-card class="income-form-card">
    <q-form class="dialog-layout" @submit.prevent="submit">
      <q-card-section class="form-header">
        <h2>{{ income ? t('income.form.editTitle') : t(category.addLabelKey) }}</h2>
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
        <div class="income-form">
          <div class="dialog-field">
            <label>{{ t('income.form.subcategory') }}</label>
            <q-select
              v-model="subcategoryId"
              outlined
              :dense="$q.screen.lt.sm"
              hide-bottom-space
              emit-value
              map-options
              :options="subcategoryOptions"
              :disable="Boolean(income)"
            >
              <template #prepend><q-icon :name="category.icon" /></template>
            </q-select>
          </div>
          <div class="dialog-field">
            <label>{{ t('income.form.itemName') }}</label>
            <q-input
              v-model.trim="itemName"
              outlined
              :dense="$q.screen.lt.sm"
              hide-bottom-space
              autofocus
              maxlength="80"
            />
          </div>
          <div v-if="isDividendIncome" class="dialog-field">
            <label>{{ t('income.form.linkPortfolio') }}</label>
            <q-select
              v-model="linkedPortfolioId"
              outlined
              clearable
              :dense="$q.screen.lt.sm"
              emit-value
              map-options
              :options="portfolioOptions"
              :hint="
                portfolioOptions.length
                  ? t('income.form.linkPortfolioHint')
                  : t('income.form.noPortfolios')
              "
              @update:model-value="applyLinkedPortfolio"
            >
              <template #prepend><q-icon name="account_balance_wallet" /></template>
            </q-select>
          </div>
          <div class="dialog-field">
            <label>{{ t('income.form.notes') }}</label>
            <q-input
              v-model="notes"
              outlined
              :dense="$q.screen.lt.sm"
              hide-bottom-space
              autogrow
              type="textarea"
              :placeholder="t('income.form.notesPlaceholder')"
            />
          </div>
          <div class="dialog-field calculation-method">
            <label>{{ t('income.form.calculationMethod') }}</label>
            <q-option-group
              v-if="category.id === 'employment'"
              v-model="calculationMode"
              inline
              :dense="$q.screen.lt.sm"
              type="radio"
              color="primary"
              :options="calculationModeOptions"
              :disable="Boolean(linkedPortfolioId)"
              @update:model-value="changeCalculationMode"
            />
            <q-select
              v-else
              v-model="calculationMode"
              outlined
              :dense="$q.screen.lt.sm"
              hide-bottom-space
              emit-value
              map-options
              :options="calculationModeOptions"
              :disable="Boolean(linkedPortfolioId)"
              @update:model-value="changeCalculationMode"
            />
          </div>

          <template v-if="calculationMode === 'annual_salary'">
            <div class="amount-frequency">
              <div class="dialog-field">
                <label>{{ t('income.form.annualIncome') }}</label>
                <q-input
                  v-model="annualAmount"
                  outlined
                  :dense="$q.screen.lt.sm"
                  hide-bottom-space
                  type="number"
                  min="0"
                  step="0.01"
                  :prefix="currencySymbol"
                  :disable="Boolean(linkedPortfolioId)"
                  :rules="[moneyRule]"
                />
              </div>
              <div class="dialog-field">
                <label>{{ t('income.form.paymentsPerYear') }}</label>
                <q-input
                  v-model="paymentsPerYear"
                  outlined
                  :dense="$q.screen.lt.sm"
                  hide-bottom-space
                  type="number"
                  min="1"
                  step="1"
                  :rules="[positiveIntegerRule]"
                />
              </div>
            </div>
          </template>

          <template v-else-if="calculationMode === 'monthly_schedule'">
            <div class="dialog-field">
              <label>{{ t('income.form.monthlyNetSalary') }}</label>
              <q-input
                v-model="monthlyAmount"
                outlined
                :dense="$q.screen.lt.sm"
                hide-bottom-space
                type="number"
                min="0"
                step="0.01"
                :prefix="currencySymbol"
                :rules="[moneyRule]"
              />
            </div>
            <q-expansion-item
              icon="calendar_month"
              :label="t('income.form.yearBreakdown')"
              class="year-breakdown"
            >
              <q-markup-table flat bordered dense class="monthly-schedule">
                <thead>
                  <tr>
                    <th class="month-column text-left">{{ t('income.form.month') }}</th>
                    <th class="salary-column text-center">
                      <span class="header-line">{{ t('income.form.monthlyNet') }}</span>
                      <span class="header-line">{{ t('income.form.salary') }}</span>
                    </th>
                    <th class="extra-column text-center">
                      <span class="header-line">{{ t('income.form.extra') }}</span>
                      <span class="header-line">{{ t('income.form.payment') }}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="month in incomeMonths" :key="month">
                    <td>{{ t(`income.months.${month}`) }}</td>
                    <td class="text-right">{{ formatCurrency(normalizedMonthlyAmount) }}</td>
                    <td class="extra-payment-cell">
                      <q-btn
                        flat
                        dense
                        no-caps
                        class="extra-payment-value"
                        :class="{ empty: normalizedExtra(month) === 0 }"
                        :label="
                          normalizedExtra(month) > 0 ? formatCurrency(normalizedExtra(month)) : '—'
                        "
                        :aria-label="
                          t('income.form.extraForMonth', {
                            month: t(`income.months.${month}`),
                          })
                        "
                      >
                        <q-popup-edit
                          v-model="extrasByMonth[month]"
                          buttons
                          :label-set="t('common.save')"
                          :label-cancel="t('common.cancel')"
                          #default="scope"
                        >
                          <q-input
                            v-model="scope.value"
                            autofocus
                            dense
                            type="number"
                            min="0"
                            step="0.01"
                            :prefix="currencySymbol"
                            :label="
                              t('income.form.extraForMonth', {
                                month: t(`income.months.${month}`),
                              })
                            "
                            :rules="[moneyRule]"
                            @keyup.enter="scope.set"
                          />
                        </q-popup-edit>
                      </q-btn>
                    </td>
                  </tr>
                </tbody>
              </q-markup-table>
            </q-expansion-item>
          </template>

          <template v-else-if="calculationMode === 'recurring'">
            <div class="amount-frequency">
              <div class="dialog-field">
                <label>{{ t('income.form.amount') }}</label>
                <q-input
                  v-model="recurringAmount"
                  outlined
                  :dense="$q.screen.lt.sm"
                  hide-bottom-space
                  type="number"
                  min="0"
                  step="0.01"
                  :prefix="currencySymbol"
                  :disable="Boolean(linkedPortfolioId)"
                  :rules="[moneyRule]"
                />
              </div>
              <div class="dialog-field">
                <label>{{ t('income.form.frequency') }}</label>
                <q-select
                  v-model="frequency"
                  outlined
                  :dense="$q.screen.lt.sm"
                  hide-bottom-space
                  emit-value
                  map-options
                  :options="frequencyOptions"
                  :disable="Boolean(linkedPortfolioId)"
                />
              </div>
            </div>
          </template>

          <div v-else class="amount-frequency">
            <div class="dialog-field">
              <label>{{ t('income.form.oneTimeAmount') }}</label>
              <q-input
                v-model="oneTimeAmount"
                outlined
                :dense="$q.screen.lt.sm"
                hide-bottom-space
                type="number"
                min="0"
                step="0.01"
                :prefix="currencySymbol"
                :rules="[moneyRule]"
              />
            </div>
            <div class="dialog-field">
              <label>{{ t('income.form.recognitionMonth') }}</label>
              <q-select
                v-model="oneTimeMonth"
                outlined
                :dense="$q.screen.lt.sm"
                hide-bottom-space
                emit-value
                map-options
                :options="monthOptions"
              />
            </div>
          </div>

          <div v-if="members.length > 1" class="ownership-section">
            <h3>{{ t('income.ownership.label') }}</h3>
            <OwnershipEditor
              v-model="ownership"
              :members="members"
              hide-label
              @validity="ownershipValid = $event"
            />
          </div>
        </div>
      </q-card-section>

      <q-card-actions class="form-actions">
        <q-btn
          v-if="income"
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
            outline
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
  incomeMonths,
  incomeCalculationBreakdown,
  normalizeIncomeCalculation,
  recurringIncomeFrequencies,
} from '@/domain/financial/income-calculations'
import { normalizeNonNegativeMoney } from '@/domain/financial/money'
import {
  cloneOwnership,
  createEqualOwnership,
  isValidOwnership,
} from '@/domain/financial/ownership'
import { currencySymbol, formatCurrency } from '@/utils/formatters'

const props = defineProps({
  category: { type: Object, required: true },
  income: { type: Object, default: null },
  defaults: { type: Object, default: null },
  members: { type: Array, required: true },
  portfolios: { type: Array, default: () => [] },
  saving: { type: Boolean, default: false },
})
const emit = defineEmits(['save', 'cancel', 'delete'])
const { t } = useI18n()
const subcategoryId = ref('')
const itemName = ref('')
const notes = ref('')
const calculationMode = ref('recurring')
const annualAmount = ref('')
const paymentsPerYear = ref(12)
const monthlyAmount = ref('')
const extrasByMonth = ref(createEmptyExtras())
const recurringAmount = ref('')
const frequency = ref('monthly')
const oneTimeAmount = ref('')
const oneTimeMonth = ref('january')
const ownership = ref(createEqualOwnership(props.members.map((member) => member.id)))
const ownershipValid = ref(true)
const lastAnnualValue = ref(0)
const linkedPortfolioId = ref(null)

const subcategoryOptions = computed(() =>
  props.category.subcategories.map((value) => ({ value, label: t(`income.subtypes.${value}`) })),
)
const calculationModeOptions = computed(() =>
  props.category.calculationModes.map((value) => ({
    value,
    label: t(`income.calculationModes.${value}`),
  })),
)
const frequencyOptions = computed(() =>
  recurringIncomeFrequencies.map((value) => ({ value, label: t(`income.frequencies.${value}`) })),
)
const monthOptions = computed(() =>
  incomeMonths.map((value) => ({ value, label: t(`income.months.${value}`) })),
)
const isDividendIncome = computed(
  () => props.category.id === 'investments' && subcategoryId.value === 'dividends',
)
const portfolioOptions = computed(() =>
  props.portfolios.map((portfolio) => ({
    label: portfolio.itemName,
    value: portfolio.id,
    disable: !Number.isFinite(Number(portfolio.annualDividendIncome)),
  })),
)
const linkedPortfolio = computed(
  () => props.portfolios.find((portfolio) => portfolio.id === linkedPortfolioId.value) || null,
)
const calculation = computed(() => {
  if (calculationMode.value === 'annual_salary')
    return {
      mode: 'annual_salary',
      annualAmount: annualAmount.value,
      paymentsPerYear: paymentsPerYear.value,
    }
  if (calculationMode.value === 'monthly_schedule')
    return {
      mode: 'monthly_schedule',
      monthlyAmount: monthlyAmount.value,
      extrasByMonth: extrasByMonth.value,
    }
  if (calculationMode.value === 'one_time') {
    return { mode: 'one_time', amount: oneTimeAmount.value, month: oneTimeMonth.value }
  }
  return { mode: 'recurring', amount: recurringAmount.value, frequency: frequency.value }
})
const normalizedCalculation = computed(() => normalizeIncomeCalculation(calculation.value))
const formValid = computed(
  () =>
    Boolean(subcategoryId.value) &&
    Boolean(itemName.value.trim()) &&
    Boolean(normalizedCalculation.value) &&
    (!linkedPortfolioId.value || Boolean(linkedPortfolio.value)) &&
    ownershipValid.value,
)
const breakdown = computed(() => incomeCalculationBreakdown(calculation.value))
const normalizedMonthlyAmount = computed(() => normalizeNonNegativeMoney(monthlyAmount.value) || 0)

watch(breakdown, (value) => {
  if (value) lastAnnualValue.value = value.annualValue
})
watch(() => [props.income, props.defaults, props.category.id], reset, { immediate: true })
watch(subcategoryId, (value) => {
  if (value !== 'dividends') linkedPortfolioId.value = null
})

function reset() {
  const initial = props.income || props.defaults
  subcategoryId.value = initial?.subcategoryId || props.category.subcategories[0]
  itemName.value = initial?.itemName || ''
  notes.value = initial?.notes || ''
  linkedPortfolioId.value = initial?.portfolioAssetId || null
  ownership.value = initial?.ownership
    ? cloneOwnership(initial.ownership)
    : createEqualOwnership(props.members.map((member) => member.id))
  ownershipValid.value = isValidOwnership(
    ownership.value,
    props.members.map((member) => member.id),
  )
  setCalculation(initial?.calculation || defaultCalculation(props.category.calculationModes[0], 0))
  if (linkedPortfolioId.value) applyLinkedPortfolio(linkedPortfolioId.value)
}

function applyLinkedPortfolio(portfolioId) {
  if (!portfolioId) return
  const portfolio = props.portfolios.find((candidate) => candidate.id === portfolioId)
  const annualDividendIncome = normalizeNonNegativeMoney(portfolio?.annualDividendIncome)
  if (!portfolio || annualDividendIncome === null) return

  calculationMode.value = 'recurring'
  recurringAmount.value = annualDividendIncome
  frequency.value = 'yearly'
  lastAnnualValue.value = annualDividendIncome
}

function setCalculation(value) {
  calculationMode.value = value.mode
  if (value.mode === 'annual_salary') {
    annualAmount.value = value.annualAmount
    paymentsPerYear.value = value.paymentsPerYear
  } else if (value.mode === 'monthly_schedule') {
    monthlyAmount.value = value.monthlyAmount
    extrasByMonth.value = { ...createEmptyExtras(), ...value.extrasByMonth }
  } else if (value.mode === 'one_time') {
    oneTimeAmount.value = value.amount
    oneTimeMonth.value = value.month || 'january'
  } else {
    recurringAmount.value = value.amount
    frequency.value = value.frequency
  }
}

function changeCalculationMode(mode) {
  setCalculation(defaultCalculation(mode, lastAnnualValue.value))
}

function defaultCalculation(mode, annualSeed) {
  if (mode === 'annual_salary') return { mode, annualAmount: annualSeed, paymentsPerYear: 12 }
  if (mode === 'monthly_schedule')
    return {
      mode,
      monthlyAmount: normalizeNonNegativeMoney(annualSeed / 12) || 0,
      extrasByMonth: {},
    }
  if (mode === 'one_time') return { mode, amount: annualSeed, month: 'january' }
  return { mode: 'recurring', amount: annualSeed, frequency: 'yearly' }
}

const moneyRule = (value) =>
  normalizeNonNegativeMoney(value) !== null || t('income.form.valueInvalid')
const positiveIntegerRule = (value) =>
  (Number.isInteger(Number(value)) && Number(value) > 0) || t('income.form.integerInvalid')
function normalizedExtra(month) {
  return normalizeNonNegativeMoney(extrasByMonth.value[month]) || 0
}

function createEmptyExtras() {
  return Object.fromEntries(incomeMonths.map((month) => [month, 0]))
}

function submit() {
  if (!formValid.value) return
  emit('save', {
    categoryId: props.category.id,
    subcategoryId: subcategoryId.value,
    itemName: itemName.value.trim(),
    notes: notes.value.trim(),
    calculation: normalizedCalculation.value,
    ownership: cloneOwnership(ownership.value),
    portfolioAssetId: isDividendIncome.value ? linkedPortfolioId.value : null,
  })
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;

.income-form-card {
  @include financial-dialog-card(42rem);
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

.income-form {
  display: grid;
  gap: 0.85rem;
}

.dialog-field {
  @include financial-dialog-field;
  margin-bottom: 0;
}

.calculation-method :deep(.q-option-group) {
  display: flex;
  min-height: 3.5rem;
  align-items: center;
  padding: 0.35rem 0.65rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-button);
}

.amount-frequency {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}
.monthly-schedule {
  margin-top: 0.5rem;
  overflow: visible;
}
.year-breakdown {
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.year-breakdown :deep(.q-item) {
  min-height: 4.25rem;
  padding: 0.75rem 1rem;
  color: var(--color-ink);
  font-weight: 700;
}

.year-breakdown :deep(.q-expansion-item__content) {
  padding: 0 1rem 1rem;
}
.extra-payment-cell {
  width: 8rem;
  text-align: right;
}
.extra-payment-value {
  min-width: 6.5rem;
  color: var(--color-ink);
  font-weight: 600;
}
.extra-payment-value.empty {
  color: var(--color-copy);
  font-weight: 400;
}
.extra-payment-value :deep(.q-btn__content) {
  justify-content: flex-end;
  width: 100%;
}
.header-line + .header-line {
  margin-left: 0.25em;
}
.ownership-section {
  margin-top: 0.4rem;
}
.ownership-section h3 {
  margin: 0 0 0.75rem;
  font-size: 1rem;
  line-height: 1.2;
}
.form-actions {
  @include financial-dialog-actions;
}
@media (max-width: 520px) {
  .calculation-method :deep(.q-option-group) {
    min-height: 2.75rem;
    padding: 0.2rem 0.4rem;
  }

  .amount-frequency {
    grid-template-columns: 1fr;
  }

  .year-breakdown :deep(.q-item) {
    padding-right: 0.75rem;
    padding-left: 0.75rem;
  }

  .year-breakdown :deep(.q-expansion-item__content) {
    padding: 0 0.65rem 0.65rem;
  }

  .monthly-schedule {
    width: 100%;
    overflow: hidden;
    font-size: 0.72rem;
  }

  .monthly-schedule :deep(table) {
    width: 100%;
    table-layout: fixed;
  }

  .monthly-schedule :deep(th),
  .monthly-schedule :deep(td) {
    height: auto;
    padding: 0.55rem 0.35rem;
  }

  .monthly-schedule :deep(th) {
    overflow-wrap: anywhere;
    line-height: 1.2;
    white-space: normal;
  }

  .header-line {
    display: block;
    margin-left: 0;
    text-align: center;
  }

  .monthly-schedule :deep(.month-column) {
    width: 29%;
  }

  .monthly-schedule :deep(.salary-column) {
    width: 35%;
  }

  .monthly-schedule :deep(.extra-column) {
    width: 36%;
  }

  .extra-payment-cell {
    width: auto;
  }

  .extra-payment-value {
    width: 100%;
    min-width: 0;
    padding: 0;
    font-size: 0.72rem;
  }
}
</style>
