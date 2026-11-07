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

        <template v-if="tab === 'track'">
          <section class="monthly-overview">
            <nav class="track-mode-nav" :aria-label="t('expenseTracker.modes.label')">
              <button
                type="button"
                :class="{ active: trackMode === 'record' }"
                :aria-pressed="trackMode === 'record'"
                @click="setTrackMode('record')"
              >
                <q-icon name="edit" />
                {{ t('expenseTracker.modes.record') }}
              </button>
              <button
                type="button"
                :class="{ active: trackMode === 'reconcile' }"
                :aria-pressed="trackMode === 'reconcile'"
                @click="setTrackMode('reconcile')"
              >
                <q-icon name="bar_chart" />
                {{ t('expenseTracker.modes.reconcile') }}
              </button>
            </nav>
            <span class="monthly-spacer" aria-hidden="true" />
            <ExpenseMonthMetric
              v-model="period"
              class="month-metric"
              :label="t('expenseTracker.review.month')"
            />
            <div class="monthly-metric">
              <span>{{ t('expenseTracker.summary.spent') }}</span>
              <strong>{{ formatCurrency(monthlySpent) }}</strong>
            </div>
            <div class="monthly-metric">
              <span>{{ t('expenseTracker.summary.planned') }}</span>
              <strong>{{ formatCurrency(reviewModelTotal) }}</strong>
            </div>
            <div class="monthly-metric" :class="{ over: monthlyRemaining < 0 }">
              <span>{{ t('expenseTracker.summary.remaining') }}</span>
              <strong>{{ formatCurrency(monthlyRemaining) }}</strong>
            </div>
          </section>

          <ExpenseTrackingPanel
            v-if="trackMode === 'record'"
            :categories="enabledCategories"
            @add="openAdd"
            @manage="manageDialog = true"
          />

          <ExpenseReviewPanel
            v-else
            :groups="reviewGroups"
            :can-use-all-tracked="Boolean(categoriesWithTrackedItems.length)"
            :saving="decisionSaving"
            @view-group="openReviewGroup"
            @use-all-tracked="requestApplyAllTracked"
          />
        </template>

        <ExpenseAnalyticsPanel v-else v-model="period" :categories="analyticsCategories" />
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

    <q-dialog v-model="reviewDialog" :position="$q.screen.lt.sm ? 'bottom' : undefined">
      <q-card
        class="review-dialog-card"
        :class="`tracking-category--${activeReviewGroup?.id || activeSubcategory?.categoryId || ''}`"
      >
        <span class="sheet-handle" aria-hidden="true" />
        <q-card-section class="review-dialog-heading">
          <q-btn
            v-if="activeSubcategory"
            flat
            round
            dense
            icon="arrow_back"
            class="review-back"
            :aria-label="t('expenseTracker.review.backToGroup')"
            @click="activeSubcategory = null"
          />
          <span v-else class="items-category-icon">
            <q-icon :name="activeReviewGroup?.icon" />
          </span>
          <div class="items-title">
            <span>{{ periodLabel }}</span>
            <h2>{{ reviewDialogTitle }}</h2>
          </div>
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
        </q-card-section>

        <q-card-section v-if="!activeSubcategory && activeReviewGroup" class="review-group-detail">
          <section class="review-progress-card">
            <div class="review-progress-heading">
              <div>
                <span>{{ t('expenseTracker.review.spentThisMonth') }}</span>
                <p>
                  <strong>{{ formatCurrency(groupTrackedTotal(activeReviewGroup)) }}</strong>
                  <span>/ {{ formatCurrency(groupModelTotal(activeReviewGroup)) }}</span>
                </p>
              </div>
              <span class="review-progress-badge" :class="groupPlanTone">
                <q-icon :name="groupPlanPercentage > 100 ? 'arrow_upward' : 'arrow_downward'" />
                <strong>{{ formatPercentage(groupPlanPercentage) }}</strong>
                {{ t('expenseTracker.review.ofPlan') }}
              </span>
            </div>
            <div class="review-progress-track" aria-hidden="true">
              <span :class="groupPlanTone" :style="{ width: `${groupPlanProgress}%` }" />
            </div>
          </section>

          <div class="review-subcategories-heading">
            <h3>{{ t('expenseTracker.review.subcategories') }}</h3>
            <span>
              <q-icon name="info_outline" />
              {{ t('expenseTracker.review.chooseAmount') }}
            </span>
          </div>

          <article
            v-for="subcategory in activeReviewGroup.subcategories"
            :key="subcategory.id"
            class="review-category-row"
          >
            <button
              type="button"
              class="review-category-identity"
              @click="openSubcategory(subcategory)"
            >
              <span class="review-category-icon"><q-icon :name="subcategory.icon" /></span>
              <span class="review-category-copy">
                <strong>{{ t(subcategory.nameKey) }}</strong>
                <small>{{
                  t('expenseTracker.review.itemCount', { count: subcategory.itemCount })
                }}</small>
              </span>
            </button>
            <div class="review-category-values">
              <span>
                <small>{{ t('expenseTracker.review.actual') }}</small>
                <strong>{{ formatCurrency(subcategory.trackedTotal) }}</strong>
              </span>
              <span>
                <small>{{ t('expenseTracker.review.planned') }}</small>
                <strong>{{ formatCurrency(subcategory.modelValue) }}</strong>
              </span>
            </div>
            <div
              class="review-category-decisions"
              role="group"
              :aria-label="t(subcategory.nameKey)"
            >
              <button
                v-for="option in decisionOptions"
                :key="option.value"
                type="button"
                class="review-category-decision"
                :class="{ selected: draftDecisionFor(subcategory) === option.value }"
                :disabled="decisionSaving"
                @click="setDraftDecision(subcategory, option.value)"
              >
                {{ option.label }}
              </button>
            </div>
            <q-btn
              flat
              round
              dense
              icon="chevron_right"
              color="primary"
              class="review-category-open"
              :aria-label="t('expenseTracker.review.view')"
              @click="openSubcategory(subcategory)"
            />
          </article>

          <div class="review-plan-note">
            <q-icon name="info_outline" />
            <span>{{ t('expenseTracker.review.updateNote') }}</span>
          </div>
        </q-card-section>

        <q-card-section v-else-if="activeSubcategory" class="items-list">
          <div class="subcategory-total">
            <strong>{{ formatCurrency(activeTrackedTotal) }}</strong>
            <span>{{
              t('expenseTracker.review.itemCount', { count: activeTrackedItems.length })
            }}</span>
          </div>
          <div class="items-summary">
            <div>
              <span class="items-summary-icon" aria-hidden="true">
                <q-icon name="show_chart" />
              </span>
              <span>
                <strong>{{ formatCurrency(averageTrackedAmount) }}</strong>
                <small>{{ t('expenseTracker.detail.average') }}</small>
              </span>
            </div>
            <div>
              <span class="items-summary-icon" aria-hidden="true">
                <q-icon name="receipt_long" />
              </span>
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
            <div class="item-controls">
              <OwnershipAvatar
                class="item-ownership"
                :ownership="item.ownership"
                :members="members"
                size="2rem"
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
            </div>
          </article>
          <div v-if="!activeTrackedItems.length" class="items-empty">
            {{ t('expenseTracker.review.noItems') }}
          </div>
        </q-card-section>
        <q-card-actions v-if="!activeSubcategory && activeReviewGroup" class="review-plan-actions">
          <q-btn flat no-caps :label="t('common.cancel')" :disable="decisionSaving" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="positive"
            class="app-btn--wide"
            icon="check"
            :label="t('expenseTracker.review.updatePlan')"
            :loading="decisionSaving"
            :disable="!hasDraftChanges"
            @click="saveDraftDecisions"
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
import { useRoute, useRouter } from 'vue-router'
import ExpenseAnalyticsPanel from '@/components/expenses/ExpenseAnalyticsPanel.vue'
import ExpenseMonthMetric from '@/components/expenses/ExpenseMonthMetric.vue'
import ExpenseTrackingCategorySetup from '@/components/expenses/ExpenseTrackingCategorySetup.vue'
import ExpenseTrackingEntryDialog from '@/components/expenses/ExpenseTrackingEntryDialog.vue'
import ExpenseTrackingPanel from '@/components/expenses/ExpenseTrackingPanel.vue'
import ExpenseReviewPanel from '@/components/expenses/ExpenseReviewPanel.vue'
import ExpensesSectionNav from '@/components/expenses/ExpensesSectionNav.vue'
import OwnershipAvatar from '@/components/financial/OwnershipAvatar.vue'
import { expenseCategories } from '@/config/expense-categories'
import {
  expenseTrackingCategories,
  groupedExpenseTrackingCategories,
  reviewExpenseTrackingCategories,
} from '@/config/expense-tracking-categories'
import { resolveExpenseTrackingValue } from '@/domain/financial/expense-tracking'
import {
  FINANCIAL_YEAR_TIME_ZONE,
  financialYearMonthCategoryValue,
  financialYearMonthSubcategoryValue,
} from '@/domain/financial/financial-year'
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
const router = useRouter()
const trackingStore = useExpenseTrackingStore()
const expensesStore = useExpensesStore()
const financialYearsStore = useFinancialYearsStore()
const workspaceStore = useWorkspaceStore()
const tab = computed(() => (route.query.view === 'review' ? 'review' : 'track'))
const trackMode = computed(() => (route.query.mode === 'reconcile' ? 'reconcile' : 'record'))
const period = ref(currentPeriod())
const pageError = ref(null)
const preparing = ref(false)
const manageDialog = ref(false)
const entryDialog = ref(false)
const reviewDialog = ref(false)
const deleteDialog = ref(false)
const applyAllDialog = ref(false)
const activeReviewGroupId = ref(null)
const activeSubcategory = ref(null)
const editingItem = ref(null)
const deletingItem = ref(null)
const decisionSaving = ref(false)
const draftDecisions = ref({})
let loadRequestId = 0

