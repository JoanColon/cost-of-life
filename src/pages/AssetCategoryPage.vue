<template>
  <q-page class="category-page">
    <main class="category-shell">
      <div v-if="assetsStore.loading" class="loading-state">
        <q-spinner color="primary" size="2rem" />
        <span>{{ t('assets.loading') }}</span>
      </div>

      <section v-else-if="assetsStore.error" class="error-state">
        <q-icon name="cloud_off" />
        <h1>{{ t('assets.errors.loadTitle') }}</h1>
        <p>{{ t('assets.errors.load') }}</p>
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon="refresh"
          :label="t('common.retry')"
          @click="assetsStore.load(workspaceId, true)"
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
            <div class="title-row">
              <span class="title-icon"><q-icon :name="category.icon" /></span>
              <div>
                <div class="eyebrow">{{ t('assets.eyebrow') }}</div>
                <h1>{{ t(category.nameKey) }}</h1>
              </div>
            </div>
          </div>
          <MemberScopeSelector v-model="selectedMemberId" :members="members" />
        </header>

        <section class="summary-card">
          <span>{{ t('assets.total') }}</span>
          <strong>{{ formatCurrency(categoryTotal) }}</strong>
          <small>{{ scopeLabel }}</small>
        </section>

        <q-banner
          v-if="
            categoryConfig.mode === 'itemized' &&
            categoryConfig.manualValue != null &&
            allCategoryAssets.length === 0
          "
          rounded
          class="previous-total-note"
        >
          <template #avatar><q-icon name="info_outline" color="primary" /></template>
          {{
            t('assets.previousTotal', {
              value: formatCurrency(categoryConfig.manualValue),
            })
          }}
        </q-banner>

        <section v-if="categoryConfig.mode === 'simple'" class="simple-card">
          <div>
            <div class="section-kicker">{{ t('assets.simpleTotal') }}</div>
            <h2>{{ t('assets.simple.title') }}</h2>
            <p>{{ t('assets.simple.description') }}</p>
          </div>

          <q-input
            v-model="simpleValue"
            outlined
            type="number"
            min="0"
            step="0.01"
            prefix="€"
            :label="t('assets.form.totalValue')"
            :rules="[(value) => normalizeMoney(value) !== null || t('assets.form.valueInvalid')]"
          />

          <OwnershipEditor
            v-model="simpleOwnership"
            :members="members"
            @validity="ownershipValid = $event"
          />

          <div class="simple-actions">
            <q-btn
              outline
              no-caps
              color="primary"
              icon="account_tree"
              :label="t('assets.breakDown')"
              :disable="saving"
              @click="switchToItemized"
            />
            <q-btn
              unelevated
              no-caps
              color="primary"
              :label="t('common.save')"
              :loading="saving"
              :disable="!ownershipValid"
              @click="saveSimple"
            />
          </div>
        </section>

        <template v-else>
          <section v-if="scopedAssets.length" class="asset-list">
            <button
              v-for="asset in scopedAssets"
              :key="asset.id"
              type="button"
              class="asset-row"
              @click="edit(asset)"
            >
              <span class="asset-icon"><q-icon :name="category.icon" /></span>
              <span class="asset-copy">
                <strong>{{ asset.name }}</strong>
                <small>{{ ownershipLabel(asset.ownership) }}</small>
              </span>
              <strong class="asset-value">{{ formatCurrency(asset.scopedValue) }}</strong>
              <q-icon name="chevron_right" class="chevron" />
            </button>
          </section>

          <section v-else class="empty-card">
            <span class="empty-icon"><q-icon :name="category.icon" /></span>
            <h2>{{ t('assets.empty.title', { category: t(category.nameKey) }) }}</h2>
            <p>{{ t('assets.empty.description') }}</p>
          </section>

          <div class="itemized-actions">
            <q-btn
              unelevated
              no-caps
              color="primary"
              icon="add"
              :label="t(category.addLabelKey)"
              @click="add"
            />
            <q-btn
              flat
              no-caps
              color="grey-7"
              :label="t('assets.useSimpleTotal')"
              @click="confirmSimpleMode = true"
            />
          </div>
        </template>
      </template>
    </main>

    <q-dialog v-model="assetDialog" persistent>
      <AssetForm
        v-if="category"
        :category="category"
        :asset="editingAsset"
        :members="members"
        :saving="saving"
        @save="saveAsset"
        @cancel="closeAssetDialog"
        @delete="confirmDelete = true"
      />
    </q-dialog>

    <q-dialog v-model="confirmDelete">
      <q-card class="confirm-card">
        <q-card-section>
          <h2>{{ t('assets.delete.title') }}</h2>
          <p>{{ t('assets.delete.description', { name: editingAsset?.name }) }}</p>
        </q-card-section>
        <q-card-actions align="between">
          <q-btn
            flat
            no-caps
            color="negative"
            :label="t('common.delete')"
            :loading="saving"
            @click="deleteAsset"
          />
          <q-btn flat no-caps :label="t('common.cancel')" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="confirmSimpleMode">
      <q-card class="confirm-card">
        <q-card-section>
          <h2>{{ t('assets.simple.switchTitle') }}</h2>
          <p>{{ t('assets.simple.switchDescription') }}</p>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps :label="t('common.cancel')" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="primary"
            :label="t('assets.useSimpleTotal')"
            :loading="saving"
            @click="switchToSimple"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import AssetForm from '@/components/assets/AssetForm.vue'
