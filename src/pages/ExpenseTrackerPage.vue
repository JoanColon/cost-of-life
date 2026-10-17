<template>
  <q-page class="tracker-page">
    <main class="tracker-shell">
      <div v-if="pageLoading" class="state">
        <q-spinner color="primary" size="2rem" />
        <span>{{ t('expenseTracker.loading') }}</span>
      </div>

      <section v-else-if="trackingStore.error || pageError" class="state">
        <q-icon name="cloud_off" size="2rem" />
        <h1>{{ t('expenseTracker.errors.loadTitle') }}</h1>
        <p>{{ t('expenseTracker.errors.load') }}</p>
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon="refresh"
          :label="t('common.retry')"
          @click="loadPage(true)"
        />
      </section>

      <template v-else>
        <header class="tracker-header">
          <div class="tracker-heading">
            <q-btn
              flat
              dense
              no-caps
              color="grey-7"
              icon="arrow_back"
              :label="t('expenseTracker.backToExpenses')"
              :to="expensesRoute"
              class="back-button"
            />
            <h1>{{ t('expenseTracker.title') }}</h1>
            <p class="workspace-name">
              <template v-if="periodLabel">{{ periodLabel }} · </template>{{ trackerWorkspaceName }}
            </p>
          </div>
          <div class="tracker-tabs" role="tablist" :aria-label="t('expenseTracker.title')">
            <button
              type="button"
              role="tab"
              :aria-selected="tab === 'track'"
              :class="{ selected: tab === 'track' }"
              @click="tab = 'track'"
            >
              {{ t('expenseTracker.tabs.track') }}
            </button>
            <button
              type="button"
              role="tab"
              :aria-selected="tab === 'review'"
              :class="{ selected: tab === 'review' }"
              @click="tab = 'review'"
            >
              {{ t('expenseTracker.tabs.review') }}
            </button>
          </div>
        </header>

        <ExpenseTrackingPanel
          v-if="tab === 'track'"
          :categories="enabledCategories"
          @add="openAdd"
          @manage="manageDialog = true"
        />

        <ExpenseReviewPanel
          v-else
          v-model="period"
          :groups="reviewGroups"
          :tracked-total="trackingStore.month?.total || 0"
          :model-total="reviewModelTotal"
          :decision-options="decisionOptions"
          :can-use-all-tracked="Boolean(categoriesWithTrackedItems.length)"
          :saving="decisionSaving"
          @view="openItems"
          @decision="setDecision"
          @use-all-tracked="requestApplyAllTracked"
        />
      </template>
    </main>

    <q-dialog v-model="manageDialog" :maximized="$q.screen.lt.sm">
      <ExpenseTrackingCategorySetup
        :initial-selected="trackingStore.enabledSubcategories"
        :subcategories="expenseTrackingCategories"
        :saving="trackingStore.saving"
        @save="savePreferences"
        @cancel="manageDialog = false"
      />
    </q-dialog>

    <ExpenseTrackingEntryDialog
      v-if="activeSubcategory"
      v-model="entryDialog"
      :subcategory="activeSubcategory"
      :item="editingItem"
      :period="period"
      :members="members"
      :preferred-member-id="authUser?.uid"
      :saving="trackingStore.saving"
      @save="saveEntry"
    />

    <q-dialog v-model="itemsDialog" :maximized="$q.screen.lt.sm">
      <q-card class="items-card">
        <q-card-section class="items-heading">
          <div>
            <span>{{ periodLabel }}</span>
            <h2>{{ activeSubcategory ? t(activeSubcategory.nameKey) : '' }}</h2>
          </div>
          <q-btn
            flat
            round
            dense
            icon="close"
            class="dialog-close"
            :aria-label="t('common.cancel')"
            v-close-popup
          />
        </q-card-section>
        <q-card-section v-if="activeSubcategory" class="items-list">
          <article
            v-for="item in trackingStore.itemsFor(activeSubcategory.id)"
            :key="item.id"
            class="item-row"
          >
            <div>
              <strong>{{ formatCurrency(item.amount) }}</strong>
              <small
                >{{ formatItemDate(item.date)
                }}<template v-if="item.notes"> · {{ item.notes }}</template></small
              >
            </div>
            <div v-if="canMutateActiveSubcategory" class="item-actions">
              <q-btn
                flat
                round
                dense
                icon="edit"
                color="primary"
                :aria-label="t('common.edit')"
                @click="openEdit(item)"
              />
              <q-btn
                flat
                round
                dense
                icon="delete_outline"
                color="negative"
                :aria-label="t('common.delete')"
                @click="requestDelete(item)"
              />
            </div>
          </article>
          <div v-if="!trackingStore.itemsFor(activeSubcategory.id).length" class="items-empty">
            {{ t('expenseTracker.review.noItems') }}
          </div>
        </q-card-section>
        <q-card-actions v-if="canMutateActiveSubcategory" class="items-actions">
          <q-btn
            unelevated
            no-caps
            color="primary"
            icon="add"
            :label="t('common.add')"
            @click="openAdd(activeSubcategory, true)"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="applyAllDialog" persistent>
      <q-card class="confirm-card">
        <q-btn
          flat
          round
          dense
          icon="close"
          class="dialog-close"
          :aria-label="t('common.cancel')"
          :disable="decisionSaving"
          v-close-popup
        />
        <q-card-section>
          <h2>{{ t('expenseTracker.review.applyAllConfirm.title') }}</h2>
          <p>
            {{
              t('expenseTracker.review.applyAllConfirm.description', {
                period: periodLabel,
              })
            }}
          </p>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps :label="t('common.cancel')" :disable="decisionSaving" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="primary"
            icon="done_all"
            :label="t('expenseTracker.review.applyAllConfirm.action')"
            :loading="decisionSaving"
            @click="applyAllTracked"
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
          <h2>{{ t('expenseTracker.delete.title') }}</h2>
          <p>{{ t('expenseTracker.delete.description') }}</p>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps :label="t('common.cancel')" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="negative"
            :label="t('common.delete')"
            :loading="trackingStore.saving"
            @click="deleteEntry"
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
import { useRoute } from 'vue-router'
import ExpenseTrackingCategorySetup from '@/components/expenses/ExpenseTrackingCategorySetup.vue'
import ExpenseTrackingEntryDialog from '@/components/expenses/ExpenseTrackingEntryDialog.vue'
import ExpenseTrackingPanel from '@/components/expenses/ExpenseTrackingPanel.vue'
import ExpenseReviewPanel from '@/components/expenses/ExpenseReviewPanel.vue'
import {
  expenseTrackingCategories,
  groupedExpenseTrackingCategories,
  reviewExpenseTrackingCategories,
} from '@/config/expense-tracking-categories'
import { resolveExpenseTrackingValue } from '@/domain/financial/expense-tracking'
import { FINANCIAL_YEAR_TIME_ZONE } from '@/domain/financial/financial-year'
import { normalizeNonNegativeMoney } from '@/domain/financial/money'
import { authUser } from '@/services/auth'
import { useExpenseTrackingStore } from '@/stores/expense-tracking-store'
import { useExpensesStore } from '@/stores/expenses-store'
import { useFinancialYearsStore } from '@/stores/financial-years-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { formatCurrency } from '@/utils/formatters'
import { getWorkspaceMembers } from '@/utils/workspace-members'