const activeWorkspaceId = computed(() => String(route.params.workspaceId))
const workspace = computed(
  () => workspaceStore.workspaces.find(({ id }) => id === activeWorkspaceId.value) || null,
)
const members = computed(() => getWorkspaceMembers(workspace.value, authUser.value))
const memberIds = computed(() => members.value.map(({ id }) => id))
const trackerWorkspaceName = computed(() => workspace.value?.name || t('navigation.workspaces'))
const trackerContext = computed(() => trackerWorkspaceName.value)
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
const reviewDialogTitle = computed(() =>
  activeSubcategory.value
    ? t(activeSubcategory.value.nameKey)
    : activeReviewGroup.value
      ? t(activeReviewGroup.value.nameKey)
      : '',
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
    })),
  })),
)
const activeReviewGroup = computed(
  () => reviewGroups.value.find(({ id }) => id === activeReviewGroupId.value) || null,
)
const groupPlanPercentage = computed(() => {
  if (!activeReviewGroup.value) return 0
  const planned = groupModelTotal(activeReviewGroup.value)
  const actual = groupTrackedTotal(activeReviewGroup.value)
  if (planned <= 0) return actual > 0 ? 100 : 0
  return (actual / planned) * 100
})
const groupPlanProgress = computed(() => Math.min(100, Math.max(0, groupPlanPercentage.value)))
const groupPlanTone = computed(() => (groupPlanPercentage.value > 100 ? 'over' : 'under'))
const hasDraftChanges = computed(() =>
  Boolean(
    activeReviewGroup.value?.subcategories.some(
      (subcategory) => draftDecisionFor(subcategory) !== subcategory.decision,
    ),
  ),
)
const reviewModelTotal = computed(() =>
  reviewGroups.value.reduce(
    (total, group) =>
      total + group.subcategories.reduce((groupTotal, item) => groupTotal + item.modelValue, 0),
    0,
  ),
)
const monthlySpent = computed(() => Number(trackingStore.month?.total || 0))
const monthlyRemaining = computed(() => reviewModelTotal.value - monthlySpent.value)
const analyticsCategories = computed(() => {
  const month = period.value.slice(5, 7)
  const categories = expenseCategories
    .map((category) => {
      const storedSubcategories =
        financialYear.value?.months?.[month]?.expenses?.categories?.[category.id]?.subcategories ||
        {}
      const subcategoryIds = new Set([
        ...category.suggestions.map(({ id }) => id),
        ...Object.keys(storedSubcategories),
      ])
      const subcategories = [...subcategoryIds]
        .map((subcategoryId) => {
          const definition = category.suggestions.find(({ id }) => id === subcategoryId)
          return {
            id: subcategoryId,
            name: definition ? t(definition.nameKey) : subcategoryId.replaceAll('_', ' '),
            value: financialYearMonthSubcategoryValue(
              financialYear.value,
              month,
              'expenses',
              category.id,
              subcategoryId,
            ),
          }
        })
        .filter(({ value }) => value > 0)
        .sort((a, b) => b.value - a.value)
      return {
        id: category.id,
        name: t(category.nameKey),
        value: financialYearMonthCategoryValue(financialYear.value, month, 'expenses', category.id),
        subcategories,
      }
    })
    .filter(({ value }) => value > 0)
    .sort((a, b) => b.value - a.value)
  const total = categories.reduce((sum, category) => sum + category.value, 0)
  return categories.map((category) => ({
    ...category,
    percentage: total > 0 ? (category.value / total) * 100 : 0,
  }))
})
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

