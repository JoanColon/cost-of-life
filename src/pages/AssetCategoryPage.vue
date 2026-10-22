<template>
  <q-page class="category-page">
    <main class="category-shell">
      <div v-if="pageLoading" class="loading-state">
        <q-spinner color="primary" size="2rem" />
        <span>{{ t('assets.loading') }}</span>
      </div>

      <section v-else-if="pageError || assetsStore.error" class="error-state">
        <q-icon name="cloud_off" />
        <h1>{{ t('assets.errors.loadTitle') }}</h1>
        <p>{{ t('assets.errors.load') }}</p>
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
              :label="t('assets.backToAssets')"
              :to="assetsRoute"
              class="back-button"
            />
            <h1>{{ t(category.nameKey) }}</h1>
          </div>
          <MemberScopeSelector v-model="selectedMemberId" :members="members" />
        </header>

        <section class="summary-card">
          <span class="summary-icon"><q-icon :name="category.icon" /></span>
          <div class="summary-copy">
            <span>{{ t('assets.total') }}</span>
            <strong>{{ formatCurrency(categoryTotal) }}</strong>
            <small>{{ itemSummary }}</small>
          </div>
        </section>

        <section v-if="allCategoryAssets.length" class="asset-list">
          <article
            v-for="asset in scopedAssets"
            :key="asset.id"
            class="asset-row"
            role="button"
            tabindex="0"
            @click="edit(asset)"
            @keydown.enter.self="edit(asset)"
            @keydown.space.self.prevent="edit(asset)"
          >
            <div class="asset-main">
              <span class="asset-icon"><q-icon :name="category.icon" /></span>
              <span class="asset-copy">
                <strong>{{ assetSubcategoryLabel(asset) }}</strong>
                <small>{{ asset.itemName }}</small>
              </span>
            </div>

            <div class="ownership-display">
              <span class="avatar-cluster" aria-hidden="true">
                <q-avatar
                  v-for="share in visibleOwnershipShares(asset.ownership)"
                  :key="share.memberId"
                  size="2.35rem"
                  class="ownership-avatar"
                >
                  <img
                    v-if="memberFor(share.memberId)?.photoURL"
                    :src="memberFor(share.memberId).photoURL"
                    alt=""
                  />
                  <span v-else>{{ initials(memberFor(share.memberId)?.name || '') }}</span>
                </q-avatar>
              </span>
            </div>

            <strong class="asset-value">{{ formatCurrency(asset.scopedValue) }}</strong>

            <q-btn
              flat
              round
              dense
              icon="more_vert"
              color="grey-7"
              :aria-label="t('assets.moreActions', { name: assetDisplayName(asset) })"
              @click.stop
            >
              <q-menu anchor="bottom right" self="top right">
                <q-list dense class="asset-menu">
                  <q-item clickable v-close-popup @click="edit(asset)">
                    <q-item-section avatar><q-icon name="edit" /></q-item-section>
                    <q-item-section>{{ t('assets.editDetails') }}</q-item-section>
                  </q-item>
                  <q-item
                    v-if="categoryId === 'investment'"
                    clickable
                    v-close-popup
                    @click="openModel(asset)"
                  >
                    <q-item-section avatar><q-icon name="account_tree" /></q-item-section>
                    <q-item-section>{{ t('assets.model') }}</q-item-section>
                  </q-item>
                  <q-item
                    clickable
                    v-close-popup
                    class="text-negative"
                    @click="requestDelete(asset)"
                  >
                    <q-item-section avatar><q-icon name="delete_outline" /></q-item-section>
                    <q-item-section>{{ t('common.delete') }}</q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-btn>
          </article>

          <button type="button" class="add-row" @click="add">
            <q-icon name="add" />
            <span>{{ t(category.addLabelKey) }}</span>
          </button>
        </section>

        <section v-else class="empty-card">
          <span class="empty-icon"><q-icon :name="category.icon" /></span>
          <h2>{{ t('assets.empty.contextualTitle', { items: t(category.itemNamePluralKey) }) }}</h2>
          <p>{{ t('assets.empty.description') }}</p>
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

    <q-dialog v-model="assetDialog" persistent :maximized="$q.screen.lt.sm">
      <AssetForm
        v-if="category"
        :category="category"
        :asset="editingAsset"
        :defaults="assetDefaults"
        :members="members"
        :saving="formSaving"
        @save="saveAsset"
        @cancel="closeAssetDialog"
        @delete="requestDelete(editingAsset)"
      />
    </q-dialog>

    <q-dialog v-model="confirmDelete">
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
          <h2>{{ t('assets.delete.title') }}</h2>
          <p>
            {{ t('assets.delete.description', { name: assetDisplayName(deletingAsset) }) }}
          </p>
        </q-card-section>
        <q-card-actions align="between">
          <q-btn
            flat
            no-caps
            color="negative"
            :label="t('common.delete')"
            :loading="formSaving"
            @click="deleteAsset"
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
import AssetForm from '@/components/assets/AssetForm.vue'
import MemberScopeSelector from '@/components/dashboard/MemberScopeSelector.vue'
import { getAssetCategory } from '@/config/asset-categories'
import {
  currentFinancialMonth,
  currentFinancialYear,
  financialYearMonthCategoryValue,
} from '@/domain/financial/financial-year'
import { authUser } from '@/services/auth'
import { useAssetsStore } from '@/stores/assets-store'
import { useFinancialYearsStore } from '@/stores/financial-years-store'
import { useFinancialScopeStore } from '@/stores/financial-scope-store'
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
const assetsStore = useAssetsStore()
const financialYearsStore = useFinancialYearsStore()
const scopeStore = useFinancialScopeStore()
const workspaceStore = useWorkspaceStore()
const preparing = ref(false)
const pageError = ref(null)
const assetDialog = ref(false)
const editingAsset = ref(null)
const deletingAsset = ref(null)
const confirmDelete = ref(false)
const formSaving = ref(false)
let preparationId = 0
const currentYear = currentFinancialYear()
const currentMonth = currentFinancialMonth()

