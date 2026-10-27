<template>
  <q-page class="mortgage-page">
    <main class="mortgage-shell">
      <div v-if="pageLoading" class="page-state">
        <q-spinner color="primary" size="2rem" />
        <span>{{ t('liabilities.mortgage.loading') }}</span>
      </div>

      <section v-else-if="pageError || liabilitiesStore.error" class="page-state error-state">
        <q-icon name="cloud_off" />
        <h1>{{ t('liabilities.errors.loadTitle') }}</h1>
        <p>{{ t('liabilities.errors.load') }}</p>
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon="refresh"
          :label="t('common.retry')"
          @click="prepare(true)"
        />
      </section>

      <template v-else-if="mortgage">
        <header class="mortgage-header">
          <div>
            <q-btn
              flat
              dense
              no-caps
              color="grey-7"
              icon="arrow_back"
              :label="t('liabilities.mortgage.backToMortgages')"
              :to="mortgagesRoute"
              class="back-button"
            />
            <h1>{{ mortgage.itemName }}</h1>
          </div>
          <q-btn
            v-if="configured && !editing"
            outline
            no-caps
            color="primary"
            icon="edit"
            :label="t('liabilities.mortgage.editModel')"
            @click="startEditing"
          />
        </header>

        <section v-if="!configured || editing" class="setup-card">
          <span class="setup-icon"><q-icon name="account_balance" /></span>
          <div class="setup-copy">
            <h2>
              {{
                t(configured ? 'liabilities.mortgage.editTitle' : 'liabilities.mortgage.setupTitle')
              }}
            </h2>
            <p>{{ t('liabilities.mortgage.setupDescription') }}</p>
          </div>

          <q-form ref="modelForm" class="mortgage-form" @submit.prevent="saveModel">
            <div class="field-grid">
              <div class="form-field">
                <label>{{ t('liabilities.mortgage.originalPrincipal') }}</label>
                <q-input
                  v-model="form.originalPrincipal"
                  outlined
                  type="number"
                  min="0"
                  step="0.01"
                  prefix="€"
                  lazy-rules
                  :rules="[nonNegativeMoneyRule]"
                />
              </div>
              <div class="form-field">
                <label>{{ t('liabilities.mortgage.currentBalance') }}</label>
                <q-input
                  v-model="form.currentBalance"
                  outlined
                  type="number"
                  min="0"
                  step="0.01"
                  prefix="€"
                  lazy-rules
                  :rules="[currentBalanceRule]"
                />
              </div>
              <div class="form-field">
                <label>{{ t('liabilities.mortgage.annualInterestRate') }}</label>
                <q-input
                  v-model="form.annualInterestRate"
                  outlined
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  suffix="%"
                  lazy-rules
                  :rules="[percentageRule]"
                />
              </div>
              <div class="form-field">
                <label>{{ t('liabilities.mortgage.monthlyPayment') }}</label>
                <q-input
                  v-model="form.monthlyPayment"
                  outlined
                  type="number"
                  min="0"
                  step="0.01"
                  prefix="€"
                  :hint="t('liabilities.mortgage.monthlyPaymentHint')"
                  lazy-rules
                  :rules="[optionalPositiveMoneyRule]"
                />
              </div>
              <div class="form-field">
                <label>{{ t('liabilities.mortgage.startDate') }}</label>
                <q-input
                  v-model="form.startDate"
                  outlined
                  type="date"
                  lazy-rules
                  :rules="[(value) => isIsoDate(value) || t('liabilities.mortgage.invalidDate')]"
                />
              </div>
              <div class="term-fields">
                <div class="form-field">
                  <label>{{ t('liabilities.mortgage.termYears') }}</label>
                  <q-input
                    v-model="form.termYears"
                    outlined
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    lazy-rules
                    :rules="[termPartRule]"
                  />
                </div>
                <div class="form-field">
                  <label>{{ t('liabilities.mortgage.termExtraMonths') }}</label>
                  <q-input
                    v-model="form.termExtraMonths"
                    outlined
                    type="number"
                    min="0"
                    max="11"
                    step="1"
                    lazy-rules
                    :rules="[monthPartRule]"
                  />
                </div>
              </div>
            </div>

            <div class="form-actions">
              <q-btn
                v-if="configured"
                flat
                no-caps
                :label="t('common.cancel')"
                @click="cancelEditing"
              />
              <q-btn
                unelevated
                no-caps
                color="primary"
                type="submit"
                :label="t('common.save')"
                :loading="saving"
              />
            </div>
          </q-form>
        </section>

        <template v-else-if="projection">
          <section class="mortgage-summary">
            <span class="summary-icon"><q-icon name="house_siding" /></span>
            <div>
              <span>{{ t('liabilities.mortgage.title') }}</span>
              <strong
                >{{ formatCurrency(mortgage.balance) }}
                {{ t('liabilities.mortgage.remaining') }}</strong
              >
              <p>
                {{ formatRate(mortgageModel.annualInterestRate) }}
                {{ t('liabilities.mortgage.fixed') }} ·
                {{ formatCurrency(mortgageModel.monthlyPayment)
                }}{{ t('liabilities.mortgage.perMonth') }}
              </p>
              <small
                >{{ formatDuration(projection.remainingPayments) }}
                {{ t('liabilities.mortgage.remaining') }}</small
              >
            </div>
          </section>

          <section class="next-payment-card">
            <div class="section-heading">
              <span class="section-icon"><q-icon name="calendar_month" /></span>
              <div>
                <h2>{{ t('liabilities.mortgage.nextPayment') }}</h2>
                <small v-if="projection.nextPayment">{{
                  formatMonthYear(projection.nextPayment.date)
                }}</small>
              </div>
            </div>
            <div v-if="projection.nextPayment" class="payment-values">
              <div>
                <span>{{ t('liabilities.mortgage.payment') }}</span>
                <strong>{{ formatCurrency(projection.nextPayment.payment) }}</strong>
              </div>
              <div>
                <span>{{ t('liabilities.mortgage.interest') }}</span>
                <strong>{{ formatCurrency(projection.nextPayment.interest) }}</strong>
              </div>
              <div>
                <span>{{ t('liabilities.mortgage.principal') }}</span>
                <strong>{{ formatCurrency(projection.nextPayment.principal) }}</strong>
              </div>
            </div>
            <p v-else class="paid-off">{{ t('liabilities.mortgage.paidOff') }}</p>
          </section>

          <section class="chart-card">
            <div class="chart-heading">
              <div class="section-heading">
                <span class="section-icon"><q-icon name="show_chart" /></span>
                <div>
                  <h2>{{ t('liabilities.mortgage.balanceOverTime') }}</h2>
                  <small>{{ t('liabilities.mortgage.balanceChartDescription') }}</small>
                </div>
              </div>
              <q-btn
                outline
                no-caps
                color="primary"
                icon="table_view"
                :label="t('liabilities.mortgage.viewAmortizationTable')"
                @click="amortizationDialog = true"
              />
            </div>
            <MortgageBalanceChart
              :schedule="originalSchedule"
              :starting-balance="mortgageModel.originalPrincipal"
              :start-date="mortgageModel.startDate"
              :current-date="localToday()"
              :current-balance="mortgage.balance"
              :current-label="t('liabilities.mortgage.currentMonth')"
              :aria-label="t('liabilities.mortgage.balanceChartAria')"
            />
          </section>

          <section class="faster-card">
            <div class="section-heading">
              <span class="section-icon section-icon--faster"><q-icon name="speed" /></span>
              <div>
                <h2>{{ t('liabilities.mortgage.payOffFaster') }}</h2>
                <small>{{ t('liabilities.mortgage.payOffDescription') }}</small>
              </div>
            </div>

            <div class="extra-payment-field form-field">
              <label>{{ t('liabilities.mortgage.extraMonthlyPayment') }}</label>
              <q-input
                v-model="extraMonthlyPayment"
                outlined
                type="number"
                min="0"
                step="10"
                prefix="€"
                :suffix="t('liabilities.mortgage.perMonth')"
              />
            </div>

            <div class="faster-results">
              <article>
                <span>{{ t('liabilities.mortgage.newPayoffDate') }}</span>
                <strong>{{ formatMonthYear(projection.accelerated.payoffDate) }}</strong>
              </article>
              <article>
                <span>{{ t('liabilities.mortgage.finishEarlier') }}</span>
                <strong>{{ formatDuration(projection.accelerated.monthsEarlier) }}</strong>
              </article>
              <article>
                <span>{{ t('liabilities.mortgage.interestSaved') }}</span>
                <strong>{{ formatCurrency(projection.accelerated.interestSaved) }}</strong>
              </article>
            </div>
          </section>
        </template>
      </template>
    </main>

    <q-dialog v-model="amortizationDialog" :maximized="$q.screen.lt.sm">
      <q-card class="amortization-dialog">
        <q-card-section class="amortization-dialog-header">
          <div>
            <h2>{{ t('liabilities.mortgage.amortizationTable') }}</h2>
            <p>
              {{ t('liabilities.mortgage.amortizationTableDescription') }}
            </p>
          </div>
          <q-btn flat round dense icon="close" :aria-label="t('common.close')" v-close-popup />
        </q-card-section>

        <q-card-section class="amortization-summary">
          <div>
            <span>{{ t('liabilities.mortgage.originalPrincipal') }}</span>
            <strong>{{ formatCurrency(mortgageModel?.originalPrincipal || 0) }}</strong>
          </div>
          <div>
            <span>{{ t('liabilities.mortgage.totalInterest') }}</span>
            <strong>{{ formatCurrency(originalScheduleInterest) }}</strong>
          </div>
          <div>
            <span>{{ t('liabilities.mortgage.totalPayments') }}</span>
            <strong>{{ originalSchedule.length }}</strong>
          </div>
        </q-card-section>

        <q-card-section class="amortization-table-section">
          <q-table
            v-model:pagination="amortizationPagination"
            flat
            dense
            row-key="paymentNumber"
            class="amortization-table"
            :rows="amortizationRows"
            :columns="amortizationColumns"
            :rows-per-page-options="[12]"
          />
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import MortgageBalanceChart from '@/components/liabilities/MortgageBalanceChart.vue'
import {
  buildFrenchAmortizationSchedule,
  calculateFrenchMonthlyPayment,
  calculateMortgageProjection,
  mortgageDetailFromLiability,
} from '@/domain/financial/mortgage-amortization'
import { normalizeNonNegativeMoney } from '@/domain/financial/money'
import { authUser } from '@/services/auth'
import { useLiabilitiesStore } from '@/stores/liabilities-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { formatCurrency } from '@/utils/formatters'
import { getWorkspaceMembers } from '@/utils/workspace-members'