import OwnershipEditor from '@/components/assets/OwnershipEditor.vue'
import MemberScopeSelector from '@/components/dashboard/MemberScopeSelector.vue'
import { getAssetCategory } from '@/config/asset-categories'
import { authUser } from '@/services/auth'
import { useAssetsStore } from '@/stores/assets-store'
import { useFinancialScopeStore } from '@/stores/financial-scope-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import {
  applyOwnership,
  createSingleOwnership,
  isValidOwnership,
  normalizeMoney,
  ownershipFromAssets,
} from '@/utils/asset-calculations'
import { formatCurrency } from '@/utils/formatters'
import { getWorkspaceMembers } from '@/utils/workspace-members'

const $q = useQuasar()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const assetsStore = useAssetsStore()
const scopeStore = useFinancialScopeStore()
const workspaceStore = useWorkspaceStore()
const saving = ref(false)
const simpleValue = ref('')
const simpleOwnership = ref(createSingleOwnership(''))
const ownershipValid = ref(true)
const assetDialog = ref(false)
const editingAsset = ref(null)
const confirmDelete = ref(false)
const confirmSimpleMode = ref(false)
const leavingPage = ref(false)

const workspaceId = computed(() => String(route.params.workspaceId))
const categoryId = computed(() => String(route.params.category))
const assetsRoute = computed(() => ({
  name: 'assets',
  params: { workspaceId: workspaceId.value },
}))
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
const scopedAssets = computed(() =>
  allCategoryAssets.value
    .map((asset) => ({
      ...asset,
      scopedValue: applyOwnership(asset.currentValue, asset.ownership, selectedMemberId.value),
    }))
    .filter((asset) => selectedMemberId.value === 'all' || asset.scopedValue > 0),
)
const categoryTotal = computed(() =>
  assetsStore.totalForCategory(categoryId.value, selectedMemberId.value),
)
const scopeLabel = computed(() =>
  selectedMemberId.value === 'all'
    ? t('dashboard.allMembers')
    : members.value.find((member) => member.id === selectedMemberId.value)?.name || '',
)