const workspaceId = computed(() => String(route.params.workspaceId))
const categoryId = computed(() => String(route.params.category))
const assetsRoute = computed(() => ({ name: 'assets', params: { workspaceId: workspaceId.value } }))
const category = computed(() => getAssetCategory(categoryId.value))
const categoryConfig = computed(() => assetsStore.config?.categories?.[categoryId.value])
const workspace = computed(
  () => workspaceStore.workspaces.find((candidate) => candidate.id === workspaceId.value) || null,
)
const members = computed(() => getWorkspaceMembers(workspace.value, authUser.value))
const memberIds = computed(() => members.value.map((member) => member.id))
const selectedMemberId = computed({
  get: () => scopeStore.get(workspaceId.value, memberIds.value, authUser.value?.uid),
  set: (memberId) => scopeStore.select(workspaceId.value, memberId),
})
const allCategoryAssets = computed(() => assetsStore.itemsForCategory(categoryId.value))
const financialYear = computed(() => financialYearsStore.get(workspaceId.value, currentYear))
const assetDefaults = computed(() => {
  const config = categoryConfig.value
  if (!config) return null

  const firstItem = allCategoryAssets.value.length === 0
  const ownership =
    memberIds.value.length === 1
      ? createSingleOwnership(authUser.value?.uid)
      : cloneOwnership(firstItem ? config.ownership : createEqualOwnership(memberIds.value))
  return {
    categoryId: category.value?.id,
    subcategoryId: category.value?.subcategories?.[0] || null,
    itemName: '',
    notes: '',
    currentValue: firstItem ? (config.manualValue ?? 0) : 0,
    ownership,
  }
})
const scopedAssets = computed(() =>
  allCategoryAssets.value
    .map((asset) => ({
      ...asset,
      scopedValue: applyOwnership(asset.currentValue, asset.ownership, selectedMemberId.value),
    }))
    .sort((left, right) => Number(right.scopedValue || 0) - Number(left.scopedValue || 0)),
)
const categoryTotal = computed(() =>
  financialYearMonthCategoryValue(
    financialYear.value,
    currentMonth,
    'assets',
    categoryId.value,
    selectedMemberId.value,
  ),
)
const itemSummary = computed(() => {
  const count = allCategoryAssets.value.length
  const itemKey = count === 1 ? category.value.itemNameKey : category.value.itemNamePluralKey
  return t('assets.itemSummary', { count, items: t(itemKey) })
})
const pageLoading = computed(
  () => preparing.value || assetsStore.loading || assetsStore.categoryLoading,
)

watch([workspaceId, categoryId], () => preparePage(), { immediate: true })

async function preparePage(force = false) {
  const currentPreparation = ++preparationId
  preparing.value = true
  pageError.value = null

  try {
    await Promise.all([
      assetsStore.loadConfig(workspaceId.value, force),
      financialYearsStore.load(workspaceId.value, currentYear, force),
    ])
    if (currentPreparation !== preparationId) return

    const currentCategory = category.value
    const config = categoryConfig.value
    if (!assetsStore.setupCompleted || !currentCategory || !config?.enabled) {
      await router.replace(assetsRoute.value)
      return
    }

    await assetsStore.loadCategory(workspaceId.value, categoryId.value, force)
  } catch (error) {
    pageError.value = error
  } finally {
    if (currentPreparation === preparationId) preparing.value = false
  }
}

function assetDisplayName(asset) {
  return asset?.itemName || assetSubcategoryLabel(asset)
}