const $q = useQuasar()
const { t, locale } = useI18n()
const route = useRoute()
const trackingStore = useExpenseTrackingStore()
const expensesStore = useExpensesStore()
const financialYearsStore = useFinancialYearsStore()
const workspaceStore = useWorkspaceStore()
const tab = ref('track')
const period = ref(currentPeriod())
const pageError = ref(null)
const preparing = ref(false)
const manageDialog = ref(false)
const entryDialog = ref(false)
const itemsDialog = ref(false)
const deleteDialog = ref(false)
const applyAllDialog = ref(false)
const activeSubcategory = ref(null)
const editingItem = ref(null)
const deletingItem = ref(null)
const decisionSaving = ref(false)
const decisionSavingIds = ref(new Set())
let loadRequestId = 0

const activeWorkspaceId = computed(() => String(route.params.workspaceId))
const workspace = computed(
  () => workspaceStore.workspaces.find(({ id }) => id === activeWorkspaceId.value) || null,
)
const members = computed(() => getWorkspaceMembers(workspace.value, authUser.value))
const memberIds = computed(() => members.value.map(({ id }) => id))
const trackerWorkspaceName = computed(() => workspace.value?.name || t('navigation.workspaces'))
const enabledCategories = computed(() => {
  const enabled = new Set(trackingStore.enabledSubcategories)
  return expenseTrackingCategories.filter(({ id }) => enabled.has(id))
})
const reviewGroups = computed(() =>
  groupedExpenseTrackingCategories(
    reviewExpenseTrackingCategories(
      enabledCategories.value.map(({ id }) => id),
      trackingStore.month,
    ),
  ).map((group) => ({
    ...group,
    subcategories: group.subcategories.map((subcategory) => ({
      ...subcategory,
      itemCount: trackingStore.itemsFor(subcategory.id).length,
      trackedTotal: trackingStore.totalFor(subcategory.id),
      modelValue: modelValue(subcategory),
      decision: decisionFor(subcategory.id),
      decisionDisabled: decisionDisabled(subcategory.id),
    })),
  })),
)
const reviewModelTotal = computed(() =>
  reviewGroups.value.reduce(
    (total, group) =>
      total + group.subcategories.reduce((groupTotal, item) => groupTotal + item.modelValue, 0),
    0,
  ),
)
const canMutateActiveSubcategory = computed(() => isTrackingEnabled(activeSubcategory.value?.id))
const categoriesWithTrackedItems = computed(() =>
  enabledCategories.value.filter(({ id }) => trackingStore.itemsFor(id).length),
)
const pageLoading = computed(() => preparing.value || trackingStore.loading)
const expensesRoute = computed(() => ({
  name: 'expenses',
  params: { workspaceId: activeWorkspaceId.value },
}))
const selectedYear = computed(() => Number(period.value.slice(0, 4)))
const financialYear = computed(() =>
  financialYearsStore.get(activeWorkspaceId.value, selectedYear.value),
)
const decisionOptions = computed(() => [
  { label: t('expenseTracker.review.useTracked'), value: 'tracked' },
  { label: t('expenseTracker.review.keepModel'), value: 'model' },
])
const periodLabel = computed(() => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period.value)) return ''
  const [year, month] = period.value.split('-').map(Number)
  return new Intl.DateTimeFormat(locale.value, { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1),
  )
})

