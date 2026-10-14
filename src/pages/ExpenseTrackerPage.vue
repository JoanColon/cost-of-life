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
          <div>
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
            <div class="eyebrow">{{ t('expenseTracker.eyebrow') }}</div>
            <h1>{{ t('expenseTracker.title') }}</h1>
            <p class="workspace-name">
              <q-icon name="workspaces_outline" />
              {{ workspace?.name || t('navigation.workspaces') }}
            </p>
          </div>
        </header>

        <q-tabs
          v-model="tab"
          dense
          no-caps
          align="left"
          active-color="primary"
          indicator-color="primary"
          class="tracker-tabs"
        >
          <q-tab name="track" :label="t('expenseTracker.tabs.track')" />
          <q-tab name="review" :label="t('expenseTracker.tabs.review')" />
        </q-tabs>

        <section v-if="tab === 'track'" class="track-panel">
          <div v-if="trackGroups.length" class="tracking-groups">
            <section v-for="group in trackGroups" :key="group.id" class="tracking-group">
              <h2><q-icon :name="group.icon" /> {{ t(group.nameKey) }}</h2>
              <div class="tracking-grid">
                <button
                  v-for="subcategory in group.subcategories"
                  :key="subcategory.id"
                  type="button"
                  class="tracking-button"
                  @click="openAdd(subcategory)"
                >
                  <q-icon :name="subcategory.icon" />
                  <strong>{{ t(subcategory.nameKey) }}</strong>
                  <small>{{ formatCurrency(trackingStore.totalFor(subcategory.id)) }}</small>
                </button>
              </div>
            </section>
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
            v-if="trackGroups.length"
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
            <q-btn-group unelevated>
              <q-btn
                no-caps
                color="white"
                text-color="grey-8"
                :disable="decisionSaving || !categoriesWithTrackedItems.length"
                :label="t('expenseTracker.review.useAllTracked')"
                @click="setGlobalDecision('tracked')"
              />
              <q-btn
                no-caps
                color="white"
                text-color="grey-8"
                :disable="decisionSaving || !hasTrackedDecisions"
                :label="t('expenseTracker.review.keepAllModel')"
                @click="setGlobalDecision('model')"
              />
            </q-btn-group>
          </div>

          <div class="review-groups">
            <section v-for="group in reviewGroups" :key="group.id" class="review-group">
              <h2><q-icon :name="group.icon" /> {{ t(group.nameKey) }}</h2>
              <article
                v-for="subcategory in group.subcategories"
                :key="subcategory.id"
                class="review-row"
              >
                <div class="review-name">
                  <strong>{{ t(subcategory.nameKey) }}</strong>
                  <small>
                    {{
                      t('expenseTracker.review.itemCount', {
                        count: trackingStore.itemsFor(subcategory.id).length,
                      })
                    }}
                  </small>
                </div>
                <div class="review-value">
                  <span>{{ t('expenseTracker.review.tracked') }}</span>
                  <strong>{{ formatCurrency(trackingStore.totalFor(subcategory.id)) }}</strong>
                </div>
                <div class="review-value">
                  <span>{{ t('expenseTracker.review.model') }}</span>
                  <strong>{{ formatCurrency(modelValue(subcategory)) }}</strong>
                </div>
                <div class="review-actions">
                  <q-btn
                    flat
                    dense
                    no-caps
                    color="primary"
                    :label="t('expenseTracker.review.view')"
                    @click="openItems(subcategory)"
                  />
                  <q-btn-toggle
                    :model-value="decisionFor(subcategory.id)"
                    no-caps
                    unelevated
                    toggle-color="primary"
                    color="white"
                    text-color="grey-8"
                    :disable="
                      !isCurrentlyAvailable(subcategory.id) ||
                      decisionSaving ||
                      decisionSavingIds.has(subcategory.id)
                    "
                    :options="decisionOptions"
                    @update:model-value="setDecision(subcategory, $event)"
                  />
                </div>
              </article>
            </section>
          </div>
        </section>
      </template>
    </main>

    <q-dialog v-model="manageDialog" :maximized="$q.screen.lt.sm">
      <ExpenseTrackingCategorySetup
        :initial-selected="trackingStore.enabledSubcategories"
        :subcategories="availableCategories"
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
          <q-btn flat round dense icon="close" :aria-label="t('common.cancel')" v-close-popup />
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
import { useFinancialYearsStore } from '@/stores/financial-years-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { formatCurrency } from '@/utils/formatters'
import { getWorkspaceMembers } from '@/utils/workspace-members'

