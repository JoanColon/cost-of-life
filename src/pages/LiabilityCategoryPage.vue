<template>
  <q-page class="category-page">
    <main class="category-shell">
      <div v-if="pageLoading" class="loading-state">
        <q-spinner color="primary" size="2rem" /><span>{{ t('liabilities.loading') }}</span>
      </div>
      <section v-else-if="pageError || liabilitiesStore.error" class="error-state">
        <q-icon name="cloud_off" />
        <h1>{{ t('liabilities.errors.loadTitle') }}</h1>
        <p>{{ t('liabilities.errors.load') }}</p>
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
              :label="t('liabilities.backToLiabilities')"
              :to="liabilitiesRoute"
              class="back-button"
            />
            <h1>{{ t(category.nameKey) }}</h1>
          </div>
        </header>

        <section class="summary-card">
          <span class="summary-icon"><q-icon :name="category.icon" /></span>
          <div class="summary-copy">
            <span>{{ t('liabilities.total') }}</span
            ><strong>{{ formatCurrency(categoryTotal) }}</strong
            ><small>{{ itemSummary }}</small>
          </div>
        </section>

        <section v-if="allCategoryLiabilities.length" class="liability-list">
          <article
            v-for="liability in scopedLiabilities"
            :key="liability.id"
            class="liability-row"
            role="button"
            tabindex="0"
            @click="edit(liability)"
            @keydown.enter.self="edit(liability)"
            @keydown.space.self.prevent="edit(liability)"
          >
            <div class="liability-main">
              <span class="liability-icon"><q-icon :name="category.icon" /></span>
              <span class="liability-copy"
                ><strong>{{ liabilitySubcategoryLabel(liability) }}</strong
                ><small>{{ liability.itemName }}</small></span
              >
            </div>
            <OwnershipAvatar :ownership="liability.ownership" :members="members" />
            <strong class="liability-value">{{ formatCurrency(liability.scopedValue) }}</strong>
            <q-btn
              flat
              round
              dense
              icon="more_vert"
              color="grey-7"
              :aria-label="t('liabilities.moreActions', { name: liability.itemName })"
              @click.stop
            >
              <q-menu anchor="bottom right" self="top right">
                <q-list dense class="liability-menu">
                  <q-item clickable v-close-popup @click="edit(liability)"
                    ><q-item-section avatar><q-icon name="edit" /></q-item-section
                    ><q-item-section>{{ t('liabilities.editDetails') }}</q-item-section></q-item
                  >
                  <q-item
                    v-if="categoryId === 'mortgage'"
                    clickable
                    v-close-popup
                    @click="openModel(liability)"
                  >
                    <q-item-section avatar><q-icon name="account_tree" /></q-item-section>
                    <q-item-section>{{ t('liabilities.model') }}</q-item-section>
                  </q-item>
                  <q-item
                    clickable
                    v-close-popup
                    class="text-negative"
                    @click="requestDelete(liability)"
                    ><q-item-section avatar><q-icon name="delete_outline" /></q-item-section
                    ><q-item-section>{{ t('common.delete') }}</q-item-section></q-item
                  >
                </q-list>
              </q-menu>
            </q-btn>
          </article>
          <button type="button" class="add-row" @click="add">
            <q-icon name="add" /><span>{{ t(category.addLabelKey) }}</span>
          </button>
        </section>

        <section v-else class="empty-card">
          <span class="empty-icon"><q-icon :name="category.icon" /></span>
          <h2>
            {{ t('liabilities.empty.contextualTitle', { items: t(category.itemNamePluralKey) }) }}
          </h2>
          <p>{{ t('liabilities.empty.description') }}</p>
          <q-btn
            unelevated
            no-caps
            color="primary"
            icon="add"
            :label="t(category.addLabelKey)"
            @click="add"
          />
        </section>
      </template>
    </main>

    <q-dialog v-model="liabilityDialog" persistent :maximized="$q.screen.lt.sm">
      <LiabilityForm
        :category="category"
        :liability="editingLiability"
        :defaults="liabilityDefaults"
        :members="members"
        :saving="formSaving"
        @save="saveLiability"
        @cancel="closeLiabilityDialog"
        @delete="requestDelete(editingLiability)"
      />
    </q-dialog>

    <q-dialog v-model="confirmDelete" persistent>
      <q-card class="confirm-card">
        <q-btn
          flat
          round
          dense
          icon="close"
          class="dialog-close"
          :aria-label="t('common.cancel')"
          :disable="formSaving"
          v-close-popup
        />
        <q-card-section
          ><h2>{{ t('liabilities.delete.title') }}</h2>
          <p>
            {{ t('liabilities.delete.description', { name: deletingLiability?.itemName }) }}
          </p></q-card-section
        >
        <q-card-actions align="between">
          <q-btn
            unelevated
            no-caps
            color="negative"
            :label="t('common.delete')"
            :loading="formSaving"
            @click="deleteLiability"
          />
          <q-btn flat no-caps :label="t('common.cancel')" v-close-popup />
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
import LiabilityForm from '@/components/liabilities/LiabilityForm.vue'
import OwnershipAvatar from '@/components/financial/OwnershipAvatar.vue'
import { getLiabilityCategory } from '@/config/liability-categories'
import {
  currentFinancialMonth,
  currentFinancialYear,
  financialYearMonthCategoryValue,
} from '@/domain/financial/financial-year'
import { authUser } from '@/services/auth'
import { useFinancialScopeStore } from '@/stores/financial-scope-store'
import { useFinancialYearsStore } from '@/stores/financial-years-store'
import { useLiabilitiesStore } from '@/stores/liabilities-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import {
  applyOwnership,
  cloneOwnership,
  createEqualOwnership,
  createSingleOwnership,
} from '@/domain/financial/ownership'
import { formatCurrency } from '@/utils/formatters'
import { getWorkspaceMembers } from '@/utils/workspace-members'