onMounted(() => assetsStore.load(workspaceId.value))
onBeforeRouteLeave(() => {
  leavingPage.value = true
})
watch(workspaceId, (value) => {
  if (!leavingPage.value) assetsStore.load(value)
})
watch(
  [() => assetsStore.loading, () => assetsStore.loadedWorkspaceId, category, categoryConfig],
  ([loading, loadedWorkspaceId, selectedCategory, config]) => {
    // This watcher validates direct navigation to an asset category. It must not
    // redirect while Vue Router is already leaving this page (for example when
    // the user selects another workspace from the drawer).
    if (leavingPage.value || route.name !== 'asset-category') return

    const stateIsReady = !loading && !assetsStore.error && loadedWorkspaceId === workspaceId.value
    if (stateIsReady && (!assetsStore.setupCompleted || !selectedCategory || !config?.enabled)) {
      router.replace(assetsRoute.value)
    }
  },
  { immediate: true },
)
watch(
  categoryConfig,
  (config) => {
    if (!config) return
    simpleValue.value = config.manualValue ?? ''
    simpleOwnership.value = config.ownership
      ? structuredClone(config.ownership)
      : createSingleOwnership(memberIds.value[0])
    ownershipValid.value = isValidOwnership(simpleOwnership.value, memberIds.value)
  },
  { immediate: true },
)

async function saveSimple() {
  const value = normalizeMoney(simpleValue.value)
  if (value === null || !ownershipValid.value) return

  await updateCategory({
    manualValue: value,
    ownership: structuredClone(simpleOwnership.value),
  })
}

async function switchToItemized() {
  await updateCategory({ mode: 'itemized' })
}

async function switchToSimple() {
  const manualValue = assetsStore.totalForCategory(categoryId.value, 'all')
  const ownership = ownershipFromAssets(allCategoryAssets.value, memberIds.value)
  const saved = await updateCategory({ mode: 'simple', manualValue, ownership })
  if (saved) confirmSimpleMode.value = false
}

async function updateCategory(changes) {
  const updatedCategory = {
    ...structuredClone(categoryConfig.value),
    ...changes,
  }

  return persist(() =>
    assetsStore.saveCategory(
      workspaceId.value,
      categoryId.value,
      updatedCategory,
      authUser.value.uid,
    ),
  )
}

function add() {
  editingAsset.value = null
  assetDialog.value = true
}

function edit(asset) {
  editingAsset.value = asset
  assetDialog.value = true
}

function closeAssetDialog() {
  assetDialog.value = false
  editingAsset.value = null
}

async function saveAsset(payload) {
  const assetId = editingAsset.value?.id
  const saved = await persist(() =>
    assetId
      ? assetsStore.editAsset(workspaceId.value, assetId, payload, authUser.value.uid)
      : assetsStore.addAsset(workspaceId.value, payload, authUser.value.uid),
  )
  if (saved) closeAssetDialog()
}

async function deleteAsset() {
  if (!editingAsset.value) return
  const saved = await persist(() =>
    assetsStore.deleteAsset(workspaceId.value, editingAsset.value.id),
  )
  if (saved) {
    confirmDelete.value = false
    closeAssetDialog()
  }
}

function ownershipLabel(ownership) {
  return (ownership?.shares || [])
    .filter((share) => share.percentage > 0)
    .map((share) => {
      const name = members.value.find((member) => member.id === share.memberId)?.name || 'Member'
      return ownership.mode === 'single' ? name : `${name} ${share.percentage}%`
    })
    .join(' · ')
}

