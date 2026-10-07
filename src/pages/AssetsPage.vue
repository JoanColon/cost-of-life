<template>
  <q-page class="assets-page">
    <main class="assets-shell">
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
          @click="assetsStore.loadSummary(workspaceId, true)"
        />
      </section>

      <AssetCategorySetup
        v-else-if="!assetsStore.setupCompleted"
        :saving="saving"
        @save="completeSetup"
      />

      <template v-else>
        <header class="assets-header">
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
            <div class="eyebrow">{{ t('assets.eyebrow') }}</div>
            <h1>{{ t('assets.title') }}</h1>
          </div>
          <MemberScopeSelector v-model="selectedMemberId" :members="members" />
        </header>

        <section class="total-card">
          <span>{{ t('assets.totalAssets') }}</span>
          <strong>{{ formatCurrency(total) }}</strong>
          <small>{{ scopeLabel }}</small>
        </section>

        <section class="category-list" :aria-label="t('assets.enabledCategories')">
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
              :disabled="isItemizedCategory(category.id)"
              :aria-label="categoryOwnershipLabel(category.id)"
              @click="openOwnershipEditor(category.id)"
            >
              <q-avatar
                v-for="member in categoryMembers(category.id)"
                :key="member.id"
                size="2.35rem"
                class="ownership-avatar"
              >
                <img v-if="member.photoURL" :src="member.photoURL" alt="" />
                <span v-else>{{ initials(member.name) }}</span>
              </q-avatar>
            </button>

            <SimpleAssetValueEditor
              :value="canonicalCategoryValue(category.id)"
              :formatted-value="categoryValue(category.id)"
              :saving="isCategorySaving(category.id)"
              :disabled="isItemizedCategory(category.id)"
              @save="saveSimpleCategoryValue(category.id, $event)"
            />

            <button
              type="button"
              class="category-link"
              :aria-label="t('assets.openCategory', { category: t(category.nameKey) })"
              @click="openCategory(category.id)"
            >
              <q-icon name="chevron_right" class="chevron" />
            </button>

            <q-btn
              flat
              round
              dense
              icon="more_vert"
              color="grey-7"
              :aria-label="t('assets.moreActions', { name: t(category.nameKey) })"
              @click.stop
            >
              <q-menu anchor="bottom right" self="top right">
                <q-list dense class="category-menu">
                  <q-item
                    clickable
                    v-close-popup
                    class="text-negative"
                    @click="requestCategoryDelete(category)"
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
          :label="t('assets.editCategories')"
          class="edit-categories"
          @click="editingCategories = true"
        />
      </template>
    </main>

    <q-dialog v-model="editingCategories" :maximized="$q.screen.lt.sm">
      <q-card class="category-dialog">
        <AssetCategorySetup
          edit-mode
          :initial-selected="assetsStore.enabledCategories"
          :saving="saving"
          @save="requestCategorySave"
          @cancel="editingCategories = false"
        />
      </q-card>
    </q-dialog>

    <q-dialog v-model="confirmDisable">
      <q-card class="confirm-card">
        <q-card-section>
          <h2>{{ t('assets.setup.disableTitle') }}</h2>
          <p>{{ t('assets.setup.disableDescription') }}</p>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps :label="t('common.cancel')" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="primary"
            :label="t('assets.setup.disableAction')"
            @click="savePendingCategories"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="confirmCategoryDelete">
      <q-card class="confirm-card">
        <q-card-section>
          <h2>{{ t('assets.deleteCategory.title') }}</h2>
          <p>
            {{
              t('assets.deleteCategory.description', {
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

    <q-dialog v-model="ownershipDialog">
      <q-card class="ownership-dialog-card">
        <q-card-section>
          <h2>{{ t('assets.ownership.label') }}</h2>
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
            @click="saveSimpleOwnership"
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
import { useRoute, useRouter } from 'vue-router'
import AssetCategorySetup from '@/components/assets/AssetCategorySetup.vue'
import OwnershipEditor from '@/components/assets/OwnershipEditor.vue'
import SimpleAssetValueEditor from '@/components/assets/SimpleAssetValueEditor.vue'
import MemberScopeSelector from '@/components/dashboard/MemberScopeSelector.vue'
import { assetCategories } from '@/config/asset-categories'
import { authUser } from '@/services/auth'
import { useAssetsStore } from '@/stores/assets-store'
import { useFinancialScopeStore } from '@/stores/financial-scope-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { cloneOwnership, isValidOwnership } from '@/domain/financial/ownership'
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
const editingCategories = ref(false)
const confirmDisable = ref(false)
const confirmCategoryDelete = ref(false)
const deletingCategory = ref(null)
const pendingSelection = ref(null)
const savingCategoryIds = ref(new Set())
const ownershipDialog = ref(false)
const editingOwnershipCategoryId = ref(null)
const editingOwnership = ref({ mode: 'single', shares: [] })
const ownershipValid = ref(false)

const workspaceId = computed(() => String(route.params.workspaceId))
const workspaceHomeRoute = computed(() => ({
  name: 'workspace-dashboard',
  params: { workspaceId: workspaceId.value },
}))
const workspace = computed(
  () => workspaceStore.workspaces.find((candidate) => candidate.id === workspaceId.value) || null,
)
const members = computed(() => getWorkspaceMembers(workspace.value, authUser.value))
const memberIds = computed(() => members.value.map((member) => member.id))
const selectedMemberId = computed({
  get: () => scopeStore.get(workspaceId.value, memberIds.value, authUser.value?.uid),
  set: (memberId) => scopeStore.select(workspaceId.value, memberId),
})
const enabledCategories = computed(() =>
  assetCategories.filter((category) => assetsStore.enabledCategories.includes(category.id)),
)
const total = computed(() => assetsStore.total(selectedMemberId.value))
const scopeLabel = computed(() =>
  selectedMemberId.value === 'all'
    ? t('dashboard.allMembers')
    : members.value.find((member) => member.id === selectedMemberId.value)?.name || '',
)

onMounted(() => loadAssets(workspaceId.value))
watch(workspaceId, (value) => loadAssets(value))

async function loadAssets(activeWorkspaceId) {
  await assetsStore.loadSummary(activeWorkspaceId)
}

async function completeSetup(selected) {
  await persist(() =>
    assetsStore.completeSetup(workspaceId.value, selected, authUser.value.uid, memberIds.value),
  )
}

function requestCategorySave(selected) {
  const removedWithData = assetsStore.enabledCategories.some(
    (categoryId) => !selected.includes(categoryId) && categoryHasData(categoryId),
  )

  if (removedWithData) {
    pendingSelection.value = selected
    confirmDisable.value = true
    return
  }

  saveCategorySelection(selected)
}

async function savePendingCategories() {
  confirmDisable.value = false
  await saveCategorySelection(pendingSelection.value)
  pendingSelection.value = null
}

async function saveCategorySelection(selected) {
  const saved = await persist(() =>
    assetsStore.saveCategorySelection(
      workspaceId.value,
      selected,
      authUser.value.uid,
      memberIds.value,
    ),
  )
  if (saved) editingCategories.value = false
}

function requestCategoryDelete(category) {
  deletingCategory.value = category
  confirmCategoryDelete.value = true
}

async function deleteCategory() {
  if (!deletingCategory.value || saving.value) return

  const saved = await persist(() =>
    assetsStore.deleteCategory(workspaceId.value, deletingCategory.value.id, authUser.value.uid),
  )

  if (saved) {
    confirmCategoryDelete.value = false
    deletingCategory.value = null
  }
}

function categoryHasData(categoryId) {
  const category = assetsStore.summary?.categories?.[categoryId]
  return Number(category?.manualValue || 0) > 0 || Number(category?.itemCount || 0) > 0
}

function categoryStatus(categoryId) {
  const category = assetsStore.summary?.categories?.[categoryId]
  if (Number(category?.itemCount || 0) > 0) {
    return t('assets.itemCount', { count: category.itemCount })
  }
  return t('assets.simpleTotal')
}

function categoryValue(categoryId) {
  return formatCurrency(assetsStore.totalForCategory(categoryId, selectedMemberId.value))
}

function categoryMembers(categoryId) {
  const category = assetsStore.summary?.categories?.[categoryId]
  const ownerIds = new Set(
    Number(category?.itemCount || 0) > 0
      ? Object.keys(category.memberValues || {})
      : (category?.ownership?.shares || [])
          .filter((share) => Number(share.percentage) > 0)
          .map((share) => share.memberId),
  )

  return members.value.filter((member) => ownerIds.has(member.id))
}

function categoryOwnershipLabel(categoryId) {
  return categoryMembers(categoryId)
    .map((member) => member.name)
    .join(', ')
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

function isItemizedCategory(categoryId) {
  return Number(assetsStore.summary?.categories?.[categoryId]?.itemCount || 0) > 0
}

function canonicalCategoryValue(categoryId) {
  return assetsStore.summary?.categories?.[categoryId]?.manualValue ?? 0
}

function isCategorySaving(categoryId) {
  return savingCategoryIds.value.has(categoryId)
}

async function saveSimpleCategoryValue(categoryId, value) {
  if (isCategorySaving(categoryId)) return

  savingCategoryIds.value = new Set(savingCategoryIds.value).add(categoryId)
  try {
    await assetsStore.updateSimpleCategoryValue(
      workspaceId.value,
      categoryId,
      value,
      authUser.value.uid,
    )
  } catch {
    $q.notify({ type: 'negative', message: t('assets.errors.save'), position: 'top' })
  } finally {
    const nextSavingIds = new Set(savingCategoryIds.value)
    nextSavingIds.delete(categoryId)
    savingCategoryIds.value = nextSavingIds
  }
}

function openOwnershipEditor(categoryId) {
  if (isItemizedCategory(categoryId)) return
  const ownership = assetsStore.summary?.categories?.[categoryId]?.ownership
  if (!ownership) return

  editingOwnershipCategoryId.value = categoryId
  editingOwnership.value = cloneOwnership(ownership)
  ownershipValid.value = isValidOwnership(editingOwnership.value, memberIds.value)
  ownershipDialog.value = true
}

async function saveSimpleOwnership() {
  if (!editingOwnershipCategoryId.value || !ownershipValid.value) return

  const saved = await persist(() =>
    assetsStore.updateSimpleCategoryOwnership(
      workspaceId.value,
      editingOwnershipCategoryId.value,
      cloneOwnership(editingOwnership.value),
      authUser.value.uid,
      memberIds.value,
    ),
  )

  if (saved) {
    ownershipDialog.value = false
    editingOwnershipCategoryId.value = null
  }
}

function openCategory(categoryId) {
  router.push({
    name: 'asset-category',
    params: { workspaceId: workspaceId.value, category: categoryId },
  })
}

async function persist(action) {
  saving.value = true
  try {
    await action()
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

.assets-page {
  @include financial-page;
}

.assets-shell {
  @include financial-shell;
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

.assets-header {
  @include financial-header;
}

.back-button {
  @include financial-back-button;
}

.eyebrow {
  @include financial-eyebrow;
}

h1 {
  @include financial-title;
}

.total-card {
  @include financial-total-card;
}

.total-card span,
.total-card small {
  @include financial-total-secondary;
}

.total-card strong {
  @include financial-total-value;
}

.total-card small {
  @include financial-total-meta;
}

.category-list {
  @include dashboard-card;
  overflow: hidden;
  margin-top: 1.25rem;
}

.category-row {
  display: grid;
  grid-template-columns: minmax(14rem, 1fr) auto auto auto auto;
  align-items: center;
  gap: 1rem;
  width: 100%;
  min-height: 5.6rem;
  border-bottom: 1px solid var(--color-line);
  background: var(--color-surface);
  color: var(--color-ink);
}

.category-menu {
  min-width: 10rem;
}

.category-row:last-child {
  border-bottom: 0;
}

.category-row:hover {
  background: var(--color-surface-soft);
}

.category-main {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 1rem;
  min-width: 0;
  min-height: 5.6rem;
  padding: 1rem 0 1rem 1.25rem;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.category-ownership {
  display: flex;
  padding-left: 0.45rem;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.category-ownership:disabled {
  cursor: default;
}

.category-ownership:not(:disabled):focus-visible {
  @include focus-ring;
}

.ownership-avatar {
  margin-left: -0.45rem;
  border: 2px solid var(--color-surface);
  background: #edf2f6;
  color: #334964;
  font-size: 0.75rem;
  font-weight: 750;
}

.category-main:focus-visible,
.category-link:focus-visible {
  @include focus-ring;
}

.category-icon {
  display: grid;
  place-items: center;
  width: 2.9rem;
  height: 2.9rem;
  border-radius: 50%;
  background: var(--color-green-soft);
  color: var(--color-success-dark);
  font-size: 1.3rem;
}

.category-copy strong,
.category-copy small {
  display: block;
}

.category-copy small {
  margin-top: 0.25rem;
  color: var(--color-copy);
}

.category-link {
  display: grid;
  place-items: center;
  width: 3rem;
  min-height: 5.6rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.chevron {
  color: var(--color-copy);
  font-size: 1.25rem;
}

.edit-categories {
  margin-top: 1rem;
}

.category-dialog {
  width: min(68rem, calc(100vw - 2rem));
  max-width: none;
  padding: clamp(1.25rem, 4vw, 2.5rem);
  border-radius: var(--radius-card);
}

.confirm-card {
  width: min(28rem, calc(100vw - 2rem));
  border-radius: var(--radius-md);
}

.ownership-dialog-card {
  width: min(34rem, calc(100vw - 2rem));
  border-radius: var(--radius-md);
}

.ownership-dialog-card h2 {
  margin: 0 0 1.25rem;
}

.confirm-card h2 {
  margin: 0;
  color: var(--color-ink);
}

.confirm-card p {
  margin: 0.75rem 0 0;
  color: var(--color-copy);
}

@media (max-width: 699px) {
  .assets-page {
    padding: 1.2rem;
  }

  .assets-header {
    align-items: flex-end;
    gap: 1rem;
  }

  .assets-header :deep(.member-selector) {
    max-width: 52%;
  }

  .category-row {
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 0.2rem 0.5rem;
    padding: 0.75rem 0.5rem 0.75rem 1rem;
  }

  .category-main {
    grid-column: 1;
    min-height: 3rem;
    padding: 0;
  }

  .category-row :deep(.simple-value) {
    grid-column: 2;
    grid-row: 2;
    justify-self: end;
  }

  .category-ownership {
    grid-column: 1;
    grid-row: 2;
  }

  .category-link {
    grid-column: 2;
    grid-row: 1;
    min-height: 3rem;
  }

  .category-row > .q-btn {
    grid-column: 3;
    grid-row: 1 / span 2;
  }

  .category-icon {
    grid-row: 1;
  }
}
</style>
