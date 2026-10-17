<template>
  <q-page class="expense-category-page">
    <main class="category-shell">
      <div v-if="pageLoading" class="state">
        <q-spinner color="primary" size="2rem" />
        <span>{{ t('expenses.loading') }}</span>
      </div>
      <section v-else-if="pageError || expensesStore.error" class="state">
        <q-icon name="cloud_off" size="2rem" />
        <h1>{{ t('expenses.errors.loadTitle') }}</h1>
        <p>{{ t('expenses.errors.load') }}</p>
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
              :label="t('expenses.backToExpenses')"
              :to="expensesRoute"
              class="back-button"
            />
            <h1>{{ t(category.nameKey) }}</h1>
          </div>
          <MemberScopeSelector v-model="selectedMemberId" :members="members" />
        </header>

        <section class="summary-card">
          <span class="summary-icon"><q-icon :name="category.icon" /></span>
          <div class="summary-copy">
            <span>{{ summaryLabel }}</span>
            <strong>{{ formatCurrency(displayedCategoryTotal) }}</strong>
            <small>{{ itemSummary }}</small>
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

        <section v-if="allExpenses.length" class="expense-list">
          <article
            v-for="item in scopedExpenses"
            :key="item.id"
            class="expense-row"
            role="button"
            tabindex="0"
            @click="edit(item)"
            @keydown.enter.self="edit(item)"
            @keydown.space.self.prevent="edit(item)"
          >
            <span class="expense-icon"><q-icon :name="category.icon" /></span>
            <span class="expense-copy">
              <strong>{{ expenseTypeLabel(item) }}</strong>
            </span>
            <span class="necessity-badge" :class="item.necessity || 'unclassified'">
              {{ t(`expenses.necessities.${item.necessity || 'unclassified'}`) }}
            </span>
            <strong class="expense-value">
              {{ formatCurrency(displayedItemValue(item.scopedValue)) }}
              <small>/ {{ periodLabel }}</small>
            </strong>
            <q-btn flat round dense icon="more_vert" color="grey-7" @click.stop>
              <q-menu>
                <q-list dense>
                  <q-item clickable v-close-popup @click="edit(item)">
                    <q-item-section avatar><q-icon name="edit" /></q-item-section>
                    <q-item-section>{{ t('common.edit') }}</q-item-section>
                  </q-item>
                  <q-item
                    clickable
                    v-close-popup
                    class="text-negative"
                    @click="requestDelete(item)"
                  >
                    <q-item-section avatar><q-icon name="delete_outline" /></q-item-section>
                    <q-item-section>{{ t('common.delete') }}</q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-btn>
          </article>
          <button type="button" class="add-row" @click="add">
            <q-icon name="add" />
            <span>{{ t('expenses.addExpense') }}</span>
          </button>
        </section>

        <section v-else class="empty-card">
          <span class="empty-icon"><q-icon :name="category.icon" /></span>
          <h2>{{ t('expenses.empty.title') }}</h2>
          <p>{{ t('expenses.empty.description') }}</p>
          <q-btn
            unelevated
            no-caps
            color="primary"
            icon="add"
            :label="t('expenses.addExpense')"
            @click="add"
          />
        </section>
      </template>
    </main>

    <q-dialog v-model="expenseDialog" persistent :maximized="$q.screen.lt.sm">
      <ExpenseForm
        v-if="category"
        :category="category"
        :expense="editingExpense"
        :defaults="expenseDefaults"
        :members="members"
        :financial-year="financialYear"
        :used-standard-types="usedStandardTypes"
        :saving="formSaving"
        @save="saveExpense"
        @cancel="closeExpenseDialog"
        @delete="requestDelete(editingExpense)"
      />
    </q-dialog>

    <q-dialog v-model="deleteDialog">
      <q-card class="confirm-card">
        <q-btn
          flat
          round
          dense
          icon="close"
          class="dialog-close"
          :aria-label="t('common.cancel')"
          v-close-popup
        />
        <q-card-section>
          <h2>{{ t('expenses.delete.title') }}</h2>
          <p>
            {{ t('expenses.delete.description', { name: expenseDisplayName(deletingExpense) }) }}
          </p>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps :label="t('common.cancel')" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="negative"
            :label="t('common.delete')"
            :loading="formSaving"
            @click="deleteExpense"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import ExpenseForm from '@/components/expenses/ExpenseForm.vue'