function setTrackMode(mode) {
  if (mode === trackMode.value) return
  router.replace({
    name: 'expense-tracker',
    params: { workspaceId: activeWorkspaceId.value },
    query: { view: 'track', mode },
  })
}

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

function openAdd(subcategory) {
  if (!subcategory) return
  activeSubcategory.value = subcategory
  editingItem.value = null
  entryDialog.value = true
}

function openEdit(item) {
  if (!canMutateActiveSubcategory.value) return
  editingItem.value = item
  reviewDialog.value = false
  entryDialog.value = true
}

function isTrackingEnabled(subcategoryId) {
  return trackingStore.enabledSubcategories.includes(subcategoryId)
}

function openReviewGroup(group) {
  activeReviewGroupId.value = group.id
  activeSubcategory.value = null
  editingItem.value = null
  draftDecisions.value = Object.fromEntries(
    group.subcategories.map((subcategory) => [subcategory.id, subcategory.decision]),
  )
  reviewDialog.value = true
}

function openSubcategory(subcategory) {
  activeSubcategory.value = subcategory
  editingItem.value = null
}

function groupTrackedTotal(group) {
  return group.subcategories.reduce(
    (total, subcategory) => total + Number(subcategory.trackedTotal || 0),
    0,
  )
}

function groupModelTotal(group) {
  return group.subcategories.reduce(
    (total, subcategory) => total + Number(subcategory.modelValue || 0),
    0,
  )
}

