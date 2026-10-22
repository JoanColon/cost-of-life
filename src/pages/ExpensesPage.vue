<template>
  <q-page class="expenses-page">
    <main class="expenses-shell">
      <div v-if="pageLoading" class="state">
        <q-spinner color="primary" size="2rem" />
        <span>{{ t('expenses.loading') }}</span>
      </div>

      <section v-else-if="expensesStore.error || financialYearError" class="state">
        <q-icon name="cloud_off" size="2rem" />
        <h1>{{ t('expenses.errors.loadTitle') }}</h1>
        <p>{{ t('expenses.errors.load') }}</p>
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon="refresh"
          :label="t('common.retry')"
          @click="loadPage(true)"
        />
      </section>

      <ExpenseCategorySetup
        v-else-if="!expensesStore.setupCompleted"
        :saving="saving"
        @save="completeSetup"
      />

      <template v-else>
        <header class="expenses-header">
          <div>
            <q-btn
              flat
              dense
              no-caps
              color="grey-7"
              icon="arrow_back"
              :label="t('navigation.backToWorkspaceHome')"
              :to="workspaceHomeRoute"
              class="back-button"
            />
            <h1>{{ t('expenses.title') }}</h1>
          </div>
          <MemberScopeSelector v-model="selectedMemberId" :members="members" />
        </header>

        <ExpensesSectionNav :workspace-id="workspaceId" active="plan" :context="planContext" />

        <section class="total-card">
          <div class="total-copy">
            <span>{{ t('expenses.totalCostOfLife') }}</span>
            <strong>{{ formatCurrency(displayedTotal) }}</strong>
            <small>{{ displayedPeriodLabel }} · {{ scopeLabel }}</small>
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

        <section class="category-list" :aria-label="t('expenses.enabledCategories')">
          <div class="category-rows">
            <div v-for="category in enabledCategories" :key="category.id" class="category-row">
              <button type="button" class="category-main" @click="openCategory(category.id)">
                <span class="category-icon"><q-icon :name="category.icon" /></span>
                <span class="category-copy">
                  <strong>{{ t(category.nameKey) }}</strong>
                  <small>{{ categoryStatus(category.id) }}</small>
                </span>
              </button>

              <SimpleValueEditor
                :value="categoryDisplayValue(category.id)"
                :formatted-value="formatCurrency(categoryDisplayValue(category.id))"
                :formatted-period="categoryPeriodLabel"
                :saving="isCategorySaving(category.id)"
                :disabled="!canQuickEdit(category.id)"
                :aria-label="
                  t('expenses.quickEdit.editLabel', {
                    category: t(category.nameKey),
                    value: formatCurrency(categoryDisplayValue(category.id)),
                  })
                "
                :title="t('expenses.quickEdit.simpleTitle', { category: t(category.nameKey) })"
                :input-label="t('expenses.quickEdit.inputLabel')"
                :input-suffix="`/ ${categoryPeriodLabel}`"
                :invalid-message="t('expenses.quickEdit.invalid')"
                @save="saveSimpleExpense(category, $event)"
              />

              <button type="button" class="category-link" @click="openCategory(category.id)">
                <q-icon name="chevron_right" />
              </button>

              <q-btn flat round dense icon="more_vert" color="grey-7" @click.stop>
                <q-menu>
                  <q-list dense>
                    <q-item
                      clickable
                      v-close-popup
                      class="text-negative"
                      @click="requestDelete(category)"
                    >
                      <q-item-section avatar><q-icon name="delete_outline" /></q-item-section>
                      <q-item-section>{{ t('common.delete') }}</q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
              </q-btn>
            </div>
          </div>

          <div class="category-actions">
            <q-btn
              flat
              no-caps
              icon="tune"
              color="primary"
              :label="t('expenses.editCategories')"
              @click="editingCategories = true"
            />
          </div>
        </section>
      </template>
    </main>

    <q-dialog v-model="editingCategories" :maximized="$q.screen.lt.sm">
      <q-card class="category-dialog">
        <q-btn
          flat
          round
          dense
          icon="close"
          class="dialog-close"
          :aria-label="t('common.cancel')"
          @click="editingCategories = false"
        />
        <ExpenseCategorySetup
          edit-mode
          :initial-selected="expensesStore.enabledCategories"
          :saving="saving"
          @save="requestCategorySave"
          @cancel="editingCategories = false"
        />
      </q-card>
    </q-dialog>

    <q-dialog v-model="confirmDisable">
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
          <h2>{{ t('expenses.setup.disableTitle') }}</h2>
          <p>{{ t('expenses.setup.disableDescription') }}</p>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps :label="t('common.cancel')" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="primary"
            :label="t('expenses.setup.disableAction')"
            :loading="saving"
            @click="savePendingCategories"
          />
        </q-card-actions>
      </q-card>
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
          <h2>{{ t('expenses.deleteCategory.title') }}</h2>
          <p>
            {{
              t('expenses.deleteCategory.description', {
                name: deletingCategory ? t(deletingCategory.nameKey) : '',
              })
            }}
          </p>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps :label="t('common.cancel')" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="negative"
            :label="t('common.delete')"
            :loading="saving"
            @click="deleteCategory"
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
import ExpenseCategorySetup from '@/components/expenses/ExpenseCategorySetup.vue'
import ExpensesSectionNav from '@/components/expenses/ExpensesSectionNav.vue'
import MemberScopeSelector from '@/components/dashboard/MemberScopeSelector.vue'
import SimpleValueEditor from '@/components/financial/SimpleValueEditor.vue'
import { expenseCategories } from '@/config/expense-categories'
import {
  currentFinancialYear,
  financialYearCategoryValue,
  financialYearValue,
} from '@/domain/financial/financial-year'
import { createEqualOwnership, createSingleOwnership } from '@/domain/financial/ownership'
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
const saving = ref(false)
const loadingItems = ref(false)
const savingCategoryIds = ref(new Set())
const editingCategories = ref(false)
const confirmDisable = ref(false)
const pendingSelection = ref(null)
const deleteDialog = ref(false)
const deletingCategory = ref(null)
const period = ref('annual')
const currentYear = currentFinancialYear()