const $q = useQuasar()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const liabilitiesStore = useLiabilitiesStore()
const workspaceStore = useWorkspaceStore()
const preparing = ref(false)
const pageError = ref(null)
const saving = ref(false)
const editing = ref(false)
const modelForm = ref(null)
const extraMonthlyPayment = ref(0)
const amortizationDialog = ref(false)
const amortizationPagination = ref({ page: 1, rowsPerPage: 12 })
const form = reactive(emptyForm())
let preparationId = 0

const workspaceId = computed(() => String(route.params.workspaceId))
const liabilityId = computed(() => String(route.params.liabilityId))
const mortgagesRoute = computed(() => ({
  name: 'liability-category',
  params: { workspaceId: workspaceId.value, category: 'mortgage' },
}))
const mortgage = computed(() =>
  liabilitiesStore.itemsForCategory('mortgage').find(({ id }) => id === liabilityId.value),
)
const mortgageModel = computed(() => mortgageDetailFromLiability(mortgage.value))
const configured = computed(() => Boolean(mortgageModel.value))
const workspace = computed(
  () => workspaceStore.workspaces.find(({ id }) => id === workspaceId.value) || null,
)
const memberIds = computed(() =>
  getWorkspaceMembers(workspace.value, authUser.value).map(({ id }) => id),
)
const projection = computed(() => {
  if (!mortgageModel.value) return null
  try {
    return calculateMortgageProjection({
      ...mortgageModel.value,
      extraMonthlyPayment: normalizeNonNegativeMoney(extraMonthlyPayment.value) ?? 0,
      asOfDate: localToday(),
    })
  } catch {
    return null
  }
})
const originalSchedule = computed(() => {
  if (!mortgageModel.value) return []
  try {
    return buildFrenchAmortizationSchedule({
      currentBalance: mortgageModel.value.originalPrincipal,
      annualInterestRate: mortgageModel.value.annualInterestRate,
      monthlyPayment: mortgageModel.value.monthlyPayment,
      asOfDate: mortgageModel.value.startDate,
    })
  } catch {
    return []
  }
})
const originalScheduleInterest = computed(() =>
  roundMoney(originalSchedule.value.reduce((total, payment) => total + payment.interest, 0)),
)
const amortizationRows = computed(() => [
  {
    paymentNumber: 0,
    date: mortgageModel.value?.startDate || '',
    payment: 0,
    interest: 0,
    principal: 0,
    remainingBalance: mortgageModel.value?.originalPrincipal || 0,
  },
  ...originalSchedule.value,
])
const amortizationColumns = computed(() => [
  {
    name: 'paymentNumber',
    label: t('liabilities.mortgage.table.month'),
    field: 'paymentNumber',
    align: 'right',
    sortable: true,
  },
  {
    name: 'date',
    label: t('liabilities.mortgage.table.date'),
    field: 'date',
    align: 'left',
    format: (value) => formatTableMonth(value),
    sortable: true,
  },
  moneyColumn('payment', 'liabilities.mortgage.table.payment'),
  moneyColumn('interest', 'liabilities.mortgage.table.interest'),
  moneyColumn('principal', 'liabilities.mortgage.table.principal'),
  moneyColumn('remainingBalance', 'liabilities.mortgage.table.remainingBalance'),
])
const pageLoading = computed(
  () => preparing.value || liabilitiesStore.loading || liabilitiesStore.categoryLoading,
)

