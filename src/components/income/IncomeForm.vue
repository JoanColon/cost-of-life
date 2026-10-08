<template>
  <q-card class="income-form-card">
    <q-card-section class="form-header">
      <div>
        <div class="eyebrow">{{ t(category.nameKey) }}</div>
        <h2>{{ income ? t('income.form.editTitle') : t(category.addLabelKey) }}</h2>
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
    <q-card-section class="form-body">
      <q-form ref="form" class="income-form" @submit.prevent="submit">
        <q-select
          v-if="category.subtypes.length > 1"
          v-model="subtype"
          outlined
          emit-value
          map-options
          :label="t('income.form.type')"
          :options="subtypeOptions"
        />
        <q-input
          v-model.trim="name"
          outlined
          autofocus
          :label="t('income.form.name')"
          maxlength="80"
          lazy-rules
          :rules="[(value) => Boolean(value) || t('income.form.nameRequired')]"
        />
        <q-option-group
          v-if="category.id === 'employment'"
          v-model="calculationMode"
          inline
          type="radio"
          color="primary"
          :options="calculationModeOptions"
          @update:model-value="changeCalculationMode"
        />
        <q-select
          v-else
          v-model="calculationMode"
          outlined
          emit-value
          map-options
          :label="t('income.form.calculationMethod')"
          :options="calculationModeOptions"
          @update:model-value="changeCalculationMode"
        />

        <template v-if="calculationMode === 'annual_salary'">
          <q-input
            v-model="annualAmount"
            outlined
            type="number"
            min="0"
            step="0.01"
            :prefix="currencySymbol"
            :label="t('income.form.annualIncome')"
            :rules="[moneyRule]"
          />
          <q-input
            v-model="paymentsPerYear"
            outlined
            type="number"
            min="1"
            step="1"
            :label="t('income.form.paymentsPerYear')"
            :rules="[positiveIntegerRule]"
          />
        </template>

        <template v-else-if="calculationMode === 'monthly_schedule'">
          <q-input
            v-model="monthlyAmount"
            outlined
            type="number"
            min="0"
            step="0.01"
            :prefix="currencySymbol"
            :label="t('income.form.monthlyNetSalary')"
            :rules="[moneyRule]"
          />
          <q-markup-table flat bordered dense class="monthly-schedule">
            <thead>
              <tr>
                <th class="text-left">{{ t('income.form.month') }}</th>
                <th class="text-right">{{ t('income.form.monthlyNetSalary') }}</th>
                <th class="text-right">{{ t('income.form.extraPayment') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="month in incomeMonths" :key="month">
                <td>{{ t(`income.months.${month}`) }}</td>
                <td class="text-right">{{ formatCurrency(normalizedMonthlyAmount) }}</td>
                <td class="text-right">
                  <q-btn
                    flat
                    dense
                    no-caps
                    color="primary"
                    :icon="normalizedExtra(month) > 0 ? undefined : 'edit'"
                    :icon-right="normalizedExtra(month) > 0 ? 'edit' : undefined"
                    :label="
                      normalizedExtra(month) > 0
                        ? formatCurrency(normalizedExtra(month))
                        : undefined
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
                          t('income.form.extraForMonth', { month: t(`income.months.${month}`) })
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
        </template>

        <template v-else-if="calculationMode === 'recurring'">
          <div class="amount-frequency">
            <q-input
              v-model="recurringAmount"
              outlined
              type="number"
              min="0"
              step="0.01"
              :prefix="currencySymbol"
              :label="t('income.form.amount')"
              :rules="[moneyRule]"
            />
            <q-select
              v-model="frequency"
              outlined
              emit-value
              map-options
              :label="t('income.form.frequency')"
              :options="frequencyOptions"
            />
          </div>
        </template>

        <q-input
          v-else
          v-model="oneTimeAmount"
          outlined
          type="number"
          min="0"
          step="0.01"
          :prefix="currencySymbol"
          :label="t('income.form.oneTimeAmount')"
          :rules="[moneyRule]"
        />

        <div v-if="breakdown" class="calculation-preview">
          <div>
            <span>{{ t('income.form.annualTotal') }}</span
            ><strong>{{ formatCurrency(breakdown.annualValue) }}</strong>
          </div>
          <div v-if="breakdown.perPayment != null">
            <span>{{ t('income.form.perPayment') }}</span
            ><strong>{{ formatCurrency(breakdown.perPayment) }}</strong>
          </div>
          <div>
            <span>{{ t('income.form.monthlyAverage') }}</span
            ><strong>{{ formatCurrency(breakdown.monthlyAverage) }}</strong>
          </div>
        </div>

        <OwnershipEditor
          v-model="ownership"
          :members="members"
          @validity="ownershipValid = $event"
        />
        <div class="form-actions">
          <q-btn
            v-if="income"
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
              :label="income ? t('common.save') : t('common.add')"
              :loading="saving || submitting"
              :disable="!ownershipValid || !calculationValid || saving || submitting"
              @click="submit"
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
import OwnershipEditor from '@/components/financial/OwnershipEditor.vue'
import {
  incomeMonths,
  incomeCalculationBreakdown,
  normalizeIncomeCalculation,
  recurringIncomeFrequencies,
} from '@/domain/financial/income-calculations'
import { normalizeMoney } from '@/domain/financial/money'
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
  saving: { type: Boolean, default: false },
})
const emit = defineEmits(['save', 'cancel', 'delete'])
const { t } = useI18n()
const form = ref(null)
const subtype = ref('')
const name = ref('')
const calculationMode = ref('recurring')
const annualAmount = ref('')
const paymentsPerYear = ref(12)
const monthlyAmount = ref('')
const extrasByMonth = ref(createEmptyExtras())
const recurringAmount = ref('')
const frequency = ref('monthly')
const oneTimeAmount = ref('')
const ownership = ref(createEqualOwnership(props.members.map((member) => member.id)))
const ownershipValid = ref(true)
const submitting = ref(false)
const lastAnnualValue = ref(0)

