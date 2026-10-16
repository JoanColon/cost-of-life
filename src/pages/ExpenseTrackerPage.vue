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

        <section v-if="tab === 'track'" class="track-panel">
          <div v-if="enabledCategories.length" class="tracking-grid">
            <button
              v-for="subcategory in enabledCategories"
              :key="subcategory.id"
              type="button"
              class="tracking-button"
              :class="`tracking-button--${subcategory.categoryId}`"
              @click="openAdd(subcategory)"
            >
              <span class="tracking-icon">
                <q-icon :name="subcategory.icon" />
              </span>
              <span class="tracking-copy">
                <strong>{{ t(subcategory.nameKey) }}</strong>
                <small>{{ t(subcategory.categoryNameKey) }}</small>
              </span>
              <q-icon name="chevron_right" class="tracking-chevron" />
            </button>
          </div>
          <section v-else class="empty-card">
            <q-icon name="tune" />
            <h2>{{ t('expenseTracker.empty.title') }}</h2>
            <p>{{ t('expenseTracker.empty.description') }}</p>
            <q-btn
              unelevated
              no-caps
              color="primary"
              :label="t('expenseTracker.manage.action')"
              @click="manageDialog = true"
            />
          </section>
          <q-btn
            v-if="enabledCategories.length"
            flat
            no-caps
            icon="tune"
            color="primary"
            :label="t('expenseTracker.manage.editAction')"
            class="edit-tracker-categories"
            @click="manageDialog = true"
          />
        </section>

        <section v-else class="review-panel">
          <div class="review-toolbar">
            <q-input
              v-model="period"
              outlined
              dense
              type="month"
              :label="t('expenseTracker.review.month')"
              class="month-input"
            />
            <div class="month-total">
              <span>{{ t('expenseTracker.review.trackedTotal') }}</span>
              <strong>{{ formatCurrency(trackingStore.month?.total || 0) }}</strong>
            </div>
            <div class="month-total">
              <span>{{ t('expenseTracker.review.modelTotal') }}</span>
              <strong>{{ formatCurrency(reviewModelTotal) }}</strong>
            </div>
            <div class="review-toolbar-action">
              <q-btn
                unelevated
                no-caps
                color="primary"
                :disable="decisionSaving || !categoriesWithTrackedItems.length"
                :label="t('expenseTracker.review.useAllTracked')"
                @click="applyAllTracked"
              />
            </div>
          </div>

          <div class="review-groups">
            <section
              v-for="group in reviewGroups"
              :key="group.id"
              class="review-group"
              :class="`tracking-button--${group.id}`"
            >
              <h2>
                <span class="review-group-icon"><q-icon :name="group.icon" /></span>
                {{ t(group.nameKey) }}
              </h2>
              <div class="review-list">
                <article
                  v-for="subcategory in group.subcategories"
                  :key="subcategory.id"
                  class="review-row"
                >
                  <button type="button" class="review-name" @click="openItems(subcategory)">
                    <span>
                      <strong>{{ t(subcategory.nameKey) }}</strong>
                      <q-icon name="chevron_right" />
                    </span>
                    <small>
                      {{
                        t('expenseTracker.review.itemCount', {
                          count: trackingStore.itemsFor(subcategory.id).length,
                        })
                      }}
                    </small>
                  </button>
                  <div class="review-value">
                    <span>{{ t('expenseTracker.review.tracked') }}</span>
                    <strong>{{ formatCurrency(trackingStore.totalFor(subcategory.id)) }}</strong>
                  </div>
                  <div class="review-value">
                    <span>{{ t('expenseTracker.review.model') }}</span>
                    <strong>{{ formatCurrency(modelValue(subcategory)) }}</strong>
                  </div>
                  <q-btn
                    flat
                    dense
                    no-caps
                    color="primary"
                    :label="t('expenseTracker.review.view')"
                    @click="openItems(subcategory)"
                  />
                  <div class="review-decisions" role="group" :aria-label="t(subcategory.nameKey)">
                    <button
                      v-for="option in decisionOptions"
                      :key="option.value"
                      type="button"
                      class="review-decision"
                      :class="{ selected: decisionFor(subcategory.id) === option.value }"
                      :disabled="decisionDisabled(subcategory.id)"
                      @click="setDecision(subcategory, option.value)"
                    >
                      <q-icon v-if="decisionFor(subcategory.id) === option.value" name="check" />
                      {{ option.label }}
                    </button>
                  </div>
                </article>
              </div>
            </section>
          </div>
        </section>
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
        <q-card-actions v-if="canMutateActiveSubcategory" align="right">
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
import {
  expenseTrackingCategories,
  groupedExpenseTrackingCategories,
  reviewExpenseTrackingCategories,
} from '@/config/expense-tracking-categories'
import { resolveExpenseTrackingValue } from '@/domain/financial/expense-tracking'
import { FINANCIAL_YEAR_TIME_ZONE } from '@/domain/financial/financial-year'
import { normalizeMoney } from '@/domain/financial/money'
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
  ),
)
const reviewModelTotal = computed(() =>
  reviewGroups.value.reduce(
    (total, group) =>
      total + group.subcategories.reduce((groupTotal, item) => groupTotal + modelValue(item), 0),
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
    normalizeMoney(
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
  decisionSaving.value = true
  try {
    const subcategoryIds = categoriesWithTrackedItems.value.map(({ id }) => id)
    await trackingStore.saveReconciliations(
      activeWorkspaceId.value,
      period.value,
      subcategoryIds,
      'tracked',
    )
    $q.notify({ type: 'positive', message: t('expenseTracker.sourcesUpdated'), position: 'top' })
  } catch {
    $q.notify({ type: 'negative', message: t('expenseTracker.errors.sourceSave'), position: 'top' })
  } finally {
    decisionSaving.value = false
  }
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
.review-toolbar,
.review-row,
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

.track-panel,
.review-panel {
  margin-top: 2rem;
}

.review-groups {
  display: grid;
  gap: 1rem;
}

.review-group h2 {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  margin: 0 0 0.55rem;
  padding-left: 0.5rem;
  font-size: 1.05rem;
}

.tracking-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.1rem;
}

.tracking-button {
  display: grid;
  grid-template-columns: 3.1rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.9rem;
  min-height: 5.2rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--color-line);
  border-radius: 0.7rem !important;
  background: var(--color-surface);
  color: var(--color-ink);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 150ms ease,
    box-shadow 150ms ease,
    transform 150ms ease;
}

.tracking-button:hover {
  border-color: color-mix(in srgb, var(--tracking-color, var(--color-primary)) 45%, white);
  box-shadow: 0 8px 22px rgb(34 55 78 / 8%);
  transform: translateY(-1px);
}

.tracking-button:focus-visible {
  @include focus-ring;
}

.tracking-icon {
  display: grid;
  place-items: center;
  width: 3.1rem;
  height: 3.1rem;
  border-radius: 50%;
  background: var(--tracking-soft, var(--color-blue-soft));
  color: var(--tracking-color, var(--color-primary));
}

.tracking-icon .q-icon {
  font-size: 1.55rem;
}

.tracking-copy {
  display: grid;
  min-width: 0;
  gap: 0.2rem;
}

.tracking-copy strong,
.tracking-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tracking-copy strong {
  font-size: 1.04rem;
}

.tracking-copy small {
  color: var(--color-copy);
  font-size: 0.86rem;
}

.tracking-chevron {
  color: var(--color-ink);
  font-size: 1.3rem;
}

.tracking-button--housing {
  --tracking-color: #c92f3f;
  --tracking-soft: #ffe1e4;
}

.tracking-button--transportation {
  --tracking-color: #087cf0;
  --tracking-soft: #e6f1ff;
}

.tracking-button--food {
  --tracking-color: #f08a00;
  --tracking-soft: #fff0cc;
}

.tracking-button--utilities {
  --tracking-color: #526d82;
  --tracking-soft: #e7eef3;
}

.tracking-button--healthcare {
  --tracking-color: #07958a;
  --tracking-soft: #dff7f4;
}

.tracking-button--debt {
  --tracking-color: #9a5b32;
  --tracking-soft: #f7ebe3;
}

.tracking-button--personal {
  --tracking-color: #7146e8;
  --tracking-soft: #f0eaff;
}

.tracking-button--leisure {
  --tracking-color: #10ae61;
  --tracking-soft: #e2f8eb;
}

.tracking-button--travel {
  --tracking-color: #b326d1;
  --tracking-soft: #f7e5ff;
}

.tracking-button--education_childcare {
  --tracking-color: #0789a8;
  --tracking-soft: #e1f5fa;
}

.edit-tracker-categories {
  margin-top: 1rem;
  margin-left: -0.75rem;
}

.empty-card,
.state {
  display: grid;
  min-height: 18rem;
  place-content: center;
  justify-items: center;
  text-align: center;
}

.empty-card p,
.state p {
  color: var(--color-copy);
}

.review-toolbar {
  min-height: 5.8rem;
  margin-bottom: 1.35rem;
  padding: 1rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: 0 8px 24px rgb(34 55 78 / 4%);
}

.month-input {
  width: 15rem;
  margin-right: auto;
}

.month-total {
  display: grid;
  min-width: 8.5rem;
  gap: 0.15rem;
}

.month-total span,
.review-value span {
  color: var(--color-copy);
  font-size: 0.75rem;
}

.month-total strong {
  color: var(--color-ink);
  font-size: 1.65rem;
  line-height: 1;
}

.review-toolbar-action {
  align-self: stretch;
  display: flex;
  align-items: center;
  padding-left: 1.25rem;
  border-left: 1px solid var(--color-line);
}

.review-toolbar-action .q-btn {
  min-height: 3rem;
  padding-inline: 1.15rem;
}

.review-group-icon {
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 50%;
  background: var(--tracking-soft, var(--color-blue-soft));
  color: var(--tracking-color, var(--color-primary));
  font-size: 1.35rem;
}

.review-list {
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: 0 6px 20px rgb(34 55 78 / 3%);
}

.review-row {
  display: grid;
  grid-template-columns: minmax(12rem, 1fr) 6rem 6rem auto minmax(15rem, auto);
  min-height: 4.6rem;
  padding: 0.65rem 1rem;
  border-bottom: 1px solid var(--color-line);
}

.review-row:last-child {
  border-bottom: 0;
}

.review-value {
  display: grid;
}

.review-name {
  display: grid;
  justify-items: start;
  min-width: 10rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-ink);
  text-align: left;
  cursor: pointer;
}

