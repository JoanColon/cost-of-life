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
          </div>
        </header>

        <ExpensesSectionNav
          :workspace-id="activeWorkspaceId"
          :active="tab"
          :context="trackerContext"
        />

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
        :subcategories="availableTrackingCategories"
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
      :expense-items="activeExpenseItems"
      :period="period"
      :members="members"
      :preferred-member-id="authUser?.uid"
      :saving="trackingStore.saving"
      @save="saveEntry"
    />

    <q-dialog v-model="itemsDialog" :position="$q.screen.lt.sm ? 'bottom' : undefined">
      <q-card
        class="items-card"
        :class="activeSubcategory ? `tracking-category--${activeSubcategory.categoryId}` : ''"
      >
        <span class="sheet-handle" aria-hidden="true" />
        <q-card-section class="items-heading">
          <span class="items-category-icon">
            <q-icon :name="activeSubcategory?.icon" />
          </span>
          <div class="items-title">
            <span>{{ periodLabel }}</span>
            <h2>{{ activeSubcategory ? t(activeSubcategory.nameKey) : '' }}</h2>
            <strong>{{ formatCurrency(activeTrackedTotal) }}</strong>
            <small>{{
              t('expenseTracker.review.itemCount', { count: activeTrackedItems.length })
            }}</small>
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
          <div class="items-summary">
            <div>
              <q-icon name="monitoring" />
              <span>
                <strong>{{ formatCurrency(averageTrackedAmount) }}</strong>
                <small>{{ t('expenseTracker.detail.average') }}</small>
              </span>
            </div>
            <div>
              <q-icon name="receipt_long" />
              <span>
                <strong>{{ activeTrackedItems.length }}</strong>
                <small>{{ t('expenseTracker.detail.transactions') }}</small>
              </span>
            </div>
          </div>
          <div v-if="activeExpenseItems.length" class="item-breakdown">
            <div v-for="expenseItem in activeExpenseItems" :key="expenseItem.id">
              <span>{{ expenseItem.itemName }}</span>
              <strong>{{
                formatCurrency(trackingStore.totalForItem(activeSubcategory.id, expenseItem.id))
              }}</strong>
            </div>
          </div>
          <article v-for="item in activeTrackedItems" :key="item.id" class="item-row">
            <time class="item-date" :datetime="itemDateIso(item.date)">
              <strong>{{ itemDateDay(item.date) }}</strong>
              <span>{{ itemDateMonth(item.date) }}</span>
            </time>
            <div class="item-copy">
              <strong>{{ formatCurrency(item.amount) }}</strong>
              <span v-if="trackedItemName(item)">{{ trackedItemName(item) }}</span>
              <small v-if="item.notes">{{ item.notes }}</small>
            </div>
            <OwnershipAvatar
              class="item-ownership"
              :ownership="item.ownership"
              :members="members"
              size="2.4rem"
            />
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
          <div v-if="!activeTrackedItems.length" class="items-empty">
            {{ t('expenseTracker.review.noItems') }}
          </div>
        </q-card-section>
        <q-card-actions v-if="canMutateActiveSubcategory" class="items-actions">
          <q-btn
            unelevated
            no-caps
            color="primary"
            icon="add"
            :label="t('expenseTracker.detail.addTransaction')"
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
import ExpensesSectionNav from '@/components/expenses/ExpensesSectionNav.vue'
import OwnershipAvatar from '@/components/financial/OwnershipAvatar.vue'
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
const tab = computed(() => (route.query.view === 'review' ? 'review' : 'track'))
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
const trackerContext = computed(() =>
  periodLabel.value
    ? `${periodLabel.value} · ${trackerWorkspaceName.value}`
    : trackerWorkspaceName.value,
)
const allExpenseItems = computed(() =>
  expensesStore.enabledCategories
    .flatMap((categoryId) => expensesStore.itemsForCategory(categoryId))
    .filter(({ entryMode }) => entryMode !== 'simple'),
)
const enabledCategories = computed(() => {
  const enabled = new Set(trackingStore.enabledSubcategories)
  return availableTrackingCategories.value.filter(({ id }) => enabled.has(id))
})
const availableTrackingCategories = computed(() => {
  const usedSubcategories = new Set(allExpenseItems.value.map(({ subcategoryId }) => subcategoryId))
  return expenseTrackingCategories.filter(({ id }) => usedSubcategories.has(id))
})
const activeExpenseItems = computed(() =>
  allExpenseItems.value.filter(
    ({ subcategoryId }) => subcategoryId === activeSubcategory.value?.id,
  ),
)
const activeTrackedItems = computed(() =>
  activeSubcategory.value ? trackingStore.itemsFor(activeSubcategory.value.id) : [],
)
const activeTrackedTotal = computed(() =>
  activeSubcategory.value ? trackingStore.totalFor(activeSubcategory.value.id) : 0,
)
const averageTrackedAmount = computed(() =>
  activeTrackedItems.value.length ? activeTrackedTotal.value / activeTrackedItems.value.length : 0,
)
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
      expensesStore.loadConfig(activeWorkspaceId.value, force),
    ])
    if (requestId !== loadRequestId) return
    await Promise.all(
      expensesStore.enabledCategories.map((categoryId) =>
        expensesStore.loadCategory(activeWorkspaceId.value, categoryId),
      ),
    )
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
          allExpenseItems.value,
        )
      : trackingStore.add(
          activeWorkspaceId.value,
          period.value,
          activeSubcategory.value.id,
          payload,
          memberIds.value,
          allExpenseItems.value,
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

function itemDate(value) {
  return value?.toDate ? value.toDate() : new Date(value)
}

function itemDateDay(value) {
  return new Intl.DateTimeFormat(locale.value, { day: '2-digit' }).format(itemDate(value))
}

function itemDateMonth(value) {
  return new Intl.DateTimeFormat(locale.value, { month: 'short' })
    .format(itemDate(value))
    .replace('.', '')
    .toUpperCase()
}

function itemDateIso(value) {
  const date = itemDate(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

function trackedItemName(entry) {
  return allExpenseItems.value.find(({ id }) => id === entry.itemId)?.itemName || ''
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
@use '@/css/expense-tracking' as tracking;

@include tracking.category-colors;

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
  --tracking-color: var(--color-primary);
  --tracking-soft: var(--color-blue-soft);
}

.confirm-card {
  @include financial-simple-dialog;
}

.sheet-handle {
  display: none;
}

.items-title > span {
  color: var(--color-copy);
  text-transform: capitalize;
}

.items-heading {
  @include financial-dialog-header;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
}

.items-heading h2 {
  margin: 0.2rem 0 0;
}

.items-category-icon {
  display: grid;
  width: 4.5rem;
  height: 4.5rem;
  place-items: center;
  border-radius: 50%;
  background: var(--tracking-soft);
  color: var(--tracking-color);
  font-size: 2rem;
}

.items-title {
  display: grid;
  min-width: 0;
}

.items-title > strong {
  margin-top: 0.65rem;
  color: var(--color-ink);
  font-size: 2rem;
  line-height: 1;
}

.items-title > small {
  margin-top: 0.3rem;
  color: var(--color-copy);
}

.items-list {
  @include financial-dialog-body;
  display: grid;
  gap: 1rem;
}

.items-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border-radius: 1rem;
  background: color-mix(in srgb, var(--tracking-soft) 55%, var(--color-surface));
}

.items-summary > div {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  min-width: 0;
  padding: 1rem;
}

.items-summary > div + div {
  border-left: 1px solid color-mix(in srgb, var(--tracking-color) 18%, transparent);
}

.items-summary .q-icon {
  flex: 0 0 auto;
  color: var(--tracking-color);
  font-size: 1.65rem;
}

.items-summary span {
  display: grid;
  min-width: 0;
}

.items-summary strong {
  color: var(--color-ink);
  font-size: 1.15rem;
}

.items-summary small {
  overflow: hidden;
  color: var(--color-copy);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.item-breakdown {
  display: grid;
  gap: 0.45rem;
  padding: 0.8rem 1rem;
  border: 1px solid var(--color-line);
  border-radius: 0.8rem;
  background: var(--color-surface-soft);
}

.item-breakdown > div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.items-actions {
  @include financial-dialog-actions;
  justify-content: flex-end;
}

.items-actions .q-btn {
  min-height: 2.75rem;
  padding-inline: 1.2rem;
}

.item-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 0.85rem;
  padding: 1rem;
  border: 1px solid var(--color-line);
  border-radius: 1rem;
  background: var(--color-surface);
}

.item-copy {
  display: grid;
  min-width: 0;
}

.item-copy > strong {
  color: var(--color-ink);
  font-size: 1.15rem;
}

.item-copy > span {
  margin-top: 0.15rem;
  color: var(--color-ink);
  font-weight: 600;
}

.item-copy > small {
  overflow: hidden;
  margin-top: 0.12rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-date {
  display: grid;
  width: 4rem;
  min-height: 4.4rem;
  place-content: center;
  justify-items: center;
  border-radius: 0.85rem;
  background: var(--color-surface-muted);
  color: var(--color-ink);
  font-style: normal;
}

.item-date strong {
  font-size: 1.25rem;
  line-height: 1;
}

.item-date span {
  margin-top: 0.3rem;
  color: var(--color-copy);
  font-size: 0.72rem;
  font-weight: 700;
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

  .items-card {
    width: 100vw;
    max-width: none;
    max-height: min(92dvh, 52rem);
    border-width: 1px 0 0;
    border-radius: 1.8rem 1.8rem 0 0;
  }

  .sheet-handle {
    display: block;
    flex: 0 0 auto;
    width: 3.25rem;
    height: 0.32rem;
    margin: 0.75rem auto 0;
    border-radius: 999px;
    background: var(--color-line-strong);
  }

  .items-heading {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 1rem;
    padding: 1rem 1.25rem 0.8rem;
  }

  .items-category-icon {
    width: 3.75rem;
    height: 3.75rem;
    font-size: 1.65rem;
  }

  .items-title h2 {
    font-size: 1.65rem;
  }

  .items-title > strong {
    font-size: 1.8rem;
  }

  .items-list {
    gap: 0.8rem;
    padding: 0.6rem 1rem 1rem;
  }

  .items-summary > div {
    gap: 0.6rem;
    padding: 0.85rem;
  }

  .items-summary .q-icon {
    font-size: 1.4rem;
  }

  .item-row {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 0.7rem;
    padding: 0.8rem;
  }

  .item-ownership {
    grid-column: 2;
    grid-row: 2;
    justify-self: start;
  }

  .item-actions {
    display: flex;
    grid-column: 3;
    grid-row: 1 / span 2;
    align-items: center;
  }

  .item-date {
    grid-row: 1 / span 2;
  }

  .items-actions {
    padding: 0.75rem max(1rem, env(safe-area-inset-right)) max(0.75rem, env(safe-area-inset-bottom))
      max(1rem, env(safe-area-inset-left));
  }

  .items-actions .q-btn {
    width: 100%;
    min-height: 3.5rem;
    border-radius: 0.85rem;
  }
}
</style>
