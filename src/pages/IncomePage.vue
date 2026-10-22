<template>
  <q-page class="income-page">
    <main class="income-shell">
      <div v-if="pageLoading" class="state">
        <q-spinner color="primary" size="2rem" /><span>{{ t('income.loading') }}</span>
      </div>
      <section v-else-if="incomeStore.error || financialYearError" class="state">
        <q-icon name="cloud_off" size="2rem" />
        <h1>{{ t('income.errors.loadTitle') }}</h1>
        <p>{{ t('income.errors.load') }}</p>
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon="refresh"
          :label="t('common.retry')"
          @click="loadPage(true)"
        />
      </section>
      <IncomeCategorySetup
        v-else-if="!incomeStore.setupCompleted"
        :saving="saving"
        @save="completeSetup"
      />
      <template v-else>
        <header class="income-header">
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
            <h1>{{ t('income.title') }}</h1>
          </div>
          <MemberScopeSelector v-model="selectedMemberId" :members="members" />
        </header>
        <section class="total-card">
          <div class="total-copy">
            <span>{{ t('income.totalIncome') }}</span>
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
        <section class="category-list" :aria-label="t('income.enabledCategories')">
          <div v-for="category in enabledCategories" :key="category.id" class="category-row">
            <button type="button" class="category-main" @click="openCategory(category.id)">
              <span class="category-icon"><q-icon :name="category.icon" /></span
              ><span class="category-copy"
                ><strong>{{ t(category.nameKey) }}</strong
                ><small>{{ categoryStatus(category.id) }}</small></span
              >
            </button>
            <SimpleValueEditor
              :value="categoryEditorValue(category.id)"
              :formatted-value="categoryValue(category.id)"
              :formatted-period="categoryPeriodLabel"
              :saving="isCategorySaving(category.id)"
              :disabled="!canQuickEdit(category.id)"
              :aria-label="
                t('income.quickEdit.editLabel', {
                  category: t(category.nameKey),
                  value: categoryValue(category.id),
                })
              "
              :title="t('income.quickEdit.title', { category: t(category.nameKey) })"
              :input-label="t('income.quickEdit.inputLabel')"
              :input-suffix="`/ ${categoryPeriodLabel}`"
              :invalid-message="t('income.quickEdit.invalid')"
              @save="saveSimpleIncome(category, $event)"
            />
            <button
              type="button"
              class="category-link"
              :aria-label="t('income.openCategory', { category: t(category.nameKey) })"
              @click="openCategory(category.id)"
            >
              <q-icon name="chevron_right" />
            </button>
            <q-btn
              flat
              round
              dense
              icon="more_vert"
              color="grey-7"
              class="category-menu"
              @click.stop
              ><q-menu
                ><q-list dense
                  ><q-item
                    clickable
                    v-close-popup
                    class="text-negative"
                    @click="requestCategoryDelete(category)"
                    ><q-item-section avatar><q-icon name="delete_outline" /></q-item-section
                    ><q-item-section>{{ t('common.delete') }}</q-item-section></q-item
                  ></q-list
                ></q-menu
              ></q-btn
            >
          </div>

          <footer class="category-actions">
            <q-btn
              flat
              no-caps
              icon="tune"
              color="primary"
              :label="t('income.editCategories')"
              @click="editingCategories = true"
            />
          </footer>
        </section>
      </template>
    </main>

    <q-dialog v-model="editingCategories" :maximized="$q.screen.lt.sm"
      ><q-card class="category-dialog"
        ><q-btn
          flat
          round
          dense
          icon="close"
          class="dialog-close"
          :aria-label="t('common.cancel')"
          @click="editingCategories = false" /><IncomeCategorySetup
          edit-mode
          :initial-selected="incomeStore.enabledCategories"
          :saving="saving"
          @save="requestCategorySave"
          @cancel="editingCategories = false" /></q-card
    ></q-dialog>
    <q-dialog v-model="confirmDisable"
      ><q-card class="confirm-card"
        ><q-btn
          flat
          round
          dense
          icon="close"
          class="dialog-close"
          :aria-label="t('common.cancel')"
          v-close-popup /><q-card-section
          ><h2>{{ t('income.setup.disableTitle') }}</h2>
          <p>{{ t('income.setup.disableDescription') }}</p></q-card-section
        ><q-card-actions align="right"
          ><q-btn flat no-caps :label="t('common.cancel')" v-close-popup /><q-btn
            unelevated
            no-caps
            color="primary"
            :label="t('income.setup.disableAction')"
            @click="savePendingCategories" /></q-card-actions></q-card
    ></q-dialog>
    <q-dialog v-model="confirmCategoryDelete"
      ><q-card class="confirm-card"
        ><q-btn
          flat
          round
          dense
          icon="close"
          class="dialog-close"
          :aria-label="t('common.cancel')"
          v-close-popup /><q-card-section
          ><h2>{{ t('income.deleteCategory.title') }}</h2>
          <p>
            {{
              t('income.deleteCategory.description', {
                name: deletingCategory ? t(deletingCategory.nameKey) : '',
              })
            }}
          </p></q-card-section
        ><q-card-actions align="right"
          ><q-btn flat no-caps :label="t('common.cancel')" v-close-popup /><q-btn
            unelevated
            no-caps
            color="negative"
            :label="t('common.delete')"
            :loading="saving"
            @click="deleteCategory" /></q-card-actions></q-card
    ></q-dialog>
  </q-page>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import MemberScopeSelector from '@/components/dashboard/MemberScopeSelector.vue'
