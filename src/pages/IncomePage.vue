<template>
  <q-page class="income-page">
    <main class="income-shell">
      <div v-if="incomeStore.loading" class="state">
        <q-spinner color="primary" size="2rem" /><span>{{ t('income.loading') }}</span>
      </div>
      <section v-else-if="incomeStore.error" class="state">
        <q-icon name="cloud_off" size="2rem" />
        <h1>{{ t('income.errors.loadTitle') }}</h1>
        <p>{{ t('income.errors.load') }}</p>
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon="refresh"
          :label="t('common.retry')"
          @click="incomeStore.loadSummary(workspaceId, true)"
        />
      </section>
      <IncomeCategorySetup
        v-else-if="!incomeStore.setupCompleted"
        :saving="saving"
        @save="completeSetup"
      />
      <template v-else>
        <header class="income-header">
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
            <div class="eyebrow">{{ t('income.eyebrow') }}</div>
            <h1>{{ t('income.title') }}</h1>
          </div>
          <MemberScopeSelector v-model="selectedMemberId" :members="members" />
        </header>
        <section class="total-card">
          <span>{{ t('income.totalIncome') }}</span
          ><strong>{{ formatCurrency(total) }}</strong
          ><small>{{ t('income.annualTotal') }} · {{ scopeLabel }}</small>
        </section>
        <section class="category-list" :aria-label="t('income.enabledCategories')">
          <div v-for="category in enabledCategories" :key="category.id" class="category-row">
            <button type="button" class="category-main" @click="openCategory(category.id)">
              <span class="category-icon"><q-icon :name="category.icon" /></span
              ><span class="category-copy"
                ><strong>{{ t(category.nameKey) }}</strong
                ><small>{{ categoryStatus(category.id) }}</small></span
              >
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
                ><img v-if="member.photoURL" :src="member.photoURL" alt="" /><span v-else>{{
                  initials(member.name)
                }}</span></q-avatar
              >
            </button>
            <SimpleIncomeValueEditor
              :value="canonicalCategoryValue(category.id)"
              :formatted-value="`${categoryValue(category.id)} / ${t('dashboard.year')}`"
              :saving="isCategorySaving(category.id)"
              :disabled="isItemizedCategory(category.id)"
              @save="saveSimpleCategoryValue(category.id, $event)"
            />
            <button
              type="button"
              class="category-link"
              :aria-label="t('income.openCategory', { category: t(category.nameKey) })"
              @click="openCategory(category.id)"
            >
              <q-icon name="chevron_right" />
            </button>
            <q-btn flat round dense icon="more_vert" color="grey-7" @click.stop
              ><q-menu
                ><q-list dense
                  ><q-item
                    clickable
                    v-close-popup
                    class="text-negative"
                    @click="requestCategoryDelete(category)"
                    ><q-item-section avatar><q-icon name="delete_outline" /></q-item-section
                    ><q-item-section>{{ t('common.delete') }}</q-item-section></q-item
                  ></q-list
                ></q-menu
              ></q-btn
            >
          </div>
        </section>
        <q-btn
          flat
          no-caps
          icon="tune"
          color="primary"
          :label="t('income.editCategories')"
          class="edit-categories"
          @click="editingCategories = true"
        />
      </template>
    </main>

    <q-dialog v-model="editingCategories" :maximized="$q.screen.lt.sm"
      ><q-card class="category-dialog"
        ><IncomeCategorySetup
          edit-mode
          :initial-selected="incomeStore.enabledCategories"
          :saving="saving"
          @save="requestCategorySave"
          @cancel="editingCategories = false" /></q-card
    ></q-dialog>
    <q-dialog v-model="confirmDisable"
      ><q-card class="confirm-card"
        ><q-card-section
          ><h2>{{ t('income.setup.disableTitle') }}</h2>
          <p>{{ t('income.setup.disableDescription') }}</p></q-card-section
        ><q-card-actions align="right"
          ><q-btn flat no-caps :label="t('common.cancel')" v-close-popup /><q-btn
            unelevated
            no-caps
            color="primary"
            :label="t('income.setup.disableAction')"
            @click="savePendingCategories" /></q-card-actions></q-card
    ></q-dialog>
    <q-dialog v-model="confirmCategoryDelete"
      ><q-card class="confirm-card"
        ><q-card-section
          ><h2>{{ t('income.deleteCategory.title') }}</h2>
          <p>
            {{
              t('income.deleteCategory.description', {
                name: deletingCategory ? t(deletingCategory.nameKey) : '',
              })
            }}
          </p></q-card-section
        ><q-card-actions align="right"
          ><q-btn flat no-caps :label="t('common.cancel')" v-close-popup /><q-btn
            unelevated
            no-caps
            color="negative"
            :label="t('common.delete')"
            :loading="saving"
            @click="deleteCategory" /></q-card-actions></q-card
    ></q-dialog>
    <q-dialog v-model="ownershipDialog"
      ><q-card class="ownership-dialog"
        ><q-card-section
          ><h2>{{ t('income.ownership.label') }}</h2>
          <OwnershipEditor
            v-if="editingOwnershipCategoryId"
            v-model="editingOwnership"
            :members="members"
            @validity="ownershipValid = $event" /></q-card-section
        ><q-card-actions align="right"
          ><q-btn flat no-caps :label="t('common.cancel')" v-close-popup /><q-btn
            unelevated
            no-caps
            color="primary"
            :label="t('common.save')"
            :loading="saving"
            :disable="!ownershipValid"
            @click="saveSimpleOwnership" /></q-card-actions></q-card
    ></q-dialog>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import OwnershipEditor from '@/components/assets/OwnershipEditor.vue'
