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
          @click="assetsStore.load(workspaceId, true)"
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

            <SimpleAssetValueEditor
              v-if="isSimpleCategory(category.id)"
              :value="canonicalCategoryValue(category.id)"
              :formatted-value="categoryValue(category.id)"
              :saving="isCategorySaving(category.id)"
              @save="saveSimpleCategoryValue(category.id, $event)"
            />
            <strong v-else class="category-value">{{ categoryValue(category.id) }}</strong>

            <button
              type="button"
              class="category-link"
              :aria-label="t('assets.openCategory', { category: t(category.nameKey) })"
              @click="openCategory(category.id)"
            >
              <q-icon name="chevron_right" class="chevron" />
            </button>
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
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AssetCategorySetup from '@/components/assets/AssetCategorySetup.vue'
import SimpleAssetValueEditor from '@/components/assets/SimpleAssetValueEditor.vue'
import MemberScopeSelector from '@/components/dashboard/MemberScopeSelector.vue'
import { assetCategories } from '@/config/asset-categories'
import { authUser } from '@/services/auth'
import { useAssetsStore } from '@/stores/assets-store'
import { useFinancialScopeStore } from '@/stores/financial-scope-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { createSingleOwnership } from '@/utils/asset-calculations'
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
const pendingSelection = ref(null)
const savingCategoryIds = ref(new Set())

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

onMounted(() => assetsStore.load(workspaceId.value))
watch(workspaceId, (value) => assetsStore.load(value))

async function completeSetup(selected) {
  const categories = buildCategories(selected)
  await persist(() => assetsStore.completeSetup(workspaceId.value, categories, authUser.value.uid))
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
  const categories = buildCategories(selected)
  const saved = await persist(() =>
    assetsStore.saveCategories(workspaceId.value, categories, authUser.value.uid),
  )
  if (saved) editingCategories.value = false
}

function buildCategories(selected) {
  const existing = assetsStore.config?.categories || {}
  const defaultMemberId = memberIds.value.includes(authUser.value?.uid)
    ? authUser.value.uid
    : memberIds.value[0]

  return Object.fromEntries(
    assetCategories.map((category) => [
      category.id,
      {
        mode: existing[category.id]?.mode || 'simple',
        manualValue: existing[category.id]?.manualValue ?? null,
        ownership: existing[category.id]?.ownership || createSingleOwnership(defaultMemberId),
        enabled: selected.includes(category.id),
      },
    ]),
  )
}

function categoryHasData(categoryId) {
  const category = assetsStore.config?.categories?.[categoryId]
  return category?.manualValue != null || assetsStore.itemsForCategory(categoryId).length > 0
}

function categoryStatus(categoryId) {
  const category = assetsStore.config?.categories?.[categoryId]
  if (category?.mode === 'itemized') {
    return t('assets.itemCount', { count: assetsStore.itemsForCategory(categoryId).length })
  }
  return t('assets.simpleTotal')
}

function categoryValue(categoryId) {
  return formatCurrency(assetsStore.totalForCategory(categoryId, selectedMemberId.value))
}

function isSimpleCategory(categoryId) {
  return assetsStore.config?.categories?.[categoryId]?.mode === 'simple'
}

function canonicalCategoryValue(categoryId) {
  return assetsStore.config?.categories?.[categoryId]?.manualValue ?? 0
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
  min-height: calc(100vh - 64px);
  min-height: calc(100dvh - 64px);
  padding: clamp(1.5rem, 4vw, 3rem);
  background: var(--color-page);
}

.assets-shell {
  width: 100%;
  max-width: 64rem;
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

.assets-header {
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

.eyebrow {
  color: var(--color-primary);
  font-size: 0.75rem;
  font-weight: 750;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

h1 {
  margin: 0.35rem 0 0;
  color: var(--color-ink);
  font-size: clamp(2.4rem, 5vw, 4rem);
  line-height: 1;
  letter-spacing: -0.05em;
}

.total-card {
  @include dashboard-card;
  display: grid;
  margin-top: 2rem;
  padding: clamp(1.5rem, 4vw, 2.5rem);
}

.total-card span,
.total-card small {
  color: var(--color-copy);
}

.total-card strong {
  margin-top: 0.4rem;
  color: var(--color-ink);
  font-size: clamp(2.75rem, 7vw, 5rem);
  line-height: 1;
  letter-spacing: -0.055em;
}

.total-card small {
  margin-top: 0.65rem;
}

.category-list {
  @include dashboard-card;
  overflow: hidden;
  margin-top: 1.25rem;
}

.category-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 1rem;
  width: 100%;
  min-height: 5.6rem;
  border-bottom: 1px solid var(--color-line);
  background: var(--color-surface);
  color: var(--color-ink);
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
  grid-column: 1 / 3;
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

.category-value {
  font-size: 1.15rem;
  white-space: nowrap;
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
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.2rem 0.5rem;
    padding: 0.75rem 0.5rem 0.75rem 1rem;
  }

  .category-main {
    grid-column: 1;
    min-height: 3rem;
    padding: 0;
  }

  .category-value,
  .category-row :deep(.simple-value) {
    grid-column: 1;
    grid-row: 2;
    justify-self: end;
  }

  .category-link {
    grid-column: 2;
    grid-row: 1 / span 2;
    min-height: 4.5rem;
  }

  .category-icon {
    grid-row: 1;
  }
}
</style>
