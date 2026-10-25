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
            <h1>{{ t(category.nameKey) }}</h1>
          </div>
          <MemberScopeSelector v-model="selectedMemberId" :members="members" />
        </header>
        <section class="summary-card">
          <span class="summary-icon"><q-icon :name="category.icon" /></span>
          <div class="summary-copy">
            <span>{{ summaryLabel }}</span
            ><strong>{{ formatCurrency(displayedCategoryTotal) }}</strong
            ><small>{{ itemSummary }}</small>
          </div>
          <div class="period-switch" role="group" :aria-label="t('dashboard.costOfLife.period')">
            <button
              type="button"
              :class="{ selected: period === 'annual' }"
              :aria-pressed="period === 'annual'"
              @click="period = 'annual'"
            >
              {{ t('dashboard.costOfLife.annual') }}
            </button>
            <button
              type="button"
              :class="{ selected: period === 'monthly' }"
              :aria-pressed="period === 'monthly'"
              @click="period = 'monthly'"
            >
              {{ t('dashboard.costOfLife.monthly') }}
            </button>
          </div>
        </section>
        <section v-if="allCategoryIncome.length" class="income-list">
          <article
            v-for="item in scopedIncome"
            :key="item.id"
            class="income-row"
            role="button"
            tabindex="0"
            @click="edit(item)"
            @keydown.enter.self="edit(item)"
            @keydown.space.self.prevent="edit(item)"
          >
            <div class="income-main">
              <span class="income-icon"><q-icon :name="category.icon" /></span
              ><span class="income-copy"
                ><strong>{{ t(`income.subtypes.${item.subcategoryId}`) }}</strong
                ><small>{{ item.itemName }}</small></span
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
              >{{ formatCurrency(displayedItemValue(item.scopedValue))
              }}<small>/ {{ periodLabel }}</small></strong
            >
            <q-btn flat round dense icon="more_vert" color="grey-7" @click.stop
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
        :portfolios="linkedPortfolios"
        :saving="formSaving"
        @save="saveIncome"
        @cancel="closeIncomeDialog"
        @delete="requestDelete(editingIncome)"
    /></q-dialog>
    <q-dialog v-model="confirmDelete"
      ><q-card class="confirm-card"
        ><q-btn
          flat
          round
          dense
          icon="close"
          class="dialog-close"
          :aria-label="t('common.cancel')"
          v-close-popup /><q-card-section
          ><h2>{{ t('income.delete.title') }}</h2>
          <p>
            {{ t('income.delete.description', { name: incomeDisplayName(deletingIncome) }) }}
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
  currentFinancialYear,
  financialYearCategoryValue,
  financialYearIncomeModelItemValue,
} from '@/domain/financial/financial-year'
import { createEqualOwnership, createSingleOwnership } from '@/domain/financial/ownership'
import { authUser } from '@/services/auth'
import { useFinancialScopeStore } from '@/stores/financial-scope-store'
import { useAssetsStore } from '@/stores/assets-store'
import { useIncomeStore } from '@/stores/income-store'
import { useFinancialYearsStore } from '@/stores/financial-years-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { formatCurrency } from '@/utils/formatters'
import { getWorkspaceMembers } from '@/utils/workspace-members'