function draftDecisionFor(subcategory) {
  return draftDecisions.value[subcategory.id] || subcategory.decision
}

function setDraftDecision(subcategory, decision) {
  draftDecisions.value = { ...draftDecisions.value, [subcategory.id]: decision }
}

async function saveDraftDecisions() {
  if (!activeReviewGroup.value || !hasDraftChanges.value || decisionSaving.value) return
  const decisions = Object.fromEntries(
    activeReviewGroup.value.subcategories
      .filter((subcategory) => draftDecisionFor(subcategory) !== subcategory.decision)
      .map((subcategory) => [subcategory.id, draftDecisionFor(subcategory)]),
  )
  decisionSaving.value = true
  try {
    await trackingStore.saveReconciliations(activeWorkspaceId.value, period.value, decisions)
    reviewDialog.value = false
    $q.notify({ type: 'positive', message: t('expenseTracker.sourcesUpdated'), position: 'top' })
  } catch {
    $q.notify({ type: 'negative', message: t('expenseTracker.errors.sourceSave'), position: 'top' })
  } finally {
    decisionSaving.value = false
  }
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

function formatPercentage(value) {
  return new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }).format(value) + '%'
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
  @include financial-shell(wide);
}

.tracker-header,
.review-dialog-heading,
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

.track-mode-nav {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.25rem;
  width: 17.4rem;
  min-width: 0;
  margin: 0 auto;
  padding: 0.25rem;
  border: 1px solid var(--color-line);
  border-radius: 999px;
  background: var(--color-surface);
  box-shadow: 0 4px 16px rgb(34 55 78 / 4%);
}

.track-mode-nav button {
  @include segmented-button;
  gap: 0.45rem;
  min-height: 2rem;
  color: var(--color-copy);
  font-size: 0.82rem;
}

.track-mode-nav button.active {
  background: var(--color-ink);
  color: var(--color-inverse);
  box-shadow: var(--shadow-control);
}

.track-mode-nav button:focus-visible {
  @include focus-ring;
}