watch([workspaceId, liabilityId], () => prepare(), { immediate: true })

async function prepare(force = false) {
  const currentPreparation = ++preparationId
  preparing.value = true
  pageError.value = null
  try {
    await liabilitiesStore.loadConfig(workspaceId.value, force)
    if (currentPreparation !== preparationId) return
    if (
      !liabilitiesStore.setupCompleted ||
      !liabilitiesStore.config?.categories?.mortgage?.enabled
    ) {
      await router.replace({ name: 'liabilities', params: { workspaceId: workspaceId.value } })
      return
    }
    await liabilitiesStore.loadCategory(workspaceId.value, 'mortgage', force)
    if (currentPreparation !== preparationId) return
    if (!mortgage.value) await router.replace(mortgagesRoute.value)
    else resetForm()
  } catch (error) {
    pageError.value = error
  } finally {
    if (currentPreparation === preparationId) preparing.value = false
  }
}

function startEditing() {
  resetForm()
  editing.value = true
}

function cancelEditing() {
  resetForm()
  editing.value = false
}

function resetForm() {
  const detail = mortgage.value?.detail?.mortgage
  const termMonths = Number(detail?.termMonths) || 0
  Object.assign(form, {
    originalPrincipal: detail?.originalPrincipal ?? mortgage.value?.balance ?? '',
    currentBalance: mortgage.value?.balance ?? '',
    annualInterestRate: detail?.annualInterestRate ?? '',
    monthlyPayment: detail?.monthlyPayment ?? '',
    startDate: detail?.startDate ?? '',
    termYears: Math.floor(termMonths / 12) || '',
    termExtraMonths: termMonths % 12,
  })
}