.review-name > span {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.review-name .q-icon {
  font-size: 1.15rem;
}

.review-name small {
  color: var(--color-copy);
  font-size: 0.78rem;
}

.review-value {
  gap: 0.15rem;
  text-align: left;
}

.review-value strong {
  font-size: 0.95rem;
}

.review-decisions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.25rem;
}

.review-decision {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 2.4rem;
  padding: 0.45rem 0.8rem;
  border: 0;
  border-radius: 999px !important;
  background: transparent;
  color: var(--color-copy);
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.review-decision.selected {
  background: var(--color-blue-soft);
  color: #0759b8;
}

.review-decision:disabled {
  cursor: default;
  opacity: 0.5;
}

.review-decision:not(:disabled):focus-visible {
  @include focus-ring;
}

.items-card {
  width: min(40rem, calc(100vw - 2rem));
  max-height: calc(100dvh - 2rem);
  overflow: auto;
}

.items-heading span {
  color: var(--color-copy);
  text-transform: capitalize;
}

.items-heading h2 {
  margin: 0.2rem 0 0;
}

.items-list {
  display: grid;
  gap: 0.25rem;
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

@media (max-width: 899px) {
  .tracking-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .review-row {
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem 1rem;
    padding: 0.9rem 1rem;
  }

  .review-name,
  .review-decisions {
    grid-column: 1 / -1;
  }

  .review-decisions {
    justify-content: flex-start;
  }
}

@media (max-width: 599px) {
  .tracker-page {
    padding-right: max(0.75rem, env(safe-area-inset-right));
    padding-bottom: calc(var(--mobile-nav-height) + 1.5rem);
    padding-left: max(0.75rem, env(safe-area-inset-left));
  }

  .tracker-header {
    align-items: stretch;
    flex-direction: column;
    gap: 1.25rem;
  }

  .tracker-tabs {
    width: 100%;
    flex-basis: auto;
  }

  .track-panel,
  .review-panel {
    margin-top: 1.5rem;
  }

  .tracking-grid {
    grid-template-columns: 1fr;
  }

  .review-toolbar {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .month-input {
    width: auto;
    margin-right: 0;
    grid-column: 1 / -1;
  }

  .review-toolbar-action {
    grid-column: 1 / -1;
    justify-content: stretch;
    padding-top: 0.75rem;
    padding-left: 0;
    border-top: 1px solid var(--color-line);
    border-left: 0;
  }

  .review-toolbar-action .q-btn {
    width: 100%;
  }

  .review-row > .q-btn {
    justify-self: start;
  }
}
</style>