import MemberScopeSelector from '@/components/dashboard/MemberScopeSelector.vue'
import { getExpenseCategory } from '@/config/expense-categories'
import {
  currentFinancialYear,
  financialYearCategoryValue,
  financialYearSubcategoryValue,
} from '@/domain/financial/financial-year'
import {
  cloneOwnership,
  createEqualOwnership,
  createSingleOwnership,
} from '@/domain/financial/ownership'
import { authUser } from '@/services/auth'
import { useExpensesStore } from '@/stores/expenses-store'
import { useFinancialYearsStore } from '@/stores/financial-years-store'
import { useFinancialScopeStore } from '@/stores/financial-scope-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { formatCurrency } from '@/utils/formatters'
import { getWorkspaceMembers } from '@/utils/workspace-members'

const $q = useQuasar()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const expensesStore = useExpensesStore()
const financialYearsStore = useFinancialYearsStore()
const scopeStore = useFinancialScopeStore()
const workspaceStore = useWorkspaceStore()
const preparing = ref(false)
const pageError = ref(null)
const expenseDialog = ref(false)
const editingExpense = ref(null)
const deletingExpense = ref(null)
const deleteDialog = ref(false)
const formSaving = ref(false)
const period = ref('annual')
let preparationId = 0
const currentYear = currentFinancialYear()

const workspaceId = computed(() => String(route.params.workspaceId))
const categoryId = computed(() => String(route.params.category))
const expensesRoute = computed(() => ({
  name: 'expenses',
  params: { workspaceId: workspaceId.value },
}))
const category = computed(() => getExpenseCategory(categoryId.value))
const categoryConfig = computed(() => expensesStore.config?.categories?.[categoryId.value])
const workspace = computed(
  () => workspaceStore.workspaces.find((item) => item.id === workspaceId.value) || null,
)
const members = computed(() => getWorkspaceMembers(workspace.value, authUser.value))
const memberIds = computed(() => members.value.map((member) => member.id))
const selectedMemberId = computed({
  get: () => scopeStore.get(workspaceId.value, memberIds.value, authUser.value?.uid),
  set: (memberId) => scopeStore.select(workspaceId.value, memberId),
})
const allExpenses = computed(() => expensesStore.itemsForCategory(categoryId.value))
const financialYear = computed(() => financialYearsStore.get(workspaceId.value, currentYear))
const usedStandardTypes = computed(() =>
  allExpenses.value.filter(({ type }) => type !== 'other').map(({ type }) => type),
)
const scopedExpenses = computed(() =>
  allExpenses.value
    .map((item) => ({
      ...item,
      scopedValue: financialYearSubcategoryValue(
        financialYear.value,
        'expenses',
        categoryId.value,
        item.type === 'other' ? item.id : item.type,
        selectedMemberId.value,
      ),
    }))
    .sort((left, right) => Number(right.scopedValue || 0) - Number(left.scopedValue || 0)),
)
const categoryTotal = computed(() =>
  financialYearCategoryValue(
    financialYear.value,
    'expenses',
    categoryId.value,
    selectedMemberId.value,
  ),
)
const displayedCategoryTotal = computed(() => displayedValue(categoryTotal.value))
const summaryLabel = computed(() =>
  period.value === 'annual' ? t('expenses.annualCategoryCost') : t('expenses.monthlyCategoryCost'),
)
const periodLabel = computed(() =>
  period.value === 'annual' ? t('dashboard.year') : t('dashboard.month'),
)
const itemSummary = computed(() => {
  const count = allExpenses.value.length
  const key = count === 1 ? 'expenses.itemName' : 'expenses.itemNamePlural'
  return t('expenses.itemSummary', { count, items: t(key) })
})
const expenseDefaults = computed(() => {
  const config = categoryConfig.value
  if (!config) return null
  const firstItem = allExpenses.value.length === 0
  const ownership =
    memberIds.value.length === 1
      ? createSingleOwnership(authUser.value?.uid)
      : cloneOwnership(firstItem ? config.ownership : createEqualOwnership(memberIds.value))
  return {
    name: '',
    type: null,
    estimate: firstItem ? config.manualEstimate : { amount: 0, frequency: 'monthly' },
    variability: 'fixed',
    recurrence: 'recurring',
    necessity: null,
    ownership,
  }
})
const pageLoading = computed(
  () =>
    preparing.value ||
    expensesStore.loading ||
    expensesStore.categoryLoading ||
    financialYearsStore.loading,
)

watch([workspaceId, categoryId], () => preparePage(), { immediate: true })

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
      expensesStore.loadConfig(workspaceId.value, force),
      financialYearsStore.load(workspaceId.value, currentYear, force),
    ])
    if (current !== preparationId) return
    if (!expensesStore.setupCompleted || !category.value || !categoryConfig.value?.enabled) {
      await router.replace(expensesRoute.value)
      return
    }
    await expensesStore.loadCategory(workspaceId.value, categoryId.value, force)
  } catch (error) {
    pageError.value = error
  } finally {
    if (current === preparationId) preparing.value = false
  }
}

