<template>
  <q-page class="category-page"
    ><main class="category-shell">
      <div v-if="pageLoading" class="state">
        <q-spinner color="primary" size="2rem" /><span>{{ t('income.loading') }}</span>
      </div>
      <section v-else-if="pageError || incomeStore.error" class="state">
        <q-icon name="cloud_off" size="2rem" />
        <h1>{{ t('income.errors.loadTitle') }}</h1>
        <p>{{ t('income.errors.load') }}</p>
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon="refresh"
          :label="t('common.retry')"
          @click="preparePage(true)"
        />
      </section>
      <template v-else-if="category && categoryConfig?.enabled">
        <header class="category-header">
          <div>
            <q-btn
              flat
              dense
              no-caps
              color="grey-7"
              icon="arrow_back"
              :label="t('income.backToIncome')"
              :to="incomeRoute"
              class="back-button"
            />
            <div class="eyebrow">{{ t('income.eyebrow') }}</div>
            <h1>{{ t(category.nameKey) }}</h1>
          </div>
          <MemberScopeSelector v-model="selectedMemberId" :members="members" />
        </header>
        <section class="summary-card">
          <span class="summary-icon"><q-icon :name="category.icon" /></span>
          <div>
            <span>{{ t('income.annualTotal') }}</span
            ><strong>{{ formatCurrency(categoryTotal) }}</strong
            ><small>{{ itemSummary }}</small>
          </div>
        </section>
        <section v-if="allCategoryIncome.length" class="income-list">
          <article v-for="item in scopedIncome" :key="item.id" class="income-row">
            <div class="income-main">
              <span class="income-icon"><q-icon :name="category.icon" /></span
              ><span class="income-copy"
                ><strong>{{ item.name }}</strong
                ><small>{{ itemSubtitle(item) }}</small></span
              >
            </div>
            <span class="avatar-cluster"
              ><q-avatar
                v-for="share in visibleOwnershipShares(item.ownership)"
                :key="share.memberId"
                size="2.35rem"
                class="ownership-avatar"
                ><img
                  v-if="memberFor(share.memberId)?.photoURL"
                  :src="memberFor(share.memberId)?.photoURL"
                  alt=""
                /><span v-else>{{
                  initials(memberFor(share.memberId)?.name || '')
                }}</span></q-avatar
              ></span
            >
            <strong class="income-value"
              >{{ formatCurrency(item.scopedValue)
              }}<small>/{{ t('dashboard.year') }}</small></strong
            >
            <q-btn flat round dense icon="more_vert" color="grey-7"
              ><q-menu
                ><q-list dense
                  ><q-item clickable v-close-popup @click="edit(item)"
                    ><q-item-section avatar><q-icon name="edit" /></q-item-section
                    ><q-item-section>{{ t('income.editDetails') }}</q-item-section></q-item
                  ><q-item
                    clickable
                    v-close-popup
                    class="text-negative"
                    @click="requestDelete(item)"
                    ><q-item-section avatar><q-icon name="delete_outline" /></q-item-section
                    ><q-item-section>{{ t('common.delete') }}</q-item-section></q-item
                  ></q-list
                ></q-menu
              ></q-btn
            >
          </article>
          <button type="button" class="add-row" @click="add">
            <q-icon name="add" /><span>{{ t(category.addLabelKey) }}</span>
          </button>
        </section>
        <section v-else class="empty-card">
          <span class="empty-icon"><q-icon :name="category.icon" /></span>
          <h2>{{ t('income.empty.contextualTitle', { items: t(category.itemNamePluralKey) }) }}</h2>
          <p>{{ t('income.empty.description') }}</p>
          <q-btn
            unelevated
            no-caps
            color="primary"
            icon="add"
            :label="t(category.addLabelKey)"
            @click="add"
          />
        </section>
      </template>
    </main>
    <q-dialog v-model="incomeDialog" persistent
      ><IncomeForm
        v-if="category"
        :category="category"
        :income="editingIncome"
        :defaults="incomeDefaults"
        :members="members"
        :saving="formSaving"
        @save="saveIncome"
        @cancel="closeIncomeDialog"
        @delete="requestDelete(editingIncome)"
    /></q-dialog>
    <q-dialog v-model="confirmDelete"
      ><q-card class="confirm-card"
        ><q-card-section
          ><h2>{{ t('income.delete.title') }}</h2>
          <p>
            {{ t('income.delete.description', { name: deletingIncome?.name }) }}
          </p></q-card-section
        ><q-card-actions align="between"
          ><q-btn
            flat
            no-caps
            color="negative"
            :label="t('common.delete')"
            :loading="formSaving"
            @click="deleteIncome" /><q-btn
            flat
            no-caps
            :label="t('common.cancel')"
            v-close-popup /></q-card-actions></q-card
    ></q-dialog>
  </q-page>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import MemberScopeSelector from '@/components/dashboard/MemberScopeSelector.vue'