async function saveModel() {
  if (saving.value || !mortgage.value) return
  const valid = await modelForm.value?.validate()
  if (!valid) return

  const originalPrincipal = normalizeNonNegativeMoney(form.originalPrincipal)
  const currentBalance = normalizeNonNegativeMoney(form.currentBalance)
  const annualInterestRate = Number(form.annualInterestRate)
  const termMonths = Number(form.termYears) * 12 + Number(form.termExtraMonths)
  let monthlyPayment = normalizeNonNegativeMoney(form.monthlyPayment)
  if (monthlyPayment === null) {
    monthlyPayment = calculateFrenchMonthlyPayment({
      principal: originalPrincipal,
      annualInterestRate,
      termMonths,
    })
  }

  try {
    calculateMortgageProjection({
      currentBalance,
      annualInterestRate,
      monthlyPayment,
      extraMonthlyPayment: 0,
      asOfDate: localToday(),
    })
  } catch {
    $q.notify({
      type: 'negative',
      message: t('liabilities.mortgage.errors.invalidPayment'),
      position: 'top',
    })
    return
  }

  saving.value = true
  try {
    await liabilitiesStore.editLiability(
      workspaceId.value,
      liabilityId.value,
      {
        categoryId: mortgage.value.categoryId,
        subcategoryId: mortgage.value.subcategoryId,
        itemName: mortgage.value.itemName,
        notes: mortgage.value.notes || '',
        balance: currentBalance,
        ownership: mortgage.value.ownership,
        detail: {
          mortgage: {
            schemaVersion: 1,
            originalPrincipal,
            annualInterestRate,
            monthlyPayment,
            startDate: form.startDate,
            termMonths,
            amortizationType: 'french',
            fixedRate: true,
          },
        },
      },
      memberIds.value,
    )
    editing.value = false
    resetForm()
    $q.notify({ type: 'positive', message: t('liabilities.mortgage.saved'), position: 'top' })
  } catch {
    $q.notify({ type: 'negative', message: t('liabilities.errors.save'), position: 'top' })
  } finally {
    saving.value = false
  }
}