const workspaceId = computed(() => String(route.params.workspaceId))
const workspaceHomeRoute = computed(() => ({
  name: 'workspace-dashboard',
  params: { workspaceId: workspaceId.value },
}))
const workspace = computed(
  () => workspaceStore.workspaces.find((item) => item.id === workspaceId.value) || null,
)
const planContext = computed(
  () => `${currentYear} · ${workspace.value?.name || t('navigation.workspaces')}`,
)
const members = computed(() => getWorkspaceMembers(workspace.value, authUser.value))
const memberIds = computed(() => members.value.map((member) => member.id))
const selectedMemberId = computed({
  get: () => scopeStore.get(workspaceId.value, memberIds.value, authUser.value?.uid),
  set: (memberId) => scopeStore.select(workspaceId.value, memberId),
})
const financialYear = computed(() => financialYearsStore.get(workspaceId.value, currentYear))
const enabledCategories = computed(() =>
  expenseCategories
    .filter((category) => expensesStore.config?.categories?.[category.id]?.enabled)
    .sort((left, right) => categoryAnnualValue(right.id) - categoryAnnualValue(left.id)),
)
const financialYearError = computed(() =>
  financialYearsStore.errorFor(workspaceId.value, currentYear),
)
const totals = computed(() => ({
  annualCostOfLife: financialYearValue(financialYear.value, 'expenses', selectedMemberId.value),
  monthlyCostOfLife:
    financialYearValue(financialYear.value, 'expenses', selectedMemberId.value) / 12,
}))
const pageLoading = computed(
  () =>
    loadingItems.value ||
    expensesStore.loading ||
    expensesStore.categoryLoading ||
    financialYearsStore.loading,
)
const displayedTotal = computed(() =>
  period.value === 'annual' ? totals.value.annualCostOfLife : totals.value.monthlyCostOfLife,
)
const displayedPeriodLabel = computed(() =>
  period.value === 'annual'
    ? t('dashboard.costOfLife.perYear')
    : t('dashboard.costOfLife.perMonth'),
)
const categoryPeriodLabel = computed(() =>
  period.value === 'annual' ? t('dashboard.year') : t('dashboard.month'),
)
const scopeLabel = computed(() => {
  if (selectedMemberId.value === 'all') return t('dashboard.allMembers')
  return members.value.find((member) => member.id === selectedMemberId.value)?.name || ''
})