const subtypeOptions = computed(() =>
  props.category.subtypes.map((value) => ({ value, label: t(`income.subtypes.${value}`) })),
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
  if (calculationMode.value === 'one_time') return { mode: 'one_time', amount: oneTimeAmount.value }
  return { mode: 'recurring', amount: recurringAmount.value, frequency: frequency.value }
})
const normalizedCalculation = computed(() => normalizeIncomeCalculation(calculation.value))
const calculationValid = computed(() => Boolean(normalizedCalculation.value))
const breakdown = computed(() => incomeCalculationBreakdown(calculation.value))
const normalizedMonthlyAmount = computed(() => normalizeMoney(monthlyAmount.value) || 0)

watch(breakdown, (value) => {
  if (value) lastAnnualValue.value = value.annualValue
})
watch(() => [props.income, props.defaults, props.category.id], reset, { immediate: true })
watch(
  () => props.saving,
  (saving) => {
    if (!saving) submitting.value = false
  },
)

function reset() {
  const initial = props.income || props.defaults
  subtype.value = initial?.subtype || props.category.subtypes[0]
  name.value = initial?.name || ''
  ownership.value = initial?.ownership
    ? cloneOwnership(initial.ownership)
    : createEqualOwnership(props.members.map((member) => member.id))
  ownershipValid.value = isValidOwnership(
    ownership.value,
    props.members.map((member) => member.id),
  )
  setCalculation(initial?.calculation || defaultCalculation(props.category.calculationModes[0], 0))
}

function setCalculation(value) {
  calculationMode.value = value.mode
  if (value.mode === 'annual_salary') {
    annualAmount.value = value.annualAmount
    paymentsPerYear.value = value.paymentsPerYear
  } else if (value.mode === 'monthly_schedule') {
    monthlyAmount.value = value.monthlyAmount
    extrasByMonth.value = { ...createEmptyExtras(), ...value.extrasByMonth }
  } else if (value.mode === 'one_time') oneTimeAmount.value = value.amount
  else {
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
      monthlyAmount: normalizeMoney(annualSeed / 12) || 0,
      extrasByMonth: {},
    }
  if (mode === 'one_time') return { mode, amount: annualSeed }
  return { mode: 'recurring', amount: annualSeed, frequency: 'yearly' }
}

const moneyRule = (value) => normalizeMoney(value) !== null || t('income.form.valueInvalid')
const positiveIntegerRule = (value) =>
  (Number.isInteger(Number(value)) && Number(value) > 0) || t('income.form.integerInvalid')
function normalizedExtra(month) {
  return normalizeMoney(extrasByMonth.value[month]) || 0
}

function createEmptyExtras() {
  return Object.fromEntries(incomeMonths.map((month) => [month, 0]))
}

async function submit() {
  if (props.saving || submitting.value) return
  const formIsValid = await form.value?.validate()
  if (!formIsValid || !name.value || !normalizedCalculation.value || !ownershipValid.value) return
  submitting.value = true
  emit('save', {
    category: props.category.id,
    subtype: subtype.value,
    name: name.value,
    calculation: normalizedCalculation.value,
    ownership: cloneOwnership(ownership.value),
  })
}
</script>

<style scoped lang="scss">
.income-form-card {
  width: min(38rem, calc(100vw - 2rem));
  border-radius: var(--radius-card);
}
.form-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 0.5rem;
}
.form-body {
  padding-top: 0;
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
.income-form {
  display: grid;
  gap: 0.75rem;
}
.amount-frequency {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}
.monthly-schedule {
  overflow: visible;
}
.calculation-preview {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  padding: 1rem;
  border-radius: 0.8rem;
  background: var(--color-green-soft);
}
.calculation-preview span,
.calculation-preview strong {
  display: block;
}
.calculation-preview span {
  color: var(--color-copy);
  font-size: 0.72rem;
}
.calculation-preview strong {
  margin-top: 0.2rem;
  color: var(--color-success-dark);
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
@media (max-width: 520px) {
  .amount-frequency,
  .calculation-preview {
    grid-template-columns: 1fr;
  }
}
</style>