watch(
  [activeWorkspaceId, period],
  ([workspaceId, selectedPeriod]) => {
    if (workspaceId && /^\d{4}-(0[1-9]|1[0-2])$/.test(selectedPeriod)) loadPage()
  },
  { immediate: true },
)
watch(activeWorkspaceId, () => {
  period.value = currentPeriod()
})
watch(tab, (value) => {
  if (value === 'track' && period.value !== currentPeriod()) period.value = currentPeriod()
})

async function loadPage(force = false) {
  const requestId = ++loadRequestId
  preparing.value = true
  pageError.value = null
  try {
    await Promise.all([
      // Always refresh the selected month so entries and decisions stay current.
      trackingStore.load(activeWorkspaceId.value, period.value, true),
      financialYearsStore.load(activeWorkspaceId.value, selectedYear.value, force),
    ])
    if (requestId !== loadRequestId) return
  } catch (error) {
    if (requestId === loadRequestId) pageError.value = error
  } finally {
    if (requestId === loadRequestId) preparing.value = false
  }
}

function openAdd(subcategory, fromItems = false) {
  if (!subcategory) return
  activeSubcategory.value = subcategory
  editingItem.value = null
  if (fromItems) itemsDialog.value = false
  entryDialog.value = true
}

function openEdit(item) {
  if (!canMutateActiveSubcategory.value) return
  editingItem.value = item
  itemsDialog.value = false
  entryDialog.value = true
}

