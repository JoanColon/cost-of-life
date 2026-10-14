<template>
  <q-page class="global-home-page">
    <WorkspaceForm
      v-if="!workspaceStore.hasWorkspaces"
      first-workspace
      @created="workspaceCreated"
    />

    <main v-else class="workspace-hub">
      <header class="hub-header">
        <div>
          <div class="eyebrow">{{ t('home.eyebrow') }}</div>
          <h1>{{ t('home.workspacesTitle') }}</h1>
          <p>{{ t('home.workspacesDescription') }}</p>
        </div>
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon="add"
          :label="t('navigation.createWorkspace')"
          :to="{ name: 'create-workspace' }"
        />
      </header>

      <section class="workspace-grid" :aria-label="t('navigation.workspaces')">
        <article
          v-for="workspace in workspaceStore.workspaces"
          :key="workspace.id"
          class="workspace-tile"
        >
          <button type="button" class="workspace-open" @click="openWorkspace(workspace.id)">
            <span class="workspace-icon">
              <q-icon :name="isSharedWorkspace(workspace) ? 'group' : 'person_outline'" />
            </span>
            <span class="workspace-copy">
              <strong>{{ workspace.name }}</strong>
              <small>{{ workspaceDescription(workspace) }}</small>
            </span>
            <q-icon name="arrow_forward" class="workspace-arrow" />
          </button>

          <q-btn
            v-if="isWorkspaceOwner(workspace)"
            flat
            round
            color="negative"
            icon="delete_outline"
            class="workspace-delete"
            :aria-label="t('workspace.deleteAction', { name: workspace.name })"
            @click="requestDelete(workspace)"
          >
            <q-tooltip>{{ t('workspace.deleteAction', { name: workspace.name }) }}</q-tooltip>
          </q-btn>
        </article>
      </section>
    </main>

    <q-dialog v-model="deleteDialog" persistent @hide="clearDeleteRequest">
      <q-card class="confirm-card">
        <q-card-section>
          <h2>{{ t('workspace.delete.title') }}</h2>
          <p>
            {{ t('workspace.delete.description', { name: workspaceToDelete?.name || '' }) }}
          </p>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps :label="t('common.cancel')" :disable="deleting" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="negative"
            :label="t('common.delete')"
            :loading="deleting"
            @click="deleteWorkspace"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import WorkspaceForm from '@/components/workspace/WorkspaceForm.vue'
import { authUser } from '@/services/auth'
import { useFinancialYearsStore } from '@/stores/financial-years-store'
import { useWorkspaceStore } from '@/stores/workspace-store'

const $q = useQuasar()
const { t } = useI18n()
const router = useRouter()
const financialYearsStore = useFinancialYearsStore()
const workspaceStore = useWorkspaceStore()
const deleteDialog = ref(false)
const deleting = ref(false)
const workspaceToDelete = ref(null)

function openWorkspace(workspaceId) {
  router.push({ name: 'workspace-dashboard', params: { workspaceId } })
}

function workspaceDescription(workspace) {
  const memberCount = Object.keys(workspace.members || {}).length
  return memberCount > 1
    ? t('home.memberCount', { count: memberCount })
    : t('home.personalWorkspace')
}

function isSharedWorkspace(workspace) {
  return Object.keys(workspace.members || {}).length > 1
}

function isWorkspaceOwner(workspace) {
  return workspace.members?.[authUser.value?.uid]?.role === 'owner'
}

function requestDelete(workspace) {
  workspaceToDelete.value = workspace
  deleteDialog.value = true
}

function clearDeleteRequest() {
  if (!deleting.value) workspaceToDelete.value = null
}

async function deleteWorkspace() {
  if (!workspaceToDelete.value || deleting.value) return

  deleting.value = true
  try {
    const workspaceId = workspaceToDelete.value.id
    await workspaceStore.deleteWorkspace(workspaceId)
    financialYearsStore.clearWorkspace(workspaceId)
    deleteDialog.value = false
    workspaceToDelete.value = null
    $q.notify({ type: 'positive', message: t('workspace.deleted'), position: 'top' })
  } catch {
    $q.notify({ type: 'negative', message: t('workspace.errors.delete'), position: 'top' })
  } finally {
    deleting.value = false
  }
}

async function workspaceCreated({ workspace, hasPendingInvite }) {
  $q.notify({
    type: 'positive',
    message: hasPendingInvite ? t('workspace.pendingInvite') : t('workspace.created'),
    position: 'top',
  })
  await router.replace({ name: 'workspace-dashboard', params: { workspaceId: workspace.id } })
}
</script>

<style scoped lang="scss">
.global-home-page {
  min-height: calc(100vh - 64px);
  min-height: calc(100dvh - 64px);
  padding: clamp(1rem, 5vw, 3rem);
  background: var(--color-page);
}

.global-home-page:has(> .workspace-card) {
  display: grid;
  place-items: center;
}

.workspace-hub {
  width: 100%;
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.hub-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 2rem;
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
  font-size: clamp(2.25rem, 5vw, 4rem);
  line-height: 1;
  letter-spacing: -0.05em;
}

.hub-header p {
  margin: 0.75rem 0 0;
  color: var(--color-copy);
}

.workspace-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(20rem, 100%), 1fr));
  gap: 1rem;
  margin-top: 2rem;
}

.workspace-tile {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  min-height: 7rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  color: var(--color-ink);
  box-shadow: var(--shadow-card);
  overflow: hidden;
  transition:
    border-color 160ms ease,
    transform 160ms ease;
}

.workspace-tile:hover {
  border-color: rgb(22 136 248 / 35%);
  transform: translateY(-2px);
}

.workspace-open:focus-visible {
  outline: 3px solid rgb(22 136 248 / 22%);
  outline-offset: -3px;
}

.workspace-open {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
  min-width: 0;
  min-height: 7rem;
  padding: 1.25rem;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.workspace-delete {
  margin-right: 0.75rem;
}

.workspace-icon {
  display: grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: var(--color-blue-soft);
  color: var(--color-primary);
  font-size: 1.4rem;
}

.workspace-copy strong,
.workspace-copy small {
  display: block;
}

.workspace-copy strong {
  font-size: 1.05rem;
}

.workspace-copy small {
  margin-top: 0.25rem;
  color: var(--color-copy);
}

.workspace-arrow {
  color: var(--color-copy);
  font-size: 1.25rem;
}

.confirm-card {
  width: min(32rem, calc(100vw - 2rem));
  border-radius: var(--radius-card);
}

.confirm-card h2 {
  margin: 0;
  color: var(--color-ink);
}

.confirm-card p {
  margin: 0.75rem 0 0;
  color: var(--color-copy);
  line-height: 1.6;
}

@media (max-width: 699px) {
  .hub-header {
    align-items: stretch;
    flex-direction: column;
    gap: 1.25rem;
  }
}
</style>