import IncomeForm from '@/components/income/IncomeForm.vue'
import { getIncomeCategory } from '@/config/income-categories'
import {
  annualIncomeValue,
  incomeCalculationBreakdown,
} from '@/domain/financial/income-calculations'
import { applyOwnership, cloneOwnership, createEqualOwnership } from '@/domain/financial/ownership'
import { authUser } from '@/services/auth'
import { useFinancialScopeStore } from '@/stores/financial-scope-store'
import { useIncomeStore } from '@/stores/income-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { formatCurrency } from '@/utils/formatters'
import { getWorkspaceMembers } from '@/utils/workspace-members'

const $q = useQuasar()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const incomeStore = useIncomeStore()
const scopeStore = useFinancialScopeStore()
const workspaceStore = useWorkspaceStore()
const preparing = ref(false)
const pageError = ref(null)
const incomeDialog = ref(false)
const editingIncome = ref(null)
const deletingIncome = ref(null)
const confirmDelete = ref(false)
const formSaving = ref(false)
let preparationId = 0
const workspaceId = computed(() => String(route.params.workspaceId))
const categoryId = computed(() => String(route.params.category))
const incomeRoute = computed(() => ({ name: 'income', params: { workspaceId: workspaceId.value } }))
const category = computed(() => getIncomeCategory(categoryId.value))
const categoryConfig = computed(() => incomeStore.summary?.categories?.[categoryId.value])
const workspace = computed(
  () => workspaceStore.workspaces.find((candidate) => candidate.id === workspaceId.value) || null,
)
const members = computed(() => getWorkspaceMembers(workspace.value, authUser.value))
const memberIds = computed(() => members.value.map((member) => member.id))
const selectedMemberId = computed({
  get: () => scopeStore.get(workspaceId.value, memberIds.value, authUser.value?.uid),
  set: (memberId) => scopeStore.select(workspaceId.value, memberId),
})
const allCategoryIncome = computed(() => incomeStore.itemsForCategory(categoryId.value))
const incomeDefaults = computed(() => {
  const config = categoryConfig.value
  if (!config || !category.value) return null
  const firstItem = Number(config.itemCount || 0) === 0
  return {
    subtype: category.value.subtypes[0],
    name: '',
    calculation: firstItem
      ? defaultCalculation(category.value.calculationModes[0], config.manualValue ?? 0)
      : defaultCalculation(category.value.calculationModes[0], 0),
    ownership: cloneOwnership(firstItem ? config.ownership : createEqualOwnership(memberIds.value)),
  }
})
const scopedIncome = computed(() =>
  allCategoryIncome.value.map((item) => ({
    ...item,
    scopedValue: applyOwnership(
      annualIncomeValue(item.calculation),
      item.ownership,
      selectedMemberId.value,
    ),
  })),
)
const categoryTotal = computed(() =>
  incomeStore.totalForCategory(categoryId.value, selectedMemberId.value),
)
const itemSummary = computed(() => {
  const count = Number(categoryConfig.value?.itemCount || 0)
  const key = count === 1 ? category.value.itemNameKey : category.value.itemNamePluralKey
  return t('income.itemSummary', { count, items: t(key) })
})
const pageLoading = computed(
  () => preparing.value || incomeStore.loading || incomeStore.categoryLoading,
)
watch([workspaceId, categoryId], () => preparePage(), { immediate: true })