const $q = useQuasar()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const incomeStore = useIncomeStore()
const assetsStore = useAssetsStore()
const financialYearsStore = useFinancialYearsStore()
const scopeStore = useFinancialScopeStore()
const workspaceStore = useWorkspaceStore()
const preparing = ref(false)
const pageError = ref(null)
const incomeDialog = ref(false)
const editingIncome = ref(null)
const deletingIncome = ref(null)
const confirmDelete = ref(false)
const formSaving = ref(false)
const period = ref('annual')
let preparationId = 0
const currentYear = currentFinancialYear()
const workspaceId = computed(() => String(route.params.workspaceId))
const categoryId = computed(() => String(route.params.category))
const incomeRoute = computed(() => ({ name: 'income', params: { workspaceId: workspaceId.value } }))
const category = computed(() => getIncomeCategory(categoryId.value))
const categoryConfig = computed(() => incomeStore.config?.categories?.[categoryId.value])
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
const linkedPortfolios = computed(() => {
  const unavailablePortfolioIds = new Set(
    allCategoryIncome.value
      .filter((income) => income.id !== editingIncome.value?.id)
      .map((income) => income.portfolioAssetId)
      .filter(Boolean),
  )
  return assetsStore
    .itemsForCategory('investment')
    .filter(
      (asset) => asset.detail?.portfolio?.spreadsheetUrl && !unavailablePortfolioIds.has(asset.id),
    )
    .map((asset) => ({
      id: asset.id,
      itemName: asset.itemName,
      annualDividendIncome: asset.detail?.portfolio?.summary?.annualDividendIncome,
    }))
})
const financialYear = computed(() => financialYearsStore.get(workspaceId.value, currentYear))
const incomeDefaults = computed(() => {
  if (!categoryConfig.value || !category.value) return null
  const ownership =
    memberIds.value.length === 1
      ? createSingleOwnership(authUser.value?.uid)
      : createEqualOwnership(memberIds.value)
  return {
    subcategoryId: category.value.subcategories[0],
    itemName: '',
    notes: '',
    calculation: defaultCalculation(category.value.calculationModes[0], 0),
    ownership,
  }
})
const scopedIncome = computed(() =>
  allCategoryIncome.value
    .map((item) => ({
      ...item,
      scopedValue: financialYearIncomeModelItemValue(
        financialYear.value,
        categoryId.value,
        item.subcategoryId,
        item.id,
        selectedMemberId.value,
      ),
    }))
    .sort((left, right) => Number(right.scopedValue || 0) - Number(left.scopedValue || 0)),
)
const categoryTotal = computed(() =>
  financialYearCategoryValue(
    financialYear.value,
    'income',
    categoryId.value,
    selectedMemberId.value,
  ),
)
const displayedCategoryTotal = computed(() => displayedValue(categoryTotal.value))
const summaryLabel = computed(() =>
  period.value === 'annual' ? t('income.annualTotal') : t('income.monthlyTotal'),
)
const periodLabel = computed(() =>
  period.value === 'annual' ? t('dashboard.year') : t('dashboard.month'),
)
const itemSummary = computed(() => {
  const count = allCategoryIncome.value.length
  const key = count === 1 ? category.value.itemNameKey : category.value.itemNamePluralKey
  return t('income.itemSummary', { count, items: t(key) })
})
const pageLoading = computed(
  () =>
    preparing.value ||
    incomeStore.loading ||
    incomeStore.categoryLoading ||
    financialYearsStore.loading ||
    (categoryId.value === 'investments' && (assetsStore.loading || assetsStore.categoryLoading)),
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
function displayedValue(annualValue) {
  return period.value === 'annual' ? Number(annualValue || 0) : Number(annualValue || 0) / 12
}
function displayedItemValue(annualValue) {
  return displayedValue(annualValue)
}
async function preparePage(force = false) {
  const current = ++preparationId
  preparing.value = true
  pageError.value = null
  try {
    await Promise.all([
      incomeStore.loadConfig(workspaceId.value, force),
      financialYearsStore.load(workspaceId.value, currentYear, force),
      ...(categoryId.value === 'investments'
        ? [assetsStore.loadCategory(workspaceId.value, 'investment', force)]
        : []),
    ])
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
function incomeDisplayName(item) {
  return item?.itemName?.trim() || (item ? t(`income.subtypes.${item.subcategoryId}`) : '')
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
      ? incomeStore.editIncome(
          workspaceId.value,
          id,
          { ...payload, entryMode: 'detailed' },
          memberIds.value,
        )
      : incomeStore.addIncome(
          workspaceId.value,
          { ...payload, entryMode: 'detailed' },
          memberIds.value,
        ),
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
    incomeStore.deleteIncome(workspaceId.value, deletingIncome.value.id),
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
h1 {
  @include financial-title;
}
.summary-card {
  @include financial-category-summary;
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
  cursor: pointer;
  transition:
    background-color 160ms ease,
    box-shadow 160ms ease;
}
.income-row:hover {
  background: #f8fafc;
}
.income-row:focus-visible {
  position: relative;
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}
.income-main {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  min-width: 0;
}
.income-icon {
  @include financial-item-icon;
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
  display: block;
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
  @include financial-simple-dialog;
}
@media (max-width: 720px) {
  .income-row {
    grid-template-columns: minmax(0, 1fr) auto auto;
    @include mobile-financial-row;
  }
  .avatar-cluster {
    display: none;
  }
  .income-copy small {
    white-space: normal;
  }
  .income-main {
    gap: 0.6rem;
  }
  .income-value {
    font-size: 0.95rem;
  }
  .add-row {
    padding: 0.75rem;
  }
}
</style>