const $q = useQuasar()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const liabilitiesStore = useLiabilitiesStore()
const financialYearsStore = useFinancialYearsStore()
const scopeStore = useFinancialScopeStore()
const workspaceStore = useWorkspaceStore()
const preparing = ref(false)
const pageError = ref(null)
const liabilityDialog = ref(false)
const editingLiability = ref(null)
const deletingLiability = ref(null)
const confirmDelete = ref(false)
const formSaving = ref(false)
let preparationId = 0
const currentYear = currentFinancialYear()
const currentMonth = currentFinancialMonth()

const workspaceId = computed(() => String(route.params.workspaceId))
const categoryId = computed(() => String(route.params.category))
const liabilitiesRoute = computed(() => ({
  name: 'liabilities',
  params: { workspaceId: workspaceId.value },
}))
const category = computed(() => getLiabilityCategory(categoryId.value))
const categoryConfig = computed(() => liabilitiesStore.config?.categories?.[categoryId.value])
const workspace = computed(
  () => workspaceStore.workspaces.find((candidate) => candidate.id === workspaceId.value) || null,
)
const members = computed(() => getWorkspaceMembers(workspace.value, authUser.value))
const memberIds = computed(() => members.value.map((member) => member.id))
const selectedMemberId = computed({
  get: () => scopeStore.get(workspaceId.value, memberIds.value, authUser.value?.uid),
  set: (memberId) => scopeStore.select(workspaceId.value, memberId),
})
const allCategoryLiabilities = computed(() => liabilitiesStore.itemsForCategory(categoryId.value))
const financialYear = computed(() => financialYearsStore.get(workspaceId.value, currentYear))
const liabilityDefaults = computed(() => {
  const config = categoryConfig.value
  if (!config) return null
  const firstItem = allCategoryLiabilities.value.length === 0
  const ownership =
    memberIds.value.length === 1
      ? createSingleOwnership(authUser.value?.uid)
      : cloneOwnership(firstItem ? config.ownership : createEqualOwnership(memberIds.value))
  return {
    categoryId: category.value?.id,
    subcategoryId: category.value?.subcategories?.[0] || null,
    itemName: '',
    notes: '',
    balance: firstItem ? (config.manualValue ?? 0) : 0,
    ownership,
  }
})
const scopedLiabilities = computed(() =>
  allCategoryLiabilities.value
    .map((liability) => ({
      ...liability,
      scopedValue: applyOwnership(liability.balance, liability.ownership, selectedMemberId.value),
    }))
    .sort((left, right) => Number(right.scopedValue || 0) - Number(left.scopedValue || 0)),
)
const categoryTotal = computed(() =>
  financialYearMonthCategoryValue(
    financialYear.value,
    currentMonth,
    'liabilities',
    categoryId.value,
    selectedMemberId.value,
  ),
)
const itemSummary = computed(() => {
  const count = allCategoryLiabilities.value.length
  const key = count === 1 ? category.value.itemNameKey : category.value.itemNamePluralKey
  return t('liabilities.itemSummary', { count, items: t(key) })
})
const pageLoading = computed(
  () => preparing.value || liabilitiesStore.loading || liabilitiesStore.categoryLoading,
)

watch([workspaceId, categoryId], () => preparePage(), { immediate: true })

async function preparePage(force = false) {
  const currentPreparation = ++preparationId
  preparing.value = true
  pageError.value = null
  try {
    await Promise.all([
      liabilitiesStore.loadConfig(workspaceId.value, force),
      financialYearsStore.load(workspaceId.value, currentYear, force),
    ])
    if (currentPreparation !== preparationId) return
    if (!liabilitiesStore.setupCompleted || !category.value || !categoryConfig.value?.enabled) {
      await router.replace(liabilitiesRoute.value)
      return
    }
    await liabilitiesStore.loadCategory(workspaceId.value, categoryId.value, force)
  } catch (error) {
    pageError.value = error
  } finally {
    if (currentPreparation === preparationId) preparing.value = false
  }
}

