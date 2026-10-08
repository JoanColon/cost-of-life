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
            />
            <div class="eyebrow">{{ t('expenses.eyebrow') }}</div>
            <h1>{{ t(category.nameKey) }}</h1>
          </div>
          <MemberScopeSelector v-model="selectedMemberId" :members="members" />
        </header>

        <section class="summary-card">
          <span class="summary-icon"><q-icon :name="category.icon" /></span>
          <div>
            <span>{{ t('expenses.annualCategoryCost') }}</span>
            <strong>{{ formatCurrency(categoryTotal) }}</strong>
            <small>{{ formatCurrency(categoryTotal / 12) }} / {{ t('dashboard.month') }}</small>
          </div>
        </section>

        <section v-if="allExpenses.length" class="expense-list">
          <article v-for="item in scopedExpenses" :key="item.id" class="expense-row">
            <span class="expense-icon"><q-icon :name="category.icon" /></span>
            <span class="expense-copy">
              <strong>{{ expenseTypeLabel(item) }}</strong>
              <small>{{ itemSubtitle(item) }}</small>
            </span>
            <span class="necessity-badge" :class="item.necessity || 'unclassified'">
              {{ t(`expenses.necessities.${item.necessity || 'unclassified'}`) }}
            </span>
            <strong class="expense-value">
              {{ formatCurrency(item.scopedValue) }}
              <small>/ {{ t('dashboard.year') }}</small>
            </strong>
            <q-btn flat round dense icon="more_vert" color="grey-7">
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
        :saving="formSaving"
        @save="saveExpense"
        @cancel="closeExpenseDialog"
        @delete="requestDelete(editingExpense)"
      />
    </q-dialog>

    <q-dialog v-model="deleteDialog">
      <q-card class="confirm-card">
        <q-card-section>
          <h2>{{ t('expenses.delete.title') }}</h2>
          <p>{{ t('expenses.delete.description', { name: deletingExpense?.name }) }}</p>
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
import { annualExpenseValue } from '@/domain/financial/expense-calculations'
import { applyOwnership, cloneOwnership, createEqualOwnership } from '@/domain/financial/ownership'
import { authUser } from '@/services/auth'
import { useExpensesStore } from '@/stores/expenses-store'
import { useFinancialScopeStore } from '@/stores/financial-scope-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { formatCurrency } from '@/utils/formatters'
import { getWorkspaceMembers } from '@/utils/workspace-members'

const $q = useQuasar()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const expensesStore = useExpensesStore()
const scopeStore = useFinancialScopeStore()
const workspaceStore = useWorkspaceStore()
const preparing = ref(false)
const pageError = ref(null)
const expenseDialog = ref(false)
const editingExpense = ref(null)
const deletingExpense = ref(null)
const deleteDialog = ref(false)
const formSaving = ref(false)
let preparationId = 0

const workspaceId = computed(() => String(route.params.workspaceId))
const categoryId = computed(() => String(route.params.category))
const expensesRoute = computed(() => ({
  name: 'expenses',
  params: { workspaceId: workspaceId.value },
}))
const category = computed(() => getExpenseCategory(categoryId.value))
const categoryConfig = computed(() => expensesStore.summary?.categories?.[categoryId.value])
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
const scopedExpenses = computed(() =>
  allExpenses.value.map((item) => ({
    ...item,
    scopedValue: applyOwnership(
      annualExpenseValue(item.estimate),
      item.ownership,
      selectedMemberId.value,
    ),
  })),
)
const categoryTotal = computed(() =>
  expensesStore.totalForCategory(categoryId.value, selectedMemberId.value),
)
const expenseDefaults = computed(() => {
  const config = categoryConfig.value
  if (!config) return null
  const firstItem = Number(config.itemCount || 0) === 0
  return {
    name: '',
    type: null,
    estimate: firstItem ? config.manualEstimate : { amount: 0, frequency: 'monthly' },
    variability: 'fixed',
    recurrence: 'recurring',
    necessity: null,
    ownership: cloneOwnership(firstItem ? config.ownership : createEqualOwnership(memberIds.value)),
  }
})
const pageLoading = computed(
  () => preparing.value || expensesStore.loading || expensesStore.categoryLoading,
)

watch([workspaceId, categoryId], () => preparePage(), { immediate: true })

async function preparePage(force = false) {
  const current = ++preparationId
  preparing.value = true
  pageError.value = null
  try {
    await expensesStore.loadSummary(workspaceId.value, force)
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

function itemSubtitle(item) {
  return [
    item.name,
    `${formatCurrency(item.estimate.amount)} / ${t(`expenses.frequencies.${item.estimate.frequency}`)}`,
    t(`expenses.variabilities.${item.variability}`),
    t(`expenses.recurrences.${item.recurrence}`),
  ].join(' · ')
}

function expenseTypeLabel(item) {
  const suggestion = category.value?.suggestions.find((candidate) => candidate.id === item.type)
  return suggestion ? t(suggestion.nameKey) : t('expenses.suggestions.other')
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
      ? expensesStore.editExpense(
          workspaceId.value,
          id,
          payload,
          authUser.value.uid,
          memberIds.value,
        )
      : expensesStore.addExpense(workspaceId.value, payload, authUser.value.uid, memberIds.value),
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
    expensesStore.deleteExpense(
      workspaceId.value,
      deletingExpense.value.id,
      authUser.value.uid,
      memberIds.value,
    ),
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
  } catch {
    $q.notify({ type: 'negative', message: t('expenses.errors.save'), position: 'top' })
    return false
  }
}
</script>

<style scoped lang="scss">
.expense-category-page {
  min-height: calc(100vh - 64px);
  padding: clamp(1.25rem, 3vw, 3rem);
  background: var(--color-page);
}

.category-shell {
  width: min(68rem, 100%);
  margin: 0 auto;
}

.state {
  display: grid;
  place-items: center;
  min-height: 50vh;
  text-align: center;
}

.category-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.category-header h1 {
  margin: 0.2rem 0 0;
  font-size: clamp(2.2rem, 5vw, 3.5rem);
}

.eyebrow {
  color: var(--color-primary);
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
}

.summary-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 1.25rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
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

.summary-card div {
  display: grid;
}

.summary-card strong {
  font-size: 2rem;
}

.summary-card small {
  color: var(--color-copy);
}

.expense-list,
.empty-card {
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.expense-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto auto;
  align-items: center;
  gap: 0.8rem;
  padding: 0.9rem 1rem;
  border-bottom: 1px solid var(--color-line);
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
  width: min(32rem, calc(100vw - 2rem));
}

@media (max-width: 699px) {
  .expense-category-page {
    padding: 1rem;
    padding-bottom: calc(var(--mobile-nav-height) + 1.5rem);
  }

  .expense-row {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .necessity-badge {
    display: none;
  }

  .expense-value {
    grid-column: 2;
    text-align: left;
  }
}
</style>