import SimpleValueEditor from '@/components/financial/SimpleValueEditor.vue'
import IncomeCategorySetup from '@/components/income/IncomeCategorySetup.vue'
import { incomeCategories } from '@/config/income-categories'
import {
  currentFinancialYear,
  financialYearCategoryValue,
  financialYearValue,
} from '@/domain/financial/financial-year'
import { createEqualOwnership, createSingleOwnership } from '@/domain/financial/ownership'
import { authUser } from '@/services/auth'
import { useFinancialScopeStore } from '@/stores/financial-scope-store'
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
const financialYearsStore = useFinancialYearsStore()
const scopeStore = useFinancialScopeStore()
const workspaceStore = useWorkspaceStore()
const saving = ref(false)
const loadingItems = ref(false)
const savingCategoryIds = ref(new Set())
const editingCategories = ref(false)
const confirmDisable = ref(false)
const confirmCategoryDelete = ref(false)
const deletingCategory = ref(null)
const pendingSelection = ref(null)
const period = ref('annual')
const currentYear = currentFinancialYear()
const workspaceId = computed(() => String(route.params.workspaceId))
const workspaceHomeRoute = computed(() => ({
  name: 'workspace-dashboard',
  params: { workspaceId: workspaceId.value },
}))
const workspace = computed(
  () => workspaceStore.workspaces.find((candidate) => candidate.id === workspaceId.value) || null,
)
const members = computed(() => getWorkspaceMembers(workspace.value, authUser.value))
const memberIds = computed(() => members.value.map((member) => member.id))
const selectedMemberId = computed({
  get: () => scopeStore.get(workspaceId.value, memberIds.value, authUser.value?.uid),
  set: (memberId) => scopeStore.select(workspaceId.value, memberId),
})
const financialYear = computed(() => financialYearsStore.get(workspaceId.value, currentYear))
const enabledCategories = computed(() =>
  incomeCategories
    .filter((category) => incomeStore.enabledCategories.includes(category.id))
    .sort((left, right) => categoryAnnualValue(right.id) - categoryAnnualValue(left.id)),
)
const financialYearError = computed(() =>
  financialYearsStore.errorFor(workspaceId.value, currentYear),
)
const pageLoading = computed(
  () =>
    loadingItems.value ||
    incomeStore.loading ||
    incomeStore.categoryLoading ||
    financialYearsStore.loading,
)
const total = computed(() =>
  financialYearValue(financialYear.value, 'income', selectedMemberId.value),
)
const displayedTotal = computed(() => (period.value === 'annual' ? total.value : total.value / 12))
const displayedPeriodLabel = computed(() =>
  period.value === 'annual'
    ? t('dashboard.costOfLife.perYear')
    : t('dashboard.costOfLife.perMonth'),
)
const categoryPeriodLabel = computed(() =>
  period.value === 'annual' ? t('dashboard.year') : t('dashboard.month'),
)
const scopeLabel = computed(() =>
  selectedMemberId.value === 'all'
    ? t('dashboard.allMembers')
    : members.value.find((member) => member.id === selectedMemberId.value)?.name || '',
)
watch(workspaceId, () => loadPage(), { immediate: true })