function emptyForm() {
  return {
    originalPrincipal: '',
    currentBalance: '',
    annualInterestRate: '',
    monthlyPayment: '',
    startDate: '',
    termYears: '',
    termExtraMonths: 0,
  }
}

function nonNegativeMoneyRule(value) {
  return normalizeNonNegativeMoney(value) !== null || t('liabilities.mortgage.invalidAmount')
}

function currentBalanceRule(value) {
  const balance = normalizeNonNegativeMoney(value)
  const principal = normalizeNonNegativeMoney(form.originalPrincipal)
  return (
    (balance !== null && principal !== null && balance <= principal) ||
    t('liabilities.mortgage.invalidBalance')
  )
}

function optionalPositiveMoneyRule(value) {
  if (value === '' || value == null) return true
  const amount = normalizeNonNegativeMoney(value)
  return (amount !== null && amount > 0) || t('liabilities.mortgage.invalidPayment')
}

function percentageRule(value) {
  const number = Number(value)
  return (
    (value !== '' && Number.isFinite(number) && number >= 0 && number <= 100) ||
    t('liabilities.mortgage.invalidRate')
  )
}

function termPartRule(value) {
  const number = Number(value)
  const total = number * 12 + Number(form.termExtraMonths)
  return (
    (Number.isInteger(number) && number >= 0 && number <= 100 && total > 0) ||
    t('liabilities.mortgage.invalidTerm')
  )
}