watch(workspaceId, () => loadPage(), { immediate: true })

async function loadPage(force = false) {
  loadingItems.value = true
  try {
    await Promise.allSettled([
      expensesStore.loadConfig(workspaceId.value, force),
      financialYearsStore.load(workspaceId.value, currentYear, force),
    ])
    await Promise.allSettled(
      expensesStore.enabledCategories.map((categoryId) =>
        expensesStore.loadCategory(workspaceId.value, categoryId, force),
      ),
    )
  } finally {
    loadingItems.value = false
  }
}

function categoryDisplayValue(categoryId) {
  const annualValue = categoryAnnualValue(categoryId)
  return period.value === 'annual' ? annualValue : annualValue / 12
}

function categoryAnnualValue(categoryId) {
  return financialYearCategoryValue(
    financialYear.value,
    'expenses',
    categoryId,
    selectedMemberId.value,
  )
}

function categoryStatus(categoryId) {
  if (simpleExpense(categoryId)) return t('expenses.simpleTotal')
  const subcategories =
    financialYear.value?.months?.['01']?.expenses?.categories?.[categoryId]?.subcategories || {}
  const count = Object.values(subcategories).reduce(
    (total, subcategory) => total + Object.keys(subcategory.items || {}).length,
    0,
  )
  const key = count === 1 ? 'expenses.itemName' : 'expenses.itemNamePlural'
  return t('expenses.itemSummary', { count, items: t(key) })
}

function categoryItems(categoryId) {
  return expensesStore.itemsForCategory(categoryId)
}

function simpleExpense(categoryId) {
  const items = categoryItems(categoryId)
  return items.length === 1 && items[0].entryMode === 'simple' ? items[0] : null
}

function canQuickEdit(categoryId) {
  const items = categoryItems(categoryId)
  const editableScope = selectedMemberId.value === 'all' || memberIds.value.length === 1
  return editableScope && (items.length === 0 || Boolean(simpleExpense(categoryId)))
}

function isCategorySaving(categoryId) {
  return savingCategoryIds.value.has(categoryId)
}

async function saveSimpleExpense(category, displayedValue) {
  if (isCategorySaving(category.id) || !canQuickEdit(category.id)) return

  const annualValue = period.value === 'annual' ? displayedValue : displayedValue * 12
  const existing = simpleExpense(category.id)
  const defaultSubcategory = category.suggestions[0]
  const payload = {
    ...(existing || {}),
    categoryId: category.id,
    subcategoryId: existing?.subcategoryId || defaultSubcategory.id,
    itemName: existing?.itemName || t(category.nameKey),
    notes: existing?.notes || '',
    estimate: { amount: annualValue / 12, frequency: 'monthly' },
    monthlyAmounts: null,
    variability: 'variable',
    recurrence: 'recurring',
    necessity: null,
    ownership:
      existing?.ownership ||
      (memberIds.value.length === 1
        ? createSingleOwnership(memberIds.value[0])
        : createEqualOwnership(memberIds.value)),
    entryMode: 'simple',
  }

  savingCategoryIds.value = new Set(savingCategoryIds.value).add(category.id)
  try {
    if (existing) {
      await expensesStore.editExpense(workspaceId.value, existing.id, payload, memberIds.value)
    } else {
      await expensesStore.addExpense(workspaceId.value, payload, memberIds.value)
    }
  } catch {
    $q.notify({ type: 'negative', message: t('expenses.errors.save'), position: 'top' })
  } finally {
    const next = new Set(savingCategoryIds.value)
    next.delete(category.id)
    savingCategoryIds.value = next
  }
}

function openCategory(categoryId) {
  router.push({
    name: 'expense-category',
    params: { workspaceId: workspaceId.value, category: categoryId },
  })
}

async function completeSetup(selected) {
  await runSaving(() => expensesStore.completeSetup(workspaceId.value, selected, memberIds.value))
}

function requestCategorySave(selected) {
  const removedWithData = expensesStore.enabledCategories.some(
    (categoryId) => !selected.includes(categoryId) && categoryHasData(categoryId),
  )
  if (removedWithData) {
    pendingSelection.value = selected
    confirmDisable.value = true
    return
  }
  saveCategorySelection(selected)
}