async function persist(action) {
  saving.value = true
  try {
    await action()
    $q.notify({ type: 'positive', message: t('assets.saved'), position: 'top' })
    return true
  } catch {
    $q.notify({ type: 'negative', message: t('assets.errors.save'), position: 'top' })
    return false
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;

.category-page {
  min-height: calc(100vh - 64px);
  min-height: calc(100dvh - 64px);
  padding: clamp(1.5rem, 4vw, 3rem);
  background: var(--color-page);
}

.category-shell {
  width: 100%;
  max-width: 58rem;
  margin: 0 auto;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  min-height: 20rem;
  color: var(--color-copy);
}

.error-state {
  display: grid;
  justify-items: center;
  min-height: 24rem;
  place-content: center;
  text-align: center;
}

.error-state > .q-icon {
  color: var(--color-copy);
  font-size: 3rem;
}

.error-state h1 {
  margin-top: 1rem;
  font-size: 2rem;
}

.error-state p {
  max-width: 32rem;
  margin: 0.75rem 0 1.25rem;
  color: var(--color-copy);
}

.category-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 2rem;
}

.back-button {
  min-height: 2rem;
  margin: 0 0 1rem -0.5rem;
  padding: 0 0.5rem;
  font-size: 0.78rem;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.title-icon,
.asset-icon,
.empty-icon {
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--color-green-soft);
  color: var(--color-success-dark);
}

.title-icon {
  width: 3.4rem;
  height: 3.4rem;
  font-size: 1.6rem;
}

.eyebrow,
.section-kicker {
  color: var(--color-primary);
  font-size: 0.72rem;
  font-weight: 750;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

h1 {
  margin: 0.2rem 0 0;
  color: var(--color-ink);
  font-size: clamp(2.1rem, 5vw, 3.5rem);
  line-height: 1;
  letter-spacing: -0.05em;
}

.summary-card,
.simple-card,
.asset-list,
.empty-card {
  @include dashboard-card;
  margin-top: 1.25rem;
}

.previous-total-note {
  margin-top: 1rem;
  border: 1px solid rgb(22 136 248 / 16%);
  background: var(--color-blue-soft);
  color: var(--color-copy);
}

.summary-card {
  display: grid;
  padding: clamp(1.4rem, 4vw, 2.25rem);
}

.summary-card span,
.summary-card small,
.simple-card p,
.empty-card p {
  color: var(--color-copy);
}

.summary-card strong {
  margin-top: 0.35rem;
  font-size: clamp(2.5rem, 7vw, 4.5rem);
  line-height: 1;
  letter-spacing: -0.05em;
}

.summary-card small {
  margin-top: 0.55rem;
}

.simple-card {
  display: grid;
  gap: 1.25rem;
  padding: clamp(1.4rem, 4vw, 2rem);
}

.simple-card h2,
.empty-card h2,
.confirm-card h2 {
  margin: 0.25rem 0 0;
  color: var(--color-ink);
}

.simple-card p,
.empty-card p,
.confirm-card p {
  margin: 0.45rem 0 0;
}

.simple-actions,
.itemized-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.itemized-actions {
  margin-top: 1rem;
}

.asset-list {
  overflow: hidden;
}

.asset-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 1rem;
  width: 100%;
  min-height: 5.4rem;
  padding: 1rem 1.25rem;
  border: 0;
  border-bottom: 1px solid var(--color-line);
  background: var(--color-surface);
  color: var(--color-ink);
  text-align: left;
  cursor: pointer;
}

.asset-row:last-child {
  border-bottom: 0;
}

.asset-row:hover {
  background: var(--color-surface-soft);
}

.asset-row:focus-visible {
  position: relative;
  @include focus-ring;
}

.asset-icon {
  width: 2.65rem;
  height: 2.65rem;
  font-size: 1.2rem;
}

.asset-copy strong,
.asset-copy small {
  display: block;
}

.asset-copy small {
  margin-top: 0.22rem;
  color: var(--color-copy);
}

.asset-value {
  white-space: nowrap;
}

.chevron {
  color: var(--color-copy);
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

.confirm-card {
  width: min(28rem, calc(100vw - 2rem));
  border-radius: var(--radius-md);
}

@media (max-width: 699px) {
  .category-page {
    padding: 1.2rem;
  }

  .category-header {
    align-items: flex-end;
    gap: 1rem;
  }

  .category-header :deep(.member-selector) {
    max-width: 52%;
  }

  .simple-actions,
  .itemized-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .asset-row {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .asset-value {
    grid-column: 2;
    grid-row: 2;
  }

  .asset-icon {
    grid-row: 1 / span 2;
  }

  .chevron {
    grid-column: 3;
    grid-row: 1 / span 2;
  }
}
</style>