.monthly-overview {
  display: grid;
  grid-template-columns: 17.4rem minmax(1rem, 1fr) minmax(13rem, auto) repeat(
      3,
      minmax(7rem, auto)
    );
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: 0 8px 24px rgb(34 55 78 / 4%);
}

.monthly-spacer {
  min-width: 0;
}

.monthly-metric {
  display: grid;
  min-width: 7.5rem;
  padding-left: 1rem;
  border-left: 1px solid var(--color-line);
}

.monthly-metric span {
  color: var(--color-copy);
  font-size: 0.72rem;
}

.monthly-metric strong {
  margin-top: 0.1rem;
  color: var(--color-ink);
  font-size: 1.25rem;
  line-height: 1.1;
}

.monthly-metric:last-child strong {
  color: var(--color-success);
}

.monthly-metric.over strong {
  color: var(--color-danger);
}

.review-dialog-card {
  @include financial-dialog-card(78rem);
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

.review-dialog-heading {
  @include financial-dialog-header;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
}

.review-dialog-heading h2 {
  margin: 0.2rem 0 0;
}

.review-back {
  color: var(--tracking-color);
}

.review-group-detail {
  @include financial-dialog-body;
  display: grid;
  gap: 0;
  padding-top: 0.5rem;
  overflow-x: hidden;
}

.review-progress-card {
  display: grid;
  gap: 1rem;
  margin-bottom: 2rem;
  padding: 1.25rem 1.5rem;
  border-radius: 1rem;
  background: linear-gradient(135deg, var(--color-surface-soft), var(--tracking-soft));
}

.review-progress-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
}

.review-progress-heading > div > span {
  color: var(--color-copy);
  font-size: 0.9rem;
}

.review-progress-heading p {
  display: flex;
  align-items: baseline;
  gap: 0.45rem;
  margin: 0.2rem 0 0;
}

.review-progress-heading p strong {
  color: var(--color-ink);
  font-size: 2.25rem;
  line-height: 1;
  letter-spacing: -0.04em;
}

.review-progress-heading p span {
  color: var(--color-copy);
  font-size: 1.35rem;
  font-weight: 700;
}

.review-progress-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.55rem 0.85rem;
  border-radius: 999px;
  background: #dff4e5;
  color: #12623b;
  white-space: nowrap;
}

.review-progress-badge.over {
  background: #ffe6e3;
  color: #a72a2a;
}

.review-progress-badge .q-icon {
  font-size: 1.2rem;
}

.review-progress-track {
  height: 0.7rem;
  overflow: hidden;
  border-radius: 999px;
  background: rgb(79 97 126 / 14%);
}

.review-progress-track > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #31a565;
  transition: width 180ms ease;
}

.review-progress-track > span.over {
  background: #d44848;
}

.review-subcategories-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.25rem;
}

.review-subcategories-heading h3 {
  margin: 0;
  color: var(--color-ink);
  font-size: 1.2rem;
}

.review-subcategories-heading > span {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--color-copy);
  font-size: 0.82rem;
}

.review-category-row {
  display: grid;
  grid-template-columns: minmax(12rem, 1.3fr) minmax(9rem, 0.65fr) minmax(15rem, 1fr) auto;
  align-items: center;
  gap: 1rem;
  min-height: 5.4rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--color-line);
}

.review-category-row:last-child {
  border-bottom: 0;
}

.review-category-identity {
  @include button-reset;
  display: flex;
  align-items: center;
  gap: 0.85rem;
  min-width: 0;
  width: 100%;
  color: var(--color-ink);
}

.review-category-identity:focus-visible,
.review-category-decision:focus-visible {
  @include focus-ring;
}

.review-category-icon {
  display: grid;
  flex: 0 0 2.8rem;
  width: 2.8rem;
  height: 2.8rem;
  place-items: center;
  border-radius: 0.8rem;
  background: color-mix(in srgb, var(--tracking-soft) 80%, var(--color-surface));
  color: var(--tracking-color);
  font-size: 1.35rem;
}

.review-category-copy,
.review-category-values > span {
  display: grid;
  min-width: 0;
}

.review-category-copy small {
  color: var(--color-copy);
  font-size: 0.75rem;
}

.review-category-values {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
}

.review-category-values > span {
  gap: 0.1rem;
  padding: 0 0.85rem;
}

.review-category-values > span + span {
  border-left: 1px solid var(--color-line);
}