import MemberScopeSelector from '@/components/dashboard/MemberScopeSelector.vue'
import IncomeCategorySetup from '@/components/income/IncomeCategorySetup.vue'
import SimpleIncomeValueEditor from '@/components/income/SimpleIncomeValueEditor.vue'
import { incomeCategories } from '@/config/income-categories'
import { cloneOwnership, isValidOwnership } from '@/domain/financial/ownership'
import { authUser } from '@/services/auth'
import { useFinancialScopeStore } from '@/stores/financial-scope-store'
import { useIncomeStore } from '@/stores/income-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { formatCurrency } from '@/utils/formatters'
import { getWorkspaceMembers } from '@/utils/workspace-members'

const $q = useQuasar()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const incomeStore = useIncomeStore()
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
  incomeCategories.filter((category) => incomeStore.enabledCategories.includes(category.id)),
)
const total = computed(() => incomeStore.total(selectedMemberId.value))
const scopeLabel = computed(() =>
  selectedMemberId.value === 'all'
    ? t('dashboard.allMembers')
    : members.value.find((member) => member.id === selectedMemberId.value)?.name || '',
)
onMounted(() => incomeStore.loadSummary(workspaceId.value))
watch(workspaceId, (value) => incomeStore.loadSummary(value))

async function completeSetup(selected) {
  await persist(() =>
    incomeStore.completeSetup(workspaceId.value, selected, authUser.value.uid, memberIds.value),
  )
}
function requestCategorySave(selected) {
  const removedWithData = incomeStore.enabledCategories.some(
    (id) => !selected.includes(id) && categoryHasData(id),
  )
  if (removedWithData) {
    pendingSelection.value = selected
    confirmDisable.value = true
  } else saveCategorySelection(selected)
}
async function savePendingCategories() {
  confirmDisable.value = false
  await saveCategorySelection(pendingSelection.value)
  pendingSelection.value = null
}
async function saveCategorySelection(selected) {
  const saved = await persist(() =>
    incomeStore.saveCategorySelection(
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
    incomeStore.deleteCategory(workspaceId.value, deletingCategory.value.id, authUser.value.uid),
  )
  if (saved) {
    confirmCategoryDelete.value = false
    deletingCategory.value = null
  }
}
function categoryHasData(id) {
  const category = incomeStore.summary?.categories?.[id]
  return Number(category?.manualValue || 0) > 0 || Number(category?.itemCount || 0) > 0
}
function categoryStatus(id) {
  const count = Number(incomeStore.summary?.categories?.[id]?.itemCount || 0)
  return count ? t('income.itemCount', { count }) : t('income.simpleTotal')
}
function categoryValue(id) {
  return formatCurrency(incomeStore.totalForCategory(id, selectedMemberId.value))
}
function categoryMembers(id) {
  const category = incomeStore.summary?.categories?.[id]
  const ownerIds = new Set(
    Number(category?.itemCount || 0) > 0
      ? Object.keys(category.memberValues || {})
      : (category?.ownership?.shares || [])
          .filter((share) => Number(share.percentage) > 0)
          .map((share) => share.memberId),
  )
  return members.value.filter((member) => ownerIds.has(member.id))
}
function categoryOwnershipLabel(id) {
  return categoryMembers(id)
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
function isItemizedCategory(id) {
  return Number(incomeStore.summary?.categories?.[id]?.itemCount || 0) > 0
}
function canonicalCategoryValue(id) {
  return incomeStore.summary?.categories?.[id]?.manualValue ?? 0
}
function isCategorySaving(id) {
  return savingCategoryIds.value.has(id)
}
async function saveSimpleCategoryValue(id, value) {
  if (isCategorySaving(id)) return
  savingCategoryIds.value = new Set(savingCategoryIds.value).add(id)
  try {
    await incomeStore.updateSimpleCategoryValue(workspaceId.value, id, value, authUser.value.uid)
  } catch {
    $q.notify({ type: 'negative', message: t('income.errors.save'), position: 'top' })
  } finally {
    const next = new Set(savingCategoryIds.value)
    next.delete(id)
    savingCategoryIds.value = next
  }
}
function openOwnershipEditor(id) {
  if (isItemizedCategory(id)) return
  const ownership = incomeStore.summary?.categories?.[id]?.ownership
  if (!ownership) return
  editingOwnershipCategoryId.value = id
  editingOwnership.value = cloneOwnership(ownership)
  ownershipValid.value = isValidOwnership(editingOwnership.value, memberIds.value)
  ownershipDialog.value = true
}
async function saveSimpleOwnership() {
  if (!editingOwnershipCategoryId.value || !ownershipValid.value) return
  const saved = await persist(() =>
    incomeStore.updateSimpleCategoryOwnership(
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
function openCategory(id) {
  router.push({ name: 'income-category', params: { workspaceId: workspaceId.value, category: id } })
}
async function persist(action) {
  saving.value = true
  try {
    await action()
    return true
  } catch {
    $q.notify({ type: 'negative', message: t('income.errors.save'), position: 'top' })
    return false
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;
.income-page {
  @include financial-page;
}
.income-shell {
  @include financial-shell;
}
.state {
  display: grid;
  place-items: center;
  gap: 0.75rem;
  min-height: 24rem;
  text-align: center;
  color: var(--color-copy);
}
.state h1,
.state p {
  margin: 0;
}
.income-header {
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
  margin-top: 1.25rem;
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}
.category-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto auto auto;
  align-items: center;
  gap: 0.75rem;
  min-height: 5.5rem;
  padding: 0.75rem 1rem;
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
  gap: 1rem;
  color: var(--color-ink);
  text-align: left;
}
.category-icon {
  display: grid;
  place-items: center;
  flex: 0 0 3rem;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: var(--color-green-soft);
  color: var(--color-success-dark);
  font-size: 1.35rem;
}
.category-copy strong,
.category-copy small {
  display: block;
}
.category-copy small {
  margin-top: 0.2rem;
  color: var(--color-copy);
}
.category-ownership {
  display: flex;
}
.category-ownership:disabled {
  cursor: default;
}
.ownership-avatar {
  margin-left: -0.45rem;
  border: 2px solid white;
  background: #edf2f6;
}
.category-link {
  color: var(--color-copy);
  font-size: 1.25rem;
}
.edit-categories {
  margin-top: 1rem;
}
.category-dialog {
  width: min(68rem, calc(100vw - 2rem));
  padding: clamp(1rem, 4vw, 2.5rem);
}
.confirm-card,
.ownership-dialog {
  width: min(32rem, calc(100vw - 2rem));
  border-radius: var(--radius-card);
}
@media (max-width: 760px) {
  .income-header {
    align-items: flex-start;
    flex-direction: column;
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
  .simple-value {
    font-size: 1rem;
  }
}
</style>