const $q = useQuasar()
const { t, locale } = useI18n()
const route = useRoute()
const trackingStore = useExpenseTrackingStore()
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
const enabledCategories = computed(() => {
  const enabled = new Set(trackingStore.enabledSubcategories)
  return availableCategories.value.filter(({ id }) => enabled.has(id))
})
const availableCategories = computed(() => {
  const available = new Set(trackingStore.availableSubcategories)
  return expenseTrackingCategories.filter(({ id }) => available.has(id))
})
const trackGroups = computed(() => groupedExpenseTrackingCategories(enabledCategories.value))
const reviewGroups = computed(() =>
  groupedExpenseTrackingCategories(
    reviewExpenseTrackingCategories(
      enabledCategories.value.map(({ id }) => id),
      trackingStore.month,
    ),
  ),
)
const canMutateActiveSubcategory = computed(() => isCurrentlyAvailable(activeSubcategory.value?.id))
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
const hasTrackedDecisions = computed(() =>
  enabledCategories.value.some(({ id }) => decisionFor(id) === 'tracked'),
)
const periodLabel = computed(() => {
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
  if (!subcategory || !isCurrentlyAvailable(subcategory.id)) return
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

function isCurrentlyAvailable(subcategoryId) {
  return trackingStore.availableSubcategories.includes(subcategoryId)
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
  if (saved) manageDialog.value = false
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

async function setGlobalDecision(decision) {
  decisionSaving.value = true
  try {
    const subcategoryIds =
      decision === 'tracked'
        ? categoriesWithTrackedItems.value.map(({ id }) => id)
        : enabledCategories.value
            .filter(({ id }) => decisionFor(id) === 'tracked')
            .map(({ id }) => id)
    await trackingStore.saveReconciliations(
      activeWorkspaceId.value,
      period.value,
      subcategoryIds,
      decision,
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
  min-height: calc(100vh - 64px);
  padding: clamp(1rem, 2vw, 2rem);
  background: var(--color-page);
}

.tracker-shell {
  width: 100%;
  max-width: var(--content-max-width);
  margin: 0 auto;
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
  align-items: flex-end;
}

.back-button {
  margin: 0 0 1rem -0.5rem;
}

.eyebrow {
  color: var(--color-primary);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

h1 {
  margin: 0.15rem 0 0;
  font-size: clamp(2rem, 4vw, 3rem);
  letter-spacing: -0.055em;
}

.workspace-name {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0.5rem 0 0;
  color: var(--color-copy);
}

.tracker-tabs {
  margin: 1rem 0;
  border-bottom: 1px solid var(--color-line);
}

.tracking-groups,
.review-groups {
  display: grid;
  gap: 0.7rem;
}

.tracking-group {
  display: grid;
  grid-template-columns: minmax(15rem, 17rem) minmax(0, 1fr);
  align-items: center;
  gap: 1.25rem;
  min-height: 4.4rem;
  padding: 0.7rem 0;
  border-bottom: 1px solid var(--color-line);
}

.tracking-group h2,
.review-group h2 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 0.75rem;
  font-size: 1rem;
}

.tracking-group h2 {
  width: auto;
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.25;
  white-space: nowrap;
}

.tracking-grid {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.tracking-button {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 2.15rem;
  padding: 0.3rem 0.65rem;
  border: 1px solid var(--color-line);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-ink);
  cursor: pointer;
}

.tracking-button:hover {
  border-color: var(--color-primary);
}

.tracking-button:focus-visible {
  @include focus-ring;
}

.tracking-button .q-icon {
  color: var(--color-primary);
  font-size: 1.05rem;
}

.tracking-button small {
  padding-left: 0.4rem;
  border-left: 1px solid var(--color-line);
  color: var(--color-copy);
}

.edit-tracker-categories {
  margin-top: 0.75rem;
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
  margin-bottom: 1rem;
  padding: 0.75rem;
  border: 1px solid var(--color-line);
  border-radius: 1rem;
  background: var(--color-surface);
}

.month-input {
  width: 12rem;
}

.month-total {
  display: grid;
  margin-left: auto;
}

.month-total span,
.review-value span {
  color: var(--color-copy);
  font-size: 0.75rem;
}

.month-total strong {
  font-size: 1.5rem;
}

.review-group {
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: 1rem;
  background: var(--color-surface);
}

.review-group h2 {
  margin: 0;
  padding: 0.75rem;
  border-bottom: 1px solid var(--color-line);
}

.review-row {
  padding: 0.75rem;
  border-bottom: 1px solid var(--color-line);
}

.review-row:last-child {
  border-bottom: 0;
}

.review-name,
.review-value {
  display: grid;
}

.review-name {
  min-width: 10rem;
  flex: 1;
}

.review-name small {
  color: var(--color-copy);
}

.review-value {
  min-width: 6rem;
  text-align: right;
}

.review-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
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
  .review-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .review-name,
  .review-actions {
    grid-column: 1 / -1;
  }

  .review-value {
    text-align: left;
  }
}

@media (max-width: 699px) {
  .tracking-group {
    grid-template-columns: 1fr;
    gap: 0.65rem;
  }

  .tracking-group h2 {
    padding-left: 0.15rem;
    white-space: normal;
  }
}

@media (max-width: 599px) {
  .tracker-page {
    padding-right: max(0.75rem, env(safe-area-inset-right));
    padding-bottom: calc(var(--mobile-nav-height) + 1.5rem);
    padding-left: max(0.75rem, env(safe-area-inset-left));
  }

  .tracker-header {
    align-items: flex-start;
  }

  .review-toolbar {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .month-input {
    width: auto;
  }

  .review-toolbar > :last-child {
    grid-column: 1 / -1;
  }

  .review-actions {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