.review-category-values small {
  color: var(--color-copy);
  font-size: 0.72rem;
}

.review-category-values strong {
  color: var(--color-ink);
  font-size: 1rem;
}

.review-category-decisions {
  display: flex;
  width: 100%;
  min-width: 0;
  padding: 0.2rem;
  border: 1px solid var(--color-line-strong);
  border-radius: 999px;
  background: var(--color-surface-soft);
}

@media (min-width: 600px) {
  .review-dialog-card {
    width: min(78rem, calc(100vw - 3rem));
    max-width: none;
    max-height: none;
  }

  .review-group-detail {
    flex: 0 1 auto;
    min-height: auto;
    overflow-y: visible;
  }
}

.review-category-decision {
  @include segmented-button;
  flex: 1 1 50%;
  gap: 0.3rem;
  min-height: 2.45rem;
  padding: 0.35rem 0.8rem;
  color: var(--color-copy);
  font-size: 0.75rem;
}

.review-category-decision.selected {
  background: #dff4e5;
  color: #12623b;
  box-shadow: var(--shadow-control);
}

.review-category-decision:disabled {
  cursor: default;
  opacity: 0.5;
}

.review-category-open {
  color: var(--tracking-color);
}

.review-plan-note {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin-top: 1.25rem;
  padding: 0.9rem 1rem;
  border-radius: 0.8rem;
  background: var(--color-surface-soft);
  color: var(--color-copy);
  font-size: 0.82rem;
}

.review-plan-note .q-icon {
  flex: 0 0 auto;
  font-size: 1.3rem;
}

.review-plan-actions {
  @include financial-dialog-actions;
}

.subcategory-total {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}

.subcategory-total strong {
  color: var(--color-ink);
  font-size: 2rem;
}

.subcategory-total span {
  color: var(--color-copy);
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
  gap: 0.7rem;
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

.items-summary-icon {
  display: grid !important;
  flex: 0 0 2rem;
  width: 2rem;
  height: 2rem;
  min-width: 2rem;
  place-items: center;
  overflow: hidden;
}

.items-summary-icon .q-icon {
  position: static;
  width: 1em;
  height: 1em;
  margin: 0;
  transform: none;
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

.item-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.65rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--color-line);
  border-radius: 0.8rem;
  background: var(--color-surface);
}

.item-copy {
  display: grid;
  min-width: 0;
}

.item-copy > strong {
  color: var(--color-ink);
  font-size: 1rem;
}

.item-copy > span {
  margin-top: 0.08rem;
  color: var(--color-ink);
  font-size: 0.82rem;
  font-weight: 600;
}

.item-copy > small {
  overflow: hidden;
  margin-top: 0.08rem;
  font-size: 0.72rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-date {
  display: grid;
  width: 3.25rem;
  min-height: 3.5rem;
  place-content: center;
  justify-items: center;
  border-radius: 0.7rem;
  background: var(--color-surface-muted);
  color: var(--color-ink);
  font-style: normal;
}

.item-date strong {
  font-size: 1.05rem;
  line-height: 1;
}

.item-date span {
  margin-top: 0.2rem;
  color: var(--color-copy);
  font-size: 0.62rem;
  font-weight: 700;
}

.item-controls,
.item-actions {
  display: flex;
  align-items: center;
}

.item-controls {
  gap: 0.2rem;
}

.item-row small,
.items-empty {
  color: var(--color-copy);
}

@media (max-width: 899px) {
  .monthly-overview {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }

  .track-mode-nav {
    grid-column: 1 / -1;
    width: 100%;
  }

  .monthly-spacer {
    display: none;
  }

  .monthly-metric {
    grid-column: auto;
    min-width: 0;
  }

  .review-category-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.65rem 1rem;
  }

  .review-category-identity {
    grid-column: 1;
    grid-row: 1;
  }

  .review-category-open {
    grid-column: 2;
    grid-row: 1;
  }

  .review-category-values {
    grid-column: 1 / -1;
    grid-row: 2;
  }

  .review-category-decisions {
    grid-column: 1 / -1;
    grid-row: 3;
  }
}