function isTrackingEnabled(subcategoryId) {
  return trackingStore.enabledSubcategories.includes(subcategoryId)
}

function decisionDisabled(subcategoryId) {
  return (
    !isTrackingEnabled(subcategoryId) ||
    decisionSaving.value ||
    decisionSavingIds.value.has(subcategoryId)
  )
}

function openItems(subcategory) {
  activeSubcategory.value = subcategory
  editingItem.value = null
  itemsDialog.value = true
}

async function saveEntry(payload) {
  const itemId = editingItem.value?.id
  const saved = await persist(() =>
    itemId
      ? trackingStore.edit(
          activeWorkspaceId.value,
          period.value,
          activeSubcategory.value.id,
          itemId,
          payload,
          memberIds.value,
        )
      : trackingStore.add(
          activeWorkspaceId.value,
          period.value,
          activeSubcategory.value.id,
          payload,
          memberIds.value,
        ),
  )
  if (!saved) return
  entryDialog.value = false
  editingItem.value = null
}

function requestDelete(item) {
  deletingItem.value = item
  deleteDialog.value = true
}

async function deleteEntry() {
  if (!deletingItem.value || !activeSubcategory.value) return
  const saved = await persist(() =>
    trackingStore.remove(
      activeWorkspaceId.value,
      period.value,
      activeSubcategory.value.id,
      deletingItem.value.id,
    ),
  )
  if (saved) {
    deleteDialog.value = false
    deletingItem.value = null
  }
}

async function savePreferences(selected) {
  const saved = await persist(() =>
    trackingStore.savePreferences(activeWorkspaceId.value, selected),
  )
  if (saved) {
    expensesStore.reset()
    manageDialog.value = false
  }
}

function modelValue(subcategory) {
  return resolvedValue(subcategory).model
}

function currentModelValue(subcategory) {
  return (
    normalizeNonNegativeMoney(
      financialYear.value?.months?.[period.value.slice(5, 7)]?.expenses?.categories?.[
        subcategory.categoryId
      ]?.subcategories?.[subcategory.id]?.estimated,
    ) || 0
  )
}

function decisionFor(subcategoryId) {
  const subcategory = expenseTrackingCategories.find(({ id }) => id === subcategoryId)
  return subcategory ? resolvedValue(subcategory).source : 'model'
}

function reconciliationFor(subcategoryId) {
  return trackingStore.month?.reconciliation?.[subcategoryId] || null
}

function resolvedValue(subcategory) {
  const decision = reconciliationFor(subcategory.id)?.decision
  const hasActual = trackingStore.itemsFor(subcategory.id).length > 0 || decision === 'tracked'
  return resolveExpenseTrackingValue(
    currentModelValue(subcategory),
    hasActual ? trackingStore.totalFor(subcategory.id) : null,
    decision,
  )
}

async function setDecision(subcategory, decision) {
  decisionSavingIds.value = new Set(decisionSavingIds.value).add(subcategory.id)
  try {
    await trackingStore.saveReconciliation(
      activeWorkspaceId.value,
      period.value,
      subcategory.id,
      decision,
    )
    $q.notify({ type: 'positive', message: t('expenseTracker.sourceUpdated'), position: 'top' })
  } catch {
    $q.notify({ type: 'negative', message: t('expenseTracker.errors.sourceSave'), position: 'top' })
  } finally {
    const next = new Set(decisionSavingIds.value)
    next.delete(subcategory.id)
    decisionSavingIds.value = next
  }
}

async function applyAllTracked() {
  if (decisionSaving.value) return
  decisionSaving.value = true
  try {
    const subcategoryIds = categoriesWithTrackedItems.value.map(({ id }) => id)
    await trackingStore.saveReconciliations(
      activeWorkspaceId.value,
      period.value,
      subcategoryIds,
      'tracked',
    )
    applyAllDialog.value = false
    $q.notify({ type: 'positive', message: t('expenseTracker.sourcesUpdated'), position: 'top' })
  } catch {
    $q.notify({ type: 'negative', message: t('expenseTracker.errors.sourceSave'), position: 'top' })
  } finally {
    decisionSaving.value = false
  }
}