function expenseTypeLabel(item) {
  const suggestion = category.value?.suggestions.find((candidate) => candidate.id === item.type)
  return suggestion ? t(suggestion.nameKey) : t('expenses.suggestions.other')
}

function expenseDisplayName(item) {
  return item?.name?.trim() || (item ? expenseTypeLabel(item) : '')
}

function add() {
  editingExpense.value = null
  expenseDialog.value = true
}

function edit(item) {
  editingExpense.value = item
  expenseDialog.value = true
}

function closeExpenseDialog() {
  expenseDialog.value = false
  editingExpense.value = null
}

async function saveExpense(payload) {
  if (formSaving.value) return
  formSaving.value = true
  const id = editingExpense.value?.id
  const saved = await persist(() =>
    id
      ? expensesStore.editExpense(workspaceId.value, id, payload, memberIds.value)
      : expensesStore.addExpense(workspaceId.value, payload, memberIds.value),
  )
  formSaving.value = false
  if (saved) closeExpenseDialog()
}

function requestDelete(item) {
  if (!item) return
  deletingExpense.value = item
  expenseDialog.value = false
  deleteDialog.value = true
}

async function deleteExpense() {
  if (!deletingExpense.value || formSaving.value) return
  formSaving.value = true
  const saved = await persist(() =>
    expensesStore.deleteExpense(workspaceId.value, deletingExpense.value.id),
  )
  formSaving.value = false
  if (saved) {
    deleteDialog.value = false
    deletingExpense.value = null
  }
}

async function persist(operation) {
  try {
    await operation()
    $q.notify({ type: 'positive', message: t('expenses.saved'), position: 'top' })
    return true
  } catch (error) {
    console.error('Unable to save expense', error)
    $q.notify({
      type: 'negative',
      message: t('expenses.errors.save'),
      caption: error?.message || undefined,
      position: 'top',
    })
    return false
  }
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;

.expense-category-page {
  @include financial-page;
}

.category-shell {
  @include financial-shell;
}

.state {
  display: grid;
  place-items: center;
  min-height: 50vh;
  text-align: center;
}

.category-header {
  @include financial-header;
}

.category-header h1 {
  @include financial-title;
}

.back-button {
  @include financial-back-button;
}

.summary-card {
  @include financial-category-summary;
}

.summary-icon,
.empty-icon {
  display: grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: #ffe9ea;
  color: #e85d65;
  font-size: 1.4rem;
}

.expense-list,
.empty-card {
  margin-top: 1.25rem;
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.expense-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto auto;
  align-items: center;
  gap: 0.8rem;
  padding: 0.9rem 1rem;
  border-bottom: 1px solid var(--color-line);
  cursor: pointer;
  transition:
    background-color 160ms ease,
    box-shadow 160ms ease;
}

.expense-row:hover {
  background: #f8fafc;
}

.expense-row:focus-visible {
  position: relative;
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

.expense-icon {
  color: #e85d65;
  font-size: 1.4rem;
}

.expense-copy strong,
.expense-copy small,
.expense-value small {
  display: block;
}

.expense-copy small,
.expense-value small {
  color: var(--color-muted);
}

.expense-value {
  text-align: right;
}

.necessity-badge {
  padding: 0.25rem 0.55rem;
  border-radius: 999px;
  background: #eef3f7;
  color: var(--color-copy);
  font-size: 0.72rem;
}

.necessity-badge.essential {
  background: #e5f8f0;
  color: var(--color-success-dark);
}

.necessity-badge.lifestyle {
  background: #f3eaff;
  color: #7e45bd;
}

.add-row {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.25rem;
  width: 100%;
  padding: 1rem;
  border: 0;
  background: transparent;
  color: var(--color-primary);
  font-weight: 650;
  cursor: pointer;
}

.empty-card {
  display: grid;
  justify-items: center;
  padding: 3rem 1rem;
  text-align: center;
}

.empty-card h2 {
  margin: 1rem 0 0.35rem;
}

.empty-card p {
  margin: 0 0 1rem;
  color: var(--color-copy);
}

.confirm-card {
  @include financial-simple-dialog;
}

@media (max-width: 699px) {
  .summary-icon {
    width: 2.6rem;
    height: 2.6rem;
    font-size: 1.2rem;
  }

  .expense-row {
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    @include mobile-financial-row;
  }

  .necessity-badge {
    display: none;
  }

  .expense-value {
    grid-column: auto;
    text-align: right;
    font-size: 0.9rem;
    white-space: nowrap;
  }

  .expense-icon {
    font-size: 1.15rem;
  }

  .add-row {
    padding: 0.75rem;
  }
}
</style>
