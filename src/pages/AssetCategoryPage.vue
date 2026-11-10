<template>
  <q-page class="category-page">
    <main class="category-shell">
      <div v-if="pageLoading" class="loading-state">
        <q-spinner color="primary" size="2rem" />
        <span>{{ t('assets.loading') }}</span>
      </div>

      <section
        v-else-if="
          pageError || assetsStore.error || (categoryId === 'real_estate' && liabilitiesStore.error)
        "
        class="error-state"
      >
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
        <AppPageHeader
          :title="t(category.nameKey)"
          :back-label="t('assets.backToAssets')"
          :back-to="assetsRoute"
        />

        <section class="summary-card">
          <span class="summary-icon"><q-icon :name="category.icon" /></span>
          <div class="summary-copy">
            <span>{{ t('assets.total') }}</span>
            <strong>{{ formatCurrency(categoryTotal) }}</strong>
            <small>{{ itemSummary }}</small>
          </div>
        </section>

        <section v-if="allCategoryAssets.length" class="position-list">
          <article
            v-for="asset in scopedAssets"
            :key="asset.id"
            class="position-row"
            role="button"
            tabindex="0"
            @click="edit(asset)"
            @keydown.enter.self="edit(asset)"
            @keydown.space.self.prevent="edit(asset)"
          >
            <div class="position-main">
              <span class="position-icon"><q-icon :name="category.icon" /></span>
              <span class="position-copy">
                <strong>{{ assetSubcategoryLabel(asset) }}</strong>
                <small>{{ asset.itemName }}</small>
              </span>
            </div>

            <OwnershipAvatar :ownership="asset.ownership" :members="members" />
            <strong class="position-value">{{ formatCurrency(asset.scopedValue) }}</strong>

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
                <q-list dense class="position-menu">
                  <q-item clickable v-close-popup @click="edit(asset)">
                    <q-item-section avatar><q-icon name="edit" /></q-item-section>
                    <q-item-section>{{ t('assets.editDetails') }}</q-item-section>
                  </q-item>
                  <q-item v-if="hasModel(asset)" clickable v-close-popup @click="openModel(asset)">
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
        :mortgages="availableMortgages"
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
import OwnershipAvatar from '@/components/financial/OwnershipAvatar.vue'
import AppPageHeader from '@/components/layout/AppPageHeader.vue'
import { getAssetCategory } from '@/config/asset-categories'
import {
  currentFinancialMonth,
  currentFinancialYear,
  financialYearMonthCategoryValue,
} from '../../functions/shared/positions/annual-projection.js'
import { authUser } from '@/services/auth'
import { useAssetsStore } from '@/stores/assets-store'
import { useFinancialYearsStore } from '@/stores/financial-years-store'
import { useFinancialScopeStore } from '@/stores/financial-scope-store'
import { useLiabilitiesStore } from '@/stores/liabilities-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import {
  moneyForOwnershipScope,
  cloneOwnershipAllocation,
  createEqualMemberOwnership,
  createSingleMemberOwnership,
} from '../../functions/shared/core/ownership.js'
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
const liabilitiesStore = useLiabilitiesStore()
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
const availableMortgages = computed(() => {
  const unavailableIds = new Set(
    allCategoryAssets.value
      .filter((asset) => asset.id !== editingAsset.value?.id)
      .map((asset) => asset.mortgageLiabilityId)
      .filter(Boolean),
  )
  return liabilitiesStore
    .itemsForCategory('mortgage')
    .filter((mortgage) => !unavailableIds.has(mortgage.id))
})
const financialYear = computed(() => financialYearsStore.get(workspaceId.value, currentYear))
const assetDefaults = computed(() => {
  const config = categoryConfig.value
  if (!config) return null

  const firstItem = allCategoryAssets.value.length === 0
  const ownership =
    memberIds.value.length === 1
      ? createSingleMemberOwnership(authUser.value?.uid)
      : cloneOwnershipAllocation(
          firstItem ? config.ownership : createEqualMemberOwnership(memberIds.value),
        )
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
      scopedValue: moneyForOwnershipScope(
        asset.currentValue,
        asset.ownership,
        selectedMemberId.value,
      ),
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
  () =>
    preparing.value ||
    assetsStore.loading ||
    assetsStore.categoryLoading ||
    liabilitiesStore.loading ||
    liabilitiesStore.categoryLoading,
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
      categoryId.value === 'real_estate'
        ? liabilitiesStore.loadConfig(workspaceId.value, force)
        : Promise.resolve(),
    ])
    if (currentPreparation !== preparationId) return

    const currentCategory = category.value
    const config = categoryConfig.value
    if (!assetsStore.setupCompleted || !currentCategory || !config?.enabled) {
      await router.replace(assetsRoute.value)
      return
    }

    await assetsStore.loadCategory(workspaceId.value, categoryId.value, force)
    if (categoryId.value === 'real_estate' && liabilitiesStore.config?.categories?.mortgage) {
      await liabilitiesStore.loadCategory(workspaceId.value, 'mortgage', force)
    }
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
  if (asset.categoryId === 'real_estate') {
    router.push({
      name: 'real-estate-model',
      params: { workspaceId: workspaceId.value, assetId: asset.id },
    })
    return
  }
  router.push({
    name: 'investment-portfolio',
    params: { workspaceId: workspaceId.value, assetId: asset.id },
  })
}

function hasModel(asset) {
  return asset.categoryId === 'investment' || asset.categoryId === 'real_estate'
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
  @include financial-shell(wide);
}

@include position-category-detail;

.error-state h1 {
  font-size: 2rem;
}

.error-state p {
  max-width: 32rem;
  margin: 0.75rem 0 1.25rem;
}

.summary-icon,
.position-icon,
.empty-icon {
  background: var(--color-green-soft);
  color: var(--color-success-dark);
}

.position-value {
  color: var(--color-ink);
  font-size: 1.15rem;
  font-weight: 700;
  white-space: nowrap;
}

.position-menu {
  min-width: 12rem;
}

.add-row {
  min-height: 4.4rem;
  padding: 0.8rem 1.25rem;
  font-weight: 700;
}

.add-row:hover {
  background: var(--color-blue-soft);
}

.add-row .q-icon {
  padding: 0.4rem;
  font-size: 1.1rem;
}

.empty-icon {
  margin-bottom: 0.75rem;
}

.empty-card h2 {
  margin: 0;
  color: var(--color-ink);
}

.empty-card p {
  margin: 0.45rem 0 1.25rem;
}

@media (max-width: 760px) {
  .position-row {
    grid-template-columns: minmax(0, 1fr) auto auto auto;
    @include mobile-financial-row;
  }

  .position-main {
    grid-column: 1;
    gap: 0.6rem;
  }

  .position-value {
    grid-column: 3;
    font-size: 0.95rem;
  }

  .position-row > .q-btn {
    grid-column: 4;
    grid-row: 1;
  }

  .add-row {
    justify-content: center;
  }
}
</style>