@media (max-width: 599px) {
  .tracker-page {
    padding-right: max(0.75rem, env(safe-area-inset-right));
    padding-bottom: calc(var(--mobile-nav-height) + 1.5rem);
    padding-left: max(0.75rem, env(safe-area-inset-left));
  }

  .track-mode-nav {
    grid-column: 1 / -1;
    width: 100%;
    min-width: 0;
    margin: 0 0 0.7rem;
  }

  .monthly-overview {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem 0;
    margin-top: 0.75rem;
    padding: 0.65rem;
  }

  .monthly-metric {
    grid-column: auto;
    min-width: 0;
    padding: 0 0.45rem;
    text-align: center;
  }

  .month-metric,
  .monthly-metric:nth-last-child(2) {
    padding-left: 0;
    border-left: 0;
  }

  .monthly-metric strong {
    overflow: hidden;
    font-size: 1rem;
    text-overflow: ellipsis;
  }

  .monthly-metric span {
    font-size: 0.65rem;
  }

  .tracker-header {
    align-items: flex-end;
    gap: 0.75rem;
  }

  .review-dialog-card {
    width: 100vw;
    max-width: none;
    max-height: 94dvh;
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

  .review-dialog-heading {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 0.8rem;
    padding: 0.8rem 1rem 0.7rem;
  }

  .review-group-detail {
    display: block;
    padding: 0.45rem 0.85rem 1rem;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .review-progress-card {
    gap: 0.65rem;
    margin-bottom: 1rem;
    padding: 0.85rem;
    border-radius: 0.9rem;
  }

  .review-progress-heading {
    align-items: flex-end;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .review-progress-heading p strong {
    font-size: 1.65rem;
  }

  .review-progress-heading p span {
    font-size: 1rem;
  }

  .review-progress-badge {
    padding: 0.4rem 0.6rem;
    font-size: 0.7rem;
  }

  .review-subcategories-heading {
    display: grid;
    gap: 0.25rem;
    margin-bottom: 0.7rem;
  }

  .review-subcategories-heading > span {
    max-width: none;
    font-size: 0.7rem;
    text-align: left;
  }

  .review-category-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.75rem;
    min-height: 0;
    margin-bottom: 0.7rem;
    padding: 0.85rem;
    border: 1px solid var(--color-line);
    border-radius: 1rem;
    background: var(--color-surface);
    box-shadow: 0 5px 18px rgb(34 55 78 / 5%);
  }

  .review-category-row:last-child {
    margin-bottom: 0;
    border-bottom: 1px solid var(--color-line);
  }

  .review-category-identity {
    grid-column: 1;
    grid-row: 1;
  }

  .review-category-values {
    grid-column: 1 / -1;
    grid-row: 2;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    overflow: hidden;
    padding: 0;
    border-radius: 0.75rem;
    background: var(--color-surface-soft);
  }

  .review-category-values > span {
    gap: 0.2rem;
    padding: 0.6rem 0.75rem;
  }

  .review-category-decisions {
    grid-column: 1 / -1;
    grid-row: 3;
    width: 100%;
    min-width: 0;
    margin-top: 0.05rem;
  }

  .review-category-decision {
    min-width: 0;
    min-height: 2.5rem;
    padding-inline: 0.5rem;
    font-size: 0.72rem;
    white-space: nowrap;
  }

  .review-category-open {
    grid-column: 2;
    grid-row: 1;
    align-self: center;
  }

  .review-plan-note {
    margin-top: 0.75rem;
    padding: 0.75rem;
    font-size: 0.74rem;
  }

  .review-plan-actions {
    position: relative;
    z-index: 1;
    min-height: 4.5rem;
    padding: 0.7rem max(1rem, env(safe-area-inset-right)) max(0.7rem, env(safe-area-inset-bottom))
      max(1rem, env(safe-area-inset-left));
    box-shadow: 0 -8px 24px rgb(11 22 51 / 6%);
  }

  .review-plan-actions .app-btn--wide {
    flex: 1 1 auto;
    min-width: 0;
    min-height: var(--button-height-lg);
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
    gap: 0.6rem;
    padding: 0.6rem 1rem 1rem;
  }

  .items-summary > div {
    gap: 0.6rem;
    padding: 0.85rem;
  }

  .items-summary-icon .q-icon {
    font-size: 1.4rem;
  }

  .item-row {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 0.5rem;
    padding: 0.55rem 0.6rem;
  }
}
</style>