async function savePendingCategories() {
  confirmDisable.value = false
  await saveCategorySelection(pendingSelection.value)
  pendingSelection.value = null
}

async function saveCategorySelection(selected) {
  const saved = await runSaving(() =>
    expensesStore.saveCategorySelection(workspaceId.value, selected, memberIds.value),
  )
  if (saved) editingCategories.value = false
}

function categoryHasData(categoryId) {
  return categoryAnnualValue(categoryId) > 0
}

function requestDelete(category) {
  deletingCategory.value = category
  deleteDialog.value = true
}

async function deleteCategory() {
  if (!deletingCategory.value) return
  const saved = await runSaving(() =>
    expensesStore.deleteCategory(workspaceId.value, deletingCategory.value.id),
  )
  if (saved) {
    deleteDialog.value = false
    deletingCategory.value = null
  }
}

async function runSaving(operation) {
  if (saving.value) return false
  saving.value = true
  try {
    await operation()
    $q.notify({ type: 'positive', message: t('expenses.saved'), position: 'top' })
    return true
  } catch {
    $q.notify({ type: 'negative', message: t('expenses.errors.save'), position: 'top' })
    return false
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;

.expenses-page {
  @include financial-page;
}

.expenses-shell {
  @include financial-shell;
}

.state {
  display: grid;
  place-items: center;
  min-height: 50vh;
  text-align: center;
}

.state h1,
.state p {
  margin: 0.35rem;
}

.expenses-header {
  @include financial-header;
}

.back-button {
  @include financial-back-button;
}

.expenses-header h1 {
  @include financial-title;
}

.total-card {
  @include financial-total-card(flex);
  align-items: flex-start;
  justify-content: space-between;
  gap: 2rem;
  margin-bottom: 1.25rem;
}

.total-copy {
  display: grid;
}

.total-card span,
.total-card small {
  @include financial-total-secondary;
}

.total-card strong {
  @include financial-total-value;
}

.total-card small {
  @include financial-total-meta;
}

.period-switch {
  @include financial-period-switch;
}

.category-list {
  @include dashboard-card;
  overflow: hidden;
  margin-bottom: 0.75rem;
}

.category-row {
  display: grid;
  grid-template-columns: minmax(13rem, 1fr) auto auto auto;
  align-items: center;
  gap: 0.4rem;
  min-height: 5rem;
  padding: 0.55rem 0.75rem;
  border-bottom: 1px solid var(--color-line);
}

.category-row:last-child {
  border-bottom: 0;
}

.category-actions {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.75rem;
  padding: 0.8rem 0.75rem;
  border-top: 1px solid var(--color-line);
}

.category-main,
.category-link {
  border: 0;
  background: transparent;
  cursor: pointer;
}

.category-main {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  min-width: 0;
  text-align: left;
}

.category-icon {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 2.7rem;
  height: 2.7rem;
  border-radius: 50%;
  background: #ffe9ea;
  color: #e85d65;
  font-size: 1.3rem;
}

.category-copy strong,
.category-copy small {
  display: block;
}

.category-copy small {
  color: var(--color-muted);
}

.confirm-card {
  @include financial-simple-dialog(34rem);
}

.category-dialog {
  @include financial-dialog-card(76rem);
  max-width: none;
}
.category-dialog :deep(.setup-panel) {
  max-width: none;
}

@media (max-width: 749px) {
  .category-row {
    grid-template-columns: minmax(0, 1fr) auto auto;
    @include mobile-financial-row;
  }

  .category-link {
    display: none;
  }

  .total-card {
    align-items: center;
    gap: 0.75rem;
  }

  .period-switch {
    width: 8.25rem;
  }

  .period-switch button {
    flex: 1;
  }

  .category-actions {
    align-items: center;
    flex-direction: row;
    padding: 0.55rem 0.65rem;
  }

  .category-icon {
    width: 2.35rem;
    height: 2.35rem;
    font-size: 1.1rem;
  }

  .category-main {
    gap: 0.6rem;
  }

  .category-actions :deep(.q-btn) {
    width: auto;
  }
}
</style>