function monthPartRule(value) {
  const number = Number(value)
  const total = Number(form.termYears) * 12 + number
  return (
    (Number.isInteger(number) && number >= 0 && number <= 11 && total > 0) ||
    t('liabilities.mortgage.invalidTerm')
  )
}

function isIsoDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return false
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return (
    date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() === Number(match[2]) - 1 &&
    date.getUTCDate() === Number(match[3])
  )
}

function localToday() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`
}

function formatRate(value) {
  return `${new Intl.NumberFormat('en-IE', { maximumFractionDigits: 2 }).format(value)}%`
}

function formatDuration(months) {
  const total = Math.max(0, Number(months) || 0)
  const years = Math.floor(total / 12)
  const remainingMonths = total % 12
  if (!years) return t('liabilities.mortgage.durationMonths', { months: remainingMonths })
  if (!remainingMonths) return t('liabilities.mortgage.durationYears', { years })
  return t('liabilities.mortgage.duration', { years, months: remainingMonths })
}

function formatMonthYear(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-IE', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

function formatTableMonth(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-IE', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

function moneyColumn(name, labelKey) {
  return {
    name,
    label: t(labelKey),
    field: name,
    align: 'right',
    format: (value) => formatCurrency(value),
    sortable: true,
  }
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;

.mortgage-page {
  @include financial-page;
}

.mortgage-shell {
  @include financial-shell;
  max-width: 70rem;
}

.page-state {
  display: grid;
  min-height: 24rem;
  place-content: center;
  justify-items: center;
  gap: 0.75rem;
  color: var(--color-copy);
  text-align: center;
}

.error-state > .q-icon {
  font-size: 3rem;
}

.error-state h1,
.error-state p {
  margin: 0;
}

.mortgage-header {
  @include financial-header;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
}

.back-button {
  @include financial-back-button;
}

h1 {
  @include financial-title;
}

.setup-card,
.mortgage-summary,
.next-payment-card,
.chart-card,
.faster-card {
  @include dashboard-card;
  margin-top: 1.25rem;
}

.setup-card {
  max-width: 52rem;
  margin-right: auto;
  margin-left: auto;
  padding: clamp(1.25rem, 4vw, 2.25rem);
}

.setup-icon,
.summary-icon,
.section-icon {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--color-red-soft);
  color: var(--color-danger);
}

.setup-icon {
  width: 3.5rem;
  height: 3.5rem;
  font-size: 1.6rem;
}

.setup-copy h2 {
  margin: 1rem 0 0;
  color: var(--color-ink);
  font-size: 1.6rem;
}

.setup-copy p {
  margin: 0.5rem 0 0;
  color: var(--color-copy);
}

.mortgage-form {
  margin-top: 1.5rem;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.form-field {
  display: grid;
  gap: 0.4rem;
}

.form-field label {
  color: var(--color-copy);
  font-size: 0.82rem;
  font-weight: 700;
}

.term-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1.5rem;
}

.mortgage-summary {
  display: flex;
  align-items: center;
  gap: 1.1rem;
  padding: clamp(1.25rem, 4vw, 2rem);
}

.summary-icon {
  width: 4rem;
  height: 4rem;
  font-size: 1.75rem;
}

.mortgage-summary > div {
  display: grid;
  gap: 0.3rem;
}

.mortgage-summary span,
.mortgage-summary p,
.mortgage-summary small {
  color: var(--color-copy);
}

.mortgage-summary strong {
  color: var(--color-ink);
  font-size: clamp(2rem, 6vw, 3.25rem);
  line-height: 1.05;
  letter-spacing: -0.045em;
}

.mortgage-summary p {
  margin: 0;
  font-weight: 650;
}

.next-payment-card,
.chart-card,
.faster-card {
  padding: clamp(1.1rem, 3vw, 1.75rem);
}

.section-heading {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.chart-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.section-icon {
  width: 2.75rem;
  height: 2.75rem;
  background: var(--color-blue-soft);
  color: var(--color-primary);
  font-size: 1.2rem;
}

.section-icon--faster {
  background: var(--color-green-soft);
  color: var(--color-success-dark);
}

.section-heading h2,
.section-heading small {
  margin: 0;
}

.section-heading h2 {
  color: var(--color-ink);
  font-size: 1.2rem;
}

.section-heading small {
  color: var(--color-copy);
}

.payment-values,
.faster-results {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  margin-top: 1.25rem;
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  background: var(--color-line);
}

.payment-values > div,
.faster-results article {
  display: grid;
  gap: 0.35rem;
  padding: 1rem;
  background: var(--color-surface);
}

.payment-values span,
.faster-results span {
  color: var(--color-copy);
  font-size: 0.78rem;
  font-weight: 650;
}

.payment-values strong,
.faster-results strong {
  color: var(--color-ink);
  font-size: clamp(1.15rem, 3vw, 1.55rem);
}

.paid-off {
  margin: 1.25rem 0 0;
  color: var(--color-success-dark);
  font-weight: 700;
}

.chart-card :deep(.mortgage-chart) {
  margin-top: 1.25rem;
}

.extra-payment-field {
  max-width: 22rem;
  margin-top: 1.5rem;
}

.amortization-dialog {
  display: flex;
  width: min(76rem, calc(100vw - 2rem));
  max-width: 76rem;
  max-height: calc(100vh - 2rem);
  flex-direction: column;
  border-radius: var(--radius-card);
  background: var(--color-surface);
}

.amortization-dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.5rem 1.75rem 1rem;
  border-bottom: 1px solid var(--color-line);
}

.amortization-dialog-header h2,
.amortization-dialog-header p {
  margin: 0;
}

.amortization-dialog-header h2 {
  color: var(--color-ink);
  font-size: 1.5rem;
}

.amortization-dialog-header p {
  margin-top: 0.35rem;
  color: var(--color-copy);
}

.amortization-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  padding: 1rem 1.75rem;
  border-bottom: 1px solid var(--color-line);
}

.amortization-summary > div {
  display: grid;
  gap: 0.2rem;
}

.amortization-summary span {
  color: var(--color-copy);
  font-size: 0.75rem;
  font-weight: 650;
}

.amortization-summary strong {
  color: var(--color-ink);
  font-size: 1.2rem;
}

.amortization-table-section {
  padding: 0;
}

.amortization-table {
  color: var(--color-ink);
}

.amortization-table :deep(th) {
  position: sticky;
  z-index: 1;
  top: 0;
  background: var(--color-surface-soft);
  color: var(--color-copy);
  font-size: 0.72rem;
  font-weight: 750;
}

.amortization-table :deep(td) {
  border-color: var(--color-line);
  font-variant-numeric: tabular-nums;
}

.amortization-table :deep(tbody tr:first-child td) {
  background: var(--color-surface-soft);
  font-weight: 700;
}

@media (max-width: 599px) {
  .mortgage-header {
    align-items: flex-start;
  }

  .mortgage-header > .q-btn {
    margin-top: 2.25rem;
  }

  .field-grid {
    grid-template-columns: 1fr;
  }

  .mortgage-summary {
    align-items: flex-start;
  }

  .summary-icon {
    width: 3rem;
    height: 3rem;
    font-size: 1.35rem;
  }

  .payment-values,
  .faster-results {
    grid-template-columns: 1fr;
  }

  .chart-heading {
    align-items: stretch;
    flex-direction: column;
  }

  .chart-heading > .q-btn {
    align-self: flex-start;
  }

  .amortization-dialog {
    width: 100%;
    max-width: none;
    max-height: 100%;
    border-radius: 0;
  }

  .amortization-dialog-header {
    padding: 1rem;
  }

  .amortization-summary {
    grid-template-columns: 1fr;
    gap: 0.65rem;
    padding: 0.85rem 1rem;
  }

  .amortization-summary > div {
    grid-template-columns: 1fr auto;
    align-items: baseline;
  }
}
</style>