function defaultCalculation(mode, value) {
  if (mode === 'annual_salary') return { mode, annualAmount: value, paymentsPerYear: 12 }
  if (mode === 'monthly_schedule')
    return {
      mode,
      monthlyAmount: value / 12,
      extrasByMonth: {},
    }
  if (mode === 'one_time') return { mode, amount: value }
  return { mode: 'recurring', amount: value, frequency: 'yearly' }
}
async function preparePage(force = false) {
  const current = ++preparationId
  preparing.value = true
  pageError.value = null
  try {
    await incomeStore.loadSummary(workspaceId.value, force)
    if (current !== preparationId) return
    if (!incomeStore.setupCompleted || !category.value || !categoryConfig.value?.enabled) {
      await router.replace(incomeRoute.value)
      return
    }
    await incomeStore.loadCategory(workspaceId.value, categoryId.value, force)
  } catch (error) {
    pageError.value = error
  } finally {
    if (current === preparationId) preparing.value = false
  }
}
function itemSubtitle(item) {
  const breakdown = incomeCalculationBreakdown(item.calculation)
  const type = t(`income.subtypes.${item.subtype}`)
  if (item.calculation.mode === 'annual_salary')
    return `${type} · ${item.calculation.paymentsPerYear} ${t('income.form.payments').toLowerCase()} · ${formatCurrency(breakdown.perPayment)} ${t('income.form.perPayment').toLowerCase()}`
  if (item.calculation.mode === 'monthly_schedule') {
    const extraMonths = Object.values(item.calculation.extrasByMonth || {}).filter(
      (value) => Number(value) > 0,
    ).length
    const extras = extraMonths
      ? ` + ${extraMonths} ${t('income.form.extraMonths').toLowerCase()}`
      : ''
    return `${type} · ${formatCurrency(item.calculation.monthlyAmount)} / ${t('dashboard.month')}${extras}`
  }
  if (item.calculation.mode === 'recurring')
    return `${type} · ${formatCurrency(item.calculation.amount)} / ${t(`income.frequencies.${item.calculation.frequency}`).toLowerCase()}`
  return `${type} · ${t('income.calculationModes.one_time')}`
}
function add() {
  editingIncome.value = null
  incomeDialog.value = true
}
function edit(item) {
  editingIncome.value = item
  incomeDialog.value = true
}
function closeIncomeDialog() {
  incomeDialog.value = false
  editingIncome.value = null
}
async function saveIncome(payload) {
  if (formSaving.value) return
  const id = editingIncome.value?.id
  formSaving.value = true
  const saved = await persist(() =>
    id
      ? incomeStore.editIncome(workspaceId.value, id, payload, authUser.value.uid, memberIds.value)
      : incomeStore.addIncome(workspaceId.value, payload, authUser.value.uid, memberIds.value),
  )
  formSaving.value = false
  if (saved) closeIncomeDialog()
}
function requestDelete(item) {
  if (!item) return
  deletingIncome.value = item
  confirmDelete.value = true
}
async function deleteIncome() {
  if (!deletingIncome.value) return
  formSaving.value = true
  const saved = await persist(() =>
    incomeStore.deleteIncome(
      workspaceId.value,
      deletingIncome.value.id,
      authUser.value.uid,
      memberIds.value,
    ),
  )
  formSaving.value = false
  if (saved) {
    confirmDelete.value = false
    deletingIncome.value = null
    closeIncomeDialog()
  }
}
function visibleOwnershipShares(ownership) {
  return (ownership?.shares || []).filter((share) => Number(share.percentage) > 0)
}
function memberFor(id) {
  return members.value.find((member) => member.id === id)
}
function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}
async function persist(action) {
  try {
    await action()
    $q.notify({ type: 'positive', message: t('income.saved'), position: 'top' })
    return true
  } catch {
    $q.notify({ type: 'negative', message: t('income.errors.save'), position: 'top' })
    return false
  }
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;

.category-page {
  @include financial-page;
}
.category-shell {
  @include financial-shell;
}
.state {
  display: grid;
  place-items: center;
  gap: 0.75rem;
  min-height: 24rem;
  text-align: center;
  color: var(--color-copy);
}
.state h1,
.state p {
  margin: 0;
}
.category-header {
  @include financial-header;
}
.back-button {
  @include financial-back-button;
}
.eyebrow {
  @include financial-eyebrow;
}
h1 {
  @include financial-title;
}
.summary-card {
  @include financial-total-card(flex);
  align-items: center;
  gap: 1.1rem;
}
.summary-card > div {
  display: grid;
}
.summary-icon,
.income-icon,
.empty-icon {
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--color-green-soft);
  color: var(--color-success-dark);
}
.summary-icon {
  @include financial-summary-icon;
}
.summary-card span:not(.summary-icon),
.summary-card strong,
.summary-card small {
  display: block;
}
.summary-card strong {
  @include financial-total-value;
}
.summary-card small,
.summary-card div > span {
  @include financial-total-secondary;
}
.summary-card small {
  @include financial-total-meta;
}
.income-list {
  margin-top: 1.25rem;
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  background: white;
  box-shadow: var(--shadow-card);
}
.income-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto auto;
  align-items: center;
  gap: 1rem;
  min-height: 5rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-line);
}
.income-main {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  min-width: 0;
}
.income-icon {
  flex: 0 0 2.75rem;
  width: 2.75rem;
  height: 2.75rem;
}
.income-copy {
  min-width: 0;
}
.income-copy strong,
.income-copy small {
  display: block;
}
.income-copy small {
  margin-top: 0.2rem;
  overflow: hidden;
  color: var(--color-copy);
  font-size: 0.8rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.avatar-cluster {
  display: flex;
}
.ownership-avatar {
  margin-left: -0.45rem;
  border: 2px solid white;
  background: #edf2f6;
}
.income-value {
  text-align: right;
  white-space: nowrap;
}
.income-value small {
  color: var(--color-copy);
  font-weight: 500;
}
.add-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 1rem;
  border: 0;
  background: white;
  color: var(--color-primary);
  font-weight: 700;
  cursor: pointer;
}
.empty-card {
  display: grid;
  place-items: center;
  margin-top: 1.25rem;
  padding: 3rem 1.5rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  background: white;
  text-align: center;
  box-shadow: var(--shadow-card);
}
.empty-icon {
  width: 4rem;
  height: 4rem;
  font-size: 1.8rem;
}
.empty-card h2 {
  margin: 1rem 0 0.3rem;
}
.empty-card p {
  margin: 0 0 1.25rem;
  color: var(--color-copy);
}
.confirm-card {
  width: min(32rem, calc(100vw - 2rem));
  border-radius: var(--radius-card);
}
@media (max-width: 720px) {
  .category-header {
    align-items: flex-start;
    flex-direction: column;
  }
  .income-row {
    grid-template-columns: minmax(0, 1fr) auto auto;
  }
  .avatar-cluster {
    display: none;
  }
  .income-copy small {
    white-space: normal;
  }
}
</style>