function add() {
  editingLiability.value = null
  liabilityDialog.value = true
}
function edit(liability) {
  editingLiability.value = liability
  liabilityDialog.value = true
}
function openModel(liability) {
  router.push({
    name: 'mortgage-detail',
    params: { workspaceId: workspaceId.value, liabilityId: liability.id },
  })
}
function closeLiabilityDialog() {
  liabilityDialog.value = false
  editingLiability.value = null
}

function liabilitySubcategoryLabel(liability) {
  return liability?.subcategoryId ? t(`liabilities.categories.${liability.subcategoryId}.name`) : ''
}

async function saveLiability(payload) {
  if (formSaving.value) return
  const liabilityId = editingLiability.value?.id
  formSaving.value = true
  const saved = await persist(() =>
    liabilityId
      ? liabilitiesStore.editLiability(workspaceId.value, liabilityId, payload, memberIds.value)
      : liabilitiesStore.addLiability(workspaceId.value, payload, memberIds.value),
  )
  formSaving.value = false
  if (saved) closeLiabilityDialog()
}

function requestDelete(liability) {
  if (!liability) return
  deletingLiability.value = liability
  confirmDelete.value = true
}

async function deleteLiability() {
  if (!deletingLiability.value) return
  formSaving.value = true
  const saved = await persist(() =>
    liabilitiesStore.deleteLiability(workspaceId.value, deletingLiability.value.id),
  )
  formSaving.value = false
  if (saved) {
    confirmDelete.value = false
    deletingLiability.value = null
    closeLiabilityDialog()
  }
}

async function persist(action) {
  try {
    await action()
    $q.notify({ type: 'positive', message: t('liabilities.saved'), position: 'top' })
    return true
  } catch {
    $q.notify({ type: 'negative', message: t('liabilities.errors.save'), position: 'top' })
    return false
  }
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;
.category-page {
  @include financial-page;
}
.category-shell {
  @include financial-shell;
}
.loading-state,
.error-state {
  min-height: 20rem;
}
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  color: var(--color-copy);
}
.error-state {
  display: grid;
  justify-items: center;
  place-content: center;
  text-align: center;
}
.error-state > .q-icon {
  color: var(--color-copy);
  font-size: 3rem;
}
.error-state h1 {
  margin: 1rem 0 0;
}
.error-state p {
  color: var(--color-copy);
}
.category-header {
  @include financial-header;
}
.back-button {
  @include financial-back-button;
}
h1 {
  @include financial-title;
}
.summary-card,
.liability-list,
.empty-card {
  @include dashboard-card;
  margin-top: 1.25rem;
}
.summary-card {
  @include financial-category-summary;
}
.summary-icon,
.liability-icon,
.empty-icon {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--color-red-soft);
  color: var(--color-danger);
}
.summary-icon {
  @include financial-summary-icon;
}
.liability-list {
  overflow: hidden;
}
.liability-row {
  display: grid;
  grid-template-columns: minmax(14rem, 1fr) auto auto auto;
  align-items: center;
  gap: 0.65rem;
  min-height: 5.5rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-line);
  background: var(--color-surface);
  cursor: pointer;
  transition: background-color 160ms ease;
}
.liability-row:hover {
  background: var(--color-surface-soft);
}
.liability-row:focus-visible {
  position: relative;
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}
.liability-main {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  min-width: 0;
}
.liability-icon {
  @include financial-item-icon;
}
.liability-copy {
  min-width: 0;
}
.liability-copy strong,
.liability-copy small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.liability-copy small {
  margin-top: 0.2rem;
  color: var(--color-copy);
}
.liability-value {
  min-width: 7rem;
  text-align: right;
}
.liability-menu {
  min-width: 11rem;
}
.add-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  min-height: 4.6rem;
  padding: 0.9rem 1.4rem;
  border: 0;
  background: var(--color-surface);
  color: var(--color-primary);
  font-weight: 750;
  cursor: pointer;
}
.add-row .q-icon {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: var(--color-primary);
  color: white;
}
.empty-card {
  display: grid;
  justify-items: center;
  padding: 3rem 1.5rem;
  text-align: center;
}
.empty-icon {
  width: 4rem;
  height: 4rem;
  font-size: 1.8rem;
}
.empty-card h2 {
  margin: 1rem 0 0;
}
.empty-card p {
  margin: 0.55rem 0 1.25rem;
  color: var(--color-copy);
}
.confirm-card {
  @include financial-simple-dialog(28rem);
}
@media (max-width: 699px) {
  .liability-row {
    grid-template-columns: minmax(0, 1fr) auto auto auto;
    @include mobile-financial-row;
  }
  .liability-main {
    grid-column: 1;
    gap: 0.6rem;
  }
  .liability-value {
    grid-column: 3;
    grid-row: 1;
    min-width: 0;
    font-size: 0.95rem;
  }
  .liability-row > .q-btn {
    grid-column: 4;
    grid-row: 1;
  }
  .add-row {
    min-height: 3.5rem;
    padding: 0.6rem 0.75rem;
  }
}
</style>