async function loadPage(force = false) {
  loadingItems.value = true
  try {
    await Promise.allSettled([
      incomeStore.loadConfig(workspaceId.value, force),
      financialYearsStore.load(workspaceId.value, currentYear, force),
    ])
    for (const categoryId of incomeStore.enabledCategories) {
      await incomeStore.loadCategory(workspaceId.value, categoryId, force)
    }
  } finally {
    loadingItems.value = false
  }
}

async function completeSetup(selected) {
  await persist(() => incomeStore.completeSetup(workspaceId.value, selected, memberIds.value))
}
function requestCategorySave(selected) {
  const removedWithData = incomeStore.enabledCategories.some(
    (id) => !selected.includes(id) && categoryHasData(id),
  )
  if (removedWithData) {
    pendingSelection.value = selected
    confirmDisable.value = true
  } else saveCategorySelection(selected)
}
async function savePendingCategories() {
  confirmDisable.value = false
  await saveCategorySelection(pendingSelection.value)
  pendingSelection.value = null
}
async function saveCategorySelection(selected) {
  const saved = await persist(() =>
    incomeStore.saveCategorySelection(workspaceId.value, selected, memberIds.value),
  )
  if (saved) editingCategories.value = false
}
function requestCategoryDelete(category) {
  deletingCategory.value = category
  confirmCategoryDelete.value = true
}
async function deleteCategory() {
  if (!deletingCategory.value || saving.value) return
  const saved = await persist(() =>
    incomeStore.deleteCategory(workspaceId.value, deletingCategory.value.id),
  )
  if (saved) {
    confirmCategoryDelete.value = false
    deletingCategory.value = null
  }
}
function categoryHasData(id) {
  return categoryAnnualValue(id) > 0
}
function categoryStatus(id) {
  if (simpleIncome(id)) return t('income.simpleTotal')
  const subcategories =
    financialYear.value?.months?.['01']?.income?.categories?.[id]?.subcategories || {}
  const count = Object.values(subcategories).reduce(
    (total, subcategory) => total + Object.keys(subcategory.items || {}).length,
    0,
  )
  return t('income.itemCount', { count })
}
function categoryValue(id) {
  const annualValue = categoryAnnualValue(id)
  return formatCurrency(period.value === 'annual' ? annualValue : annualValue / 12)
}
function categoryEditorValue(id) {
  const annualValue = categoryAnnualValue(id)
  return period.value === 'annual' ? annualValue : annualValue / 12
}
function categoryItems(id) {
  return incomeStore.itemsForCategory(id)
}
function simpleIncome(id) {
  const items = categoryItems(id)
  return items.length === 1 && items[0].entryMode === 'simple' ? items[0] : null
}
function canQuickEdit(id) {
  const items = categoryItems(id)
  const editableScope = selectedMemberId.value === 'all' || memberIds.value.length === 1
  return editableScope && (items.length === 0 || Boolean(simpleIncome(id)))
}
function isCategorySaving(id) {
  return savingCategoryIds.value.has(id)
}
async function saveSimpleIncome(category, displayedValue) {
  if (isCategorySaving(category.id) || !canQuickEdit(category.id)) return

  const annualValue = period.value === 'annual' ? displayedValue : displayedValue * 12
  const existing = simpleIncome(category.id)
  const payload = {
    ...(existing || {}),
    categoryId: category.id,
    subcategoryId: existing?.subcategoryId || category.subcategories[0],
    itemName: existing?.itemName || t(category.nameKey),
    notes: existing?.notes || '',
    calculation: simpleCalculation(category.calculationModes[0], annualValue),
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
      await incomeStore.editIncome(workspaceId.value, existing.id, payload, memberIds.value)
    } else {
      await incomeStore.addIncome(workspaceId.value, payload, memberIds.value)
    }
  } catch {
    $q.notify({ type: 'negative', message: t('income.errors.save'), position: 'top' })
  } finally {
    const next = new Set(savingCategoryIds.value)
    next.delete(category.id)
    savingCategoryIds.value = next
  }
}
function simpleCalculation(mode, annualValue) {
  if (mode === 'annual_salary') return { mode, annualAmount: annualValue, paymentsPerYear: 12 }
  if (mode === 'monthly_schedule') {
    return { mode, monthlyAmount: annualValue / 12, extrasByMonth: {} }
  }
  if (mode === 'one_time') return { mode, amount: annualValue, month: 'january' }
  return { mode: 'recurring', amount: annualValue, frequency: 'yearly' }
}
function categoryAnnualValue(id) {
  return financialYearCategoryValue(financialYear.value, 'income', id, selectedMemberId.value)
}
function openCategory(id) {
  router.push({ name: 'income-category', params: { workspaceId: workspaceId.value, category: id } })
}
async function persist(action) {
  saving.value = true
  try {
    await action()
    return true
  } catch {
    $q.notify({ type: 'negative', message: t('income.errors.save'), position: 'top' })
    return false
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;
.income-page {
  @include financial-page;
}
.income-shell {
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
.income-header {
  @include financial-header;
}
.back-button {
  @include financial-back-button;
}
h1 {
  @include financial-title;
}
.total-card {
  @include financial-total-card(flex);
  align-items: flex-start;
  justify-content: space-between;
  gap: 2rem;
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
  margin-top: 1.25rem;
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}
.category-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto auto;
  align-items: center;
  gap: 0.75rem;
  min-height: 5.5rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-line);
}
.category-row:last-of-type {
  border-bottom: 0;
}
.category-actions {
  display: flex;
  justify-content: flex-end;
  padding: 0.8rem 1rem;
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
  gap: 1rem;
  color: var(--color-ink);
  text-align: left;
}
.category-icon {
  display: grid;
  place-items: center;
  flex: 0 0 3rem;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: var(--color-green-soft);
  color: var(--color-success-dark);
  font-size: 1.35rem;
}
.category-copy strong,
.category-copy small {
  display: block;
}
.category-copy small {
  margin-top: 0.2rem;
  color: var(--color-copy);
}
.category-value {
  min-width: 7rem;
  text-align: right;
}
.category-value strong,
.category-value small {
  display: block;
}
.category-value small {
  color: var(--color-copy);
}
.category-link {
  color: var(--color-copy);
  font-size: 1.25rem;
}
.category-dialog {
  @include financial-dialog-card(76rem);
  max-width: none;
}
.category-dialog :deep(.setup-panel) {
  max-width: none;
}
.confirm-card {
  @include financial-simple-dialog;
}
@media (max-width: 760px) {
  .category-row {
    grid-template-columns: minmax(0, 1fr) auto auto auto;
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
  .category-actions :deep(.q-btn) {
    width: 100%;
  }

  .category-main {
    gap: 0.6rem;
  }

  .category-icon {
    flex-basis: 2.35rem;
    width: 2.35rem;
    height: 2.35rem;
    font-size: 1.1rem;
  }
}
</style>
