<template>
  <q-page class="expenses-page">
    <main class="expenses-shell">
      <div v-if="expensesStore.loading" class="state">
        <q-spinner color="primary" size="2rem" />
        <span>{{ t('expenses.loading') }}</span>
      </div>

      <section v-else-if="expensesStore.error" class="state">
        <q-icon name="cloud_off" size="2rem" />
        <h1>{{ t('expenses.errors.loadTitle') }}</h1>
        <p>{{ t('expenses.errors.load') }}</p>
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon="refresh"
          :label="t('common.retry')"
          @click="expensesStore.loadSummary(workspaceId, true)"
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
            <div class="eyebrow">{{ t('expenses.eyebrow') }}</div>
            <h1>{{ t('expenses.title') }}</h1>
          </div>
          <MemberScopeSelector v-model="selectedMemberId" :members="members" />
        </header>

        <section class="total-card">
          <span>{{ t('expenses.totalCostOfLife') }}</span>
          <strong>{{ formatCurrency(totals.annualCostOfLife) }}</strong>
          <small>
            {{ t('expenses.perYear') }} · {{ formatCurrency(totals.monthlyCostOfLife) }}
            {{ t('expenses.perMonth') }} · {{ scopeLabel }}
          </small>
        </section>

        <section class="category-list" :aria-label="t('expenses.enabledCategories')">
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
              <strong>{{ formatCurrency(categoryMonthlyValue(category.id)) }}</strong>
              <small>/ {{ t('dashboard.month') }}</small>
            </div>

            <SimpleExpenseEstimateEditor
              v-else
              :estimate="categoryEstimate(category.id)"
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
        </section>

        <q-btn
          flat
          no-caps
          icon="tune"
          color="primary"
          :label="t('expenses.editCategories')"
          @click="editingCategories = true"
        />
      </template>
    </main>

    <q-dialog v-model="editingCategories" :maximized="$q.screen.lt.sm">
      <q-card class="category-dialog">
        <ExpenseCategorySetup
          edit-mode
          :initial-selected="expensesStore.enabledCategories"
          :saving="saving"
          @save="saveCategorySelection"
          @cancel="editingCategories = false"
        />
      </q-card>
    </q-dialog>

    <q-dialog v-model="ownershipDialog">
      <q-card class="ownership-dialog">
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
import { isItemizedCategory } from '@/domain/financial/category-summary'
import { cloneOwnership, isValidOwnership } from '@/domain/financial/ownership'
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
const saving = ref(false)
const editingCategories = ref(false)
const ownershipDialog = ref(false)
const editingOwnershipCategoryId = ref(null)
const editingOwnership = ref({ mode: 'single', shares: [] })
const ownershipValid = ref(false)
const savingCategoryIds = ref(new Set())
const deleteDialog = ref(false)
const deletingCategory = ref(null)

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
const enabledCategories = computed(() =>
  expenseCategories.filter((category) => expensesStore.summary?.categories?.[category.id]?.enabled),
)
const totals = computed(() => expensesStore.totals(selectedMemberId.value))
const scopeLabel = computed(() => {
  if (selectedMemberId.value === 'all') return t('dashboard.allMembers')
  return members.value.find((member) => member.id === selectedMemberId.value)?.name || ''
})

watch(workspaceId, (id) => expensesStore.loadSummary(id), { immediate: true })

function categoryConfig(categoryId) {
  return expensesStore.summary?.categories?.[categoryId]
}

function categoryEstimate(categoryId) {
  return categoryConfig(categoryId)?.manualEstimate || { amount: 0, frequency: 'monthly' }
}

function isItemized(categoryId) {
  return isItemizedCategory(categoryConfig(categoryId))
}

function categoryMonthlyValue(categoryId) {
  return expensesStore.totalForCategory(categoryId, selectedMemberId.value) / 12
}

function categoryStatus(categoryId) {
  const config = categoryConfig(categoryId)
  if (isItemizedCategory(config)) return t('expenses.itemCount', { count: config.itemCount })
  return t('expenses.simpleEstimate')
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
  await runSaving(() =>
    expensesStore.completeSetup(workspaceId.value, selected, authUser.value.uid, memberIds.value),
  )
}

async function saveCategorySelection(selected) {
  const saved = await runSaving(() =>
    expensesStore.saveCategorySelection(
      workspaceId.value,
      selected,
      authUser.value.uid,
      memberIds.value,
    ),
  )
  if (saved) editingCategories.value = false
}

async function saveEstimate(categoryId, estimate) {
  savingCategoryIds.value = new Set(savingCategoryIds.value).add(categoryId)
  try {
    await expensesStore.updateSimpleCategoryEstimate(
      workspaceId.value,
      categoryId,
      estimate,
      authUser.value.uid,
    )
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
      authUser.value.uid,
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
    expensesStore.deleteCategory(workspaceId.value, deletingCategory.value.id, authUser.value.uid),
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
.expenses-page {
  min-height: calc(100vh - 64px);
  padding: clamp(1.25rem, 3vw, 3rem);
  background: var(--color-page);
}

.expenses-shell {
  width: min(68rem, 100%);
  margin: 0 auto;
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
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.expenses-header h1 {
  margin: 0.2rem 0 0;
  font-size: clamp(2.2rem, 5vw, 3.5rem);
}

.eyebrow {
  color: var(--color-primary);
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
}

.total-card {
  display: grid;
  margin-bottom: 1rem;
  padding: 1.4rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: linear-gradient(145deg, #fff7f7, #fff);
}

.total-card strong {
  margin: 0.25rem 0;
  font-size: clamp(2.2rem, 5vw, 3.5rem);
  line-height: 1;
}

.total-card small {
  color: var(--color-copy);
}

.category-list {
  overflow: hidden;
  margin-bottom: 0.75rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
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
  width: min(34rem, calc(100vw - 2rem));
}

.category-dialog {
  width: min(68rem, calc(100vw - 2rem));
  padding: clamp(1rem, 4vw, 2.5rem);
}

@media (max-width: 749px) {
  .expenses-page {
    padding: 1rem;
    padding-bottom: calc(var(--mobile-nav-height) + 1.5rem);
  }

  .category-row {
    grid-template-columns: minmax(0, 1fr) auto auto;
  }

  .category-ownership {
    display: none;
  }

  .category-link {
    display: none;
  }
}
</style>