function assetSubcategoryLabel(asset) {
  return asset?.subcategoryId ? t(`assets.subtypes.${asset.subcategoryId}`) : ''
}

function add() {
  editingAsset.value = null
  assetDialog.value = true
}

function edit(asset) {
  editingAsset.value = asset
  assetDialog.value = true
}

function openModel(asset) {
  router.push({
    name: 'investment-portfolio',
    params: { workspaceId: workspaceId.value, assetId: asset.id },
  })
}

function closeAssetDialog() {
  assetDialog.value = false
  editingAsset.value = null
}

async function saveAsset(payload) {
  if (formSaving.value) return
  const assetId = editingAsset.value?.id
  formSaving.value = true
  const saved = await persist(() => {
    if (assetId) {
      return assetsStore.editAsset(workspaceId.value, assetId, payload, memberIds.value)
    }
    return assetsStore.addAsset(workspaceId.value, payload, memberIds.value)
  })
  formSaving.value = false
  if (saved) closeAssetDialog()
}

function requestDelete(asset) {
  if (!asset) return
  deletingAsset.value = asset
  confirmDelete.value = true
}

async function deleteAsset() {
  if (!deletingAsset.value) return
  formSaving.value = true
  const saved = await persist(() =>
    assetsStore.deleteAsset(workspaceId.value, deletingAsset.value.id),
  )
  formSaving.value = false
  if (saved) {
    confirmDelete.value = false
    deletingAsset.value = null
    closeAssetDialog()
  }
}

function visibleOwnershipShares(ownership) {
  return (ownership?.shares || []).filter((share) => Number(share.percentage) > 0)
}

function memberFor(memberId) {
  return members.value.find((member) => member.id === memberId)
}

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

async function persist(action) {
  try {
    await action()
    $q.notify({ type: 'positive', message: t('assets.saved'), position: 'top' })
    return true
  } catch {
    $q.notify({ type: 'negative', message: t('assets.errors.save'), position: 'top' })
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
  font-size: 2rem;
}
.error-state p {
  max-width: 32rem;
  margin: 0.75rem 0 1.25rem;
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
.asset-list,
.empty-card {
  @include dashboard-card;
  margin-top: 1.25rem;
}
.summary-card {
  @include financial-category-summary;
}
.summary-icon,
.asset-icon,
.empty-icon {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--color-green-soft);
  color: var(--color-success-dark);
}
.summary-icon {
  @include financial-summary-icon;
}
.asset-list {
  overflow: hidden;
}
.asset-row {
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
.asset-row:hover {
  background: #f8fafc;
}
.asset-row:focus-visible {
  position: relative;
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}
.asset-main {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-ink);
  text-align: left;
}
.asset-icon {
  @include financial-item-icon;
}
.asset-copy {
  min-width: 0;
}
.asset-copy strong,
.asset-copy small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.asset-copy small {
  margin-top: 0.2rem;
  color: var(--color-copy);
}
.ownership-display {
  min-height: 2.75rem;
  padding: 0.2rem;
}
.avatar-cluster {
  display: flex;
  padding-left: 0.45rem;
}
.ownership-avatar {
  margin-left: -0.45rem;
  border: 2px solid var(--color-surface);
  background: #edf2f6;
  color: #334964;
  font-size: 0.75rem;
  font-weight: 750;
}
.asset-value {
  color: var(--color-ink);
  font-size: 1.15rem;
  font-weight: 700;
  white-space: nowrap;
}
.asset-menu {
  min-width: 12rem;
}
.add-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  min-height: 4.4rem;
  padding: 0.8rem 1.25rem;
  border: 0;
  background: var(--color-surface);
  color: var(--color-primary);
  font-weight: 700;
  cursor: pointer;
}
.add-row:hover {
  background: var(--color-blue-soft);
}
.add-row .q-icon {
  padding: 0.4rem;
  border-radius: 50%;
  background: var(--color-primary);
  color: white;
  font-size: 1.1rem;
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
  margin-bottom: 0.75rem;
  font-size: 1.8rem;
}
.empty-card h2 {
  margin: 0;
  color: var(--color-ink);
}
.empty-card p {
  margin: 0.45rem 0 1.25rem;
  color: var(--color-copy);
}
.confirm-card {
  @include financial-simple-dialog(28rem);
}

@media (max-width: 760px) {
  .asset-row {
    grid-template-columns: minmax(0, 1fr) auto auto;
    @include mobile-financial-row;
  }
  .asset-main {
    grid-column: 1;
    gap: 0.6rem;
  }
  .ownership-display {
    display: none;
  }
  .asset-value {
    grid-column: 2;
    font-size: 0.95rem;
  }
  .asset-row > .q-btn {
    grid-column: 3;
    grid-row: 1;
  }
  .add-row {
    min-height: 3.5rem;
    padding: 0.6rem 0.75rem;
  }
}
</style>