function requestApplyAllTracked() {
  if (!categoriesWithTrackedItems.value.length || decisionSaving.value) return
  applyAllDialog.value = true
}

function formatItemDate(value) {
  const date = value?.toDate ? value.toDate() : new Date(value)
  return new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short' }).format(date)
}

async function persist(operation, notify = true) {
  try {
    await operation()
    if (notify) {
      $q.notify({ type: 'positive', message: t('expenseTracker.saved'), position: 'top' })
    }
    return true
  } catch {
    $q.notify({ type: 'negative', message: t('expenseTracker.errors.save'), position: 'top' })
    return false
  }
}

function currentPeriod() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    timeZone: FINANCIAL_YEAR_TIME_ZONE,
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}`
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;

.tracker-page {
  @include financial-page;
}

.tracker-shell {
  @include financial-shell;
}

.tracker-header,
.items-heading,
.item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.tracker-header {
  @include financial-header;
  align-items: center;
}

.back-button {
  @include financial-back-button;
}

h1 {
  @include financial-title;
}

.workspace-name {
  margin: 0.5rem 0 0;
  color: var(--color-copy);
  font-size: 0.9rem;
  font-weight: 600;
  text-transform: capitalize;
}

.tracker-tabs {
  display: flex;
  flex: 0 0 13.5rem;
  align-self: center;
  padding: 0.16rem;
  overflow: hidden;
  border: 1px solid var(--color-ink);
  border-radius: 999px;
  background: var(--color-ink);
  box-shadow: 0 6px 18px rgb(11 22 51 / 10%);
}

.tracker-tabs button {
  flex: 1;
  min-height: 2.35rem;
  padding: 0.4rem 1rem;
  border: 0;
  border-radius: 999px !important;
  background: transparent;
  color: rgb(255 255 255 / 78%);
  font: inherit;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
}

.tracker-tabs button.selected {
  background: var(--color-surface);
  color: var(--color-ink);
  box-shadow: 0 2px 8px rgb(0 0 0 / 16%);
}

.tracker-tabs button:focus-visible {
  @include focus-ring;
}

.state {
  display: grid;
  min-height: 18rem;
  place-content: center;
  justify-items: center;
  text-align: center;
}

.state p {
  color: var(--color-copy);
}

.items-card {
  @include financial-dialog-card(40rem);
  display: flex;
  flex-direction: column;
}

.confirm-card {
  @include financial-simple-dialog;
}

.items-heading span {
  color: var(--color-copy);
  text-transform: capitalize;
}

.items-heading {
  @include financial-dialog-header;
}

.items-heading h2 {
  margin: 0.2rem 0 0;
}

.items-list {
  @include financial-dialog-body;
  display: grid;
  gap: 0.25rem;
}

.items-actions {
  @include financial-dialog-actions;
  justify-content: flex-end;
}

.item-row {
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--color-line);
}

.item-row > div:first-child {
  display: grid;
}

.item-row small,
.items-empty {
  color: var(--color-copy);
}

@media (max-width: 599px) {
  .tracker-page {
    padding-right: max(0.75rem, env(safe-area-inset-right));
    padding-bottom: calc(var(--mobile-nav-height) + 1.5rem);
    padding-left: max(0.75rem, env(safe-area-inset-left));
  }

  .tracker-header {
    align-items: flex-end;
    gap: 0.75rem;
  }

  .tracker-tabs {
    width: 8.5rem;
    flex-basis: auto;
  }

  .tracker-header h1 {
    font-size: 1.55rem;
  }

  .tracker-tabs button {
    min-height: 2rem;
    padding: 0.3rem 0.55rem;
    font-size: 0.72rem;
  }

  .workspace-name {
    margin-top: 0.2rem;
    font-size: 0.75rem;
  }
}
</style>
