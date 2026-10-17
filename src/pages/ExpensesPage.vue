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

              <button
                type="button"
                class="category-ownership"
                :disabled="isItemized(category.id)"
                :aria-label="t('expenses.ownership.edit')"
                @click="openOwnership(category.id)"
              >
                <q-avatar
                  v-for="member in categoryMembers(category.id)"
                  :key="member.id"
                  size="2.2rem"
                  class="ownership-avatar"
                >
                  <img v-if="member.photoURL" :src="member.photoURL" alt="" />
                  <span v-else>{{ initials(member.name) }}</span>
                </q-avatar>
              </button>

              <div v-if="isItemized(category.id)" class="category-value">
                <strong>{{ formatCurrency(categoryDisplayValue(category.id)) }}</strong>
                <small>/ {{ categoryPeriodLabel }}</small>
              </div>

              <SimpleExpenseEstimateEditor
                v-else
                :estimate="categoryEstimate(category.id)"
                :display-value="formatCurrency(categoryDisplayValue(category.id))"
                :display-period="categoryPeriodLabel"
                :saving="savingCategoryIds.has(category.id)"
                @save="saveEstimate(category.id, $event)"
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
              icon="receipt_long"
              color="primary"
              :label="t('expenseTracker.open')"
              :to="{ name: 'expense-tracker', params: { workspaceId } }"
            />
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

    <q-dialog v-model="ownershipDialog">
      <q-card class="ownership-dialog">
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
          <h2>{{ t('expenses.ownership.label') }}</h2>
          <OwnershipEditor
            v-if="editingOwnershipCategoryId"
            v-model="editingOwnership"
            :members="members"
            @validity="ownershipValid = $event"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps :label="t('common.cancel')" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="primary"
            :label="t('common.save')"
            :loading="saving"
            :disable="!ownershipValid"
            @click="saveOwnership"
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
import SimpleExpenseEstimateEditor from '@/components/expenses/SimpleExpenseEstimateEditor.vue'
import OwnershipEditor from '@/components/financial/OwnershipEditor.vue'
import MemberScopeSelector from '@/components/dashboard/MemberScopeSelector.vue'
import { expenseCategories } from '@/config/expense-categories'
import { annualMonthlyExpenseValue } from '@/domain/financial/expense-calculations'
import {
  currentFinancialYear,
  financialYearCategoryItemCount,
  financialYearCategoryValue,
  financialYearValue,
} from '@/domain/financial/financial-year'
import { cloneOwnership, isValidOwnership } from '@/domain/financial/ownership'
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
const editingCategories = ref(false)
const confirmDisable = ref(false)
const pendingSelection = ref(null)
const ownershipDialog = ref(false)
const editingOwnershipCategoryId = ref(null)
const editingOwnership = ref({ mode: 'single', shares: [] })
const ownershipValid = ref(false)
const savingCategoryIds = ref(new Set())
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
const pageLoading = computed(() => expensesStore.loading || financialYearsStore.loading)
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
  await Promise.allSettled([
    expensesStore.loadConfig(workspaceId.value, force),
    financialYearsStore.load(workspaceId.value, currentYear, force),
  ])
}

function categoryConfig(categoryId) {
  return expensesStore.config?.categories?.[categoryId]
}

function categoryEstimate(categoryId) {
  return categoryConfig(categoryId)?.manualEstimate || { amount: 0, frequency: 'monthly' }
}

function isItemized(categoryId) {
  return categoryItemCount(categoryId) > 0
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
  const count = categoryItemCount(categoryId)
  if (count > 0) return t('expenses.itemCount', { count })
  return t('expenses.simpleEstimate')
}

function categoryItemCount(categoryId) {
  return financialYearCategoryItemCount(financialYear.value, 'expenses', categoryId)
}

function categoryMembers(categoryId) {
  const ownership = categoryConfig(categoryId)?.ownership
  return (ownership?.shares || [])
    .filter((share) => Number(share.percentage) > 0)
    .map((share) => members.value.find((member) => member.id === share.memberId))
    .filter(Boolean)
}

function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
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
  const category = categoryConfig(categoryId)
  return (
    categoryItemCount(categoryId) > 0 ||
    Number(annualMonthlyExpenseValue(category?.monthlyAmounts, category?.manualEstimate)) > 0
  )
}

async function saveEstimate(categoryId, estimate) {
  savingCategoryIds.value = new Set(savingCategoryIds.value).add(categoryId)
  try {
    await expensesStore.updateSimpleCategoryEstimate(workspaceId.value, categoryId, estimate)
    $q.notify({ type: 'positive', message: t('expenses.saved'), position: 'top' })
  } catch {
    $q.notify({ type: 'negative', message: t('expenses.errors.save'), position: 'top' })
  } finally {
    const next = new Set(savingCategoryIds.value)
    next.delete(categoryId)
    savingCategoryIds.value = next
  }
}

function openOwnership(categoryId) {
  const ownership = categoryConfig(categoryId)?.ownership
  if (!ownership || isItemized(categoryId)) return
  editingOwnershipCategoryId.value = categoryId
  editingOwnership.value = cloneOwnership(ownership)
  ownershipValid.value = isValidOwnership(ownership, memberIds.value)
  ownershipDialog.value = true
}

async function saveOwnership() {
  const categoryId = editingOwnershipCategoryId.value
  if (!categoryId || !ownershipValid.value) return
  const saved = await runSaving(() =>
    expensesStore.updateSimpleCategoryOwnership(
      workspaceId.value,
      categoryId,
      editingOwnership.value,
      memberIds.value,
    ),
  )
  if (saved) ownershipDialog.value = false
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
  grid-template-columns: minmax(13rem, 1fr) auto auto auto auto;
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
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.8rem 0.75rem;
  border-top: 1px solid var(--color-line);
}

.category-main,
.category-link,
.category-ownership {
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

.category-value {
  display: grid;
  justify-items: end;
  min-width: 8.5rem;
  padding: 0.45rem 0.65rem;
}

.category-value strong {
  font-size: 1rem;
}

.category-value small {
  color: var(--color-muted);
}

.category-ownership {
  display: flex;
  padding: 0;
}

.ownership-avatar + .ownership-avatar {
  margin-left: -0.55rem;
}

.ownership-dialog,
.confirm-card {
  @include financial-simple-dialog(34rem);
}

.ownership-dialog h2 {
  margin-bottom: 1.25rem;
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

  .category-ownership {
    display: none;
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

  .category-value {
    min-width: 5.5rem;
    padding: 0.25rem;
  }

  .category-actions :deep(.q-btn) {
    width: auto;
  }
}
</style>
