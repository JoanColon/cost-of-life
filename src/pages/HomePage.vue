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
          </button>

          <q-btn
            flat
            round
            dense
            color="grey-7"
            icon="more_vert"
            class="workspace-actions"
            :aria-label="t('workspace.moreActions', { name: workspace.name })"
          >
            <q-menu anchor="bottom right" self="top right">
              <q-list dense class="workspace-menu">
                <q-item clickable v-close-popup @click="requestInvite(workspace)">
                  <q-item-section avatar><q-icon name="person_add_alt" /></q-item-section>
                  <q-item-section>{{ t('workspace.invite.action') }}</q-item-section>
                </q-item>
                <q-item
                  v-if="isWorkspaceOwner(workspace)"
                  clickable
                  v-close-popup
                  class="text-negative"
                  @click="requestDelete(workspace)"
                >
                  <q-item-section avatar><q-icon name="delete_outline" /></q-item-section>
                  <q-item-section>{{ t('common.delete') }}</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </article>
      </section>
    </main>

    <q-dialog v-model="deleteDialog" persistent @hide="clearDeleteRequest">
      <q-card class="confirm-card">
        <q-btn
          flat
          round
          dense
          icon="close"
          class="dialog-close"
          :aria-label="t('common.cancel')"
          :disable="deleting"
          v-close-popup
        />
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

    <q-dialog v-model="inviteDialog" persistent @hide="clearInviteRequest">
      <q-card class="confirm-card">
        <q-btn
          flat
          round
          dense
          icon="close"
          class="dialog-close"
          :aria-label="t('common.cancel')"
          :disable="creatingInvite"
          v-close-popup
        />
        <q-card-section>
          <h2>{{ t('workspace.invite.title') }}</h2>
          <p>{{ t('workspace.invite.description', { name: workspaceToInvite?.name || '' }) }}</p>

          <div v-if="creatingInvite" class="invite-loading">
            <q-spinner color="primary" size="2rem" />
            <span>{{ t('workspace.invite.creating') }}</span>
          </div>

          <q-banner v-else-if="inviteError" rounded class="invite-error">
            <template #avatar><q-icon name="error_outline" color="negative" /></template>
            {{ t('workspace.invite.errors.create') }}
          </q-banner>

          <q-input
            v-else-if="inviteLink"
            :model-value="inviteLink"
            outlined
            :dense="$q.screen.lt.sm"
            readonly
            :label="t('workspace.invite.linkLabel')"
            class="invite-link"
          />
        </q-card-section>
        <q-card-actions v-if="inviteLink" align="right">
          <q-btn
            v-if="canShare"
            flat
            no-caps
            icon="share"
            :label="t('workspace.invite.share')"
            @click="shareInvite"
          />
          <q-btn
            unelevated
            no-caps
            color="primary"
            icon="content_copy"
            :label="t('workspace.invite.copy')"
            @click="copyInvite"
          />
        </q-card-actions>
        <q-card-actions v-else-if="inviteError" align="right">
          <q-btn
            unelevated
            no-caps
            color="primary"
            :label="t('common.retry')"
            @click="generateInvite"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import WorkspaceForm from '@/components/workspace/WorkspaceForm.vue'
import { authUser } from '@/services/auth'
import { createWorkspaceInvite } from '@/services/firebase/workspace.service'
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
const inviteDialog = ref(false)
const creatingInvite = ref(false)
const workspaceToInvite = ref(null)
const inviteLink = ref('')
const inviteError = ref(null)
const canShare = computed(() => typeof navigator.share === 'function')

async function openWorkspace(workspaceId) {
  await workspaceStore.setActiveWorkspace(workspaceId)
  await router.push({ name: 'workspace-dashboard', params: { workspaceId } })
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

function requestInvite(workspace) {
  workspaceToInvite.value = workspace
  inviteDialog.value = true
  generateInvite()
}

async function generateInvite() {
  if (!workspaceToInvite.value || creatingInvite.value) return

  creatingInvite.value = true
  inviteLink.value = ''
  inviteError.value = null
  try {
    const { token } = await createWorkspaceInvite(workspaceToInvite.value.id)
    const routePath = router.resolve({ name: 'workspace-invite', params: { token } }).href
    const appOrigin = $q.platform.is.capacitor
      ? import.meta.env.VITE_APP_URL || 'https://cost-of-life-f23b2.web.app'
      : window.location.origin
    inviteLink.value = new URL(routePath, appOrigin).href
  } catch (error) {
    inviteError.value = error
  } finally {
    creatingInvite.value = false
  }
}

async function copyInvite() {
  try {
    await copyText(inviteLink.value)
    $q.notify({ type: 'positive', message: t('workspace.invite.copied'), position: 'top' })
  } catch {
    $q.notify({ type: 'negative', message: t('workspace.invite.errors.copy'), position: 'top' })
  }
}

async function shareInvite() {
  try {
    await navigator.share({
      title: t('workspace.invite.shareTitle'),
      text: t('workspace.invite.shareText', { name: workspaceToInvite.value?.name || '' }),
      url: inviteLink.value,
    })
  } catch (error) {
    if (error?.name !== 'AbortError') {
      $q.notify({ type: 'negative', message: t('workspace.invite.errors.share'), position: 'top' })
    }
  }
}

function copyText(value) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value)

  const input = document.createElement('textarea')
  input.value = value
  input.style.position = 'fixed'
  input.style.opacity = '0'
  document.body.appendChild(input)
  input.select()
  const copied = document.execCommand('copy')
  input.remove()
  if (!copied) throw new Error('Copy failed')
}

function clearInviteRequest() {
  if (creatingInvite.value) return
  workspaceToInvite.value = null
  inviteLink.value = ''
  inviteError.value = null
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

async function workspaceCreated({ workspace }) {
  $q.notify({
    type: 'positive',
    message: t('workspace.created'),
    position: 'top',
  })
  await router.replace({ name: 'workspace-dashboard', params: { workspaceId: workspace.id } })
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;

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

h1 {
  margin: 0;
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
  grid-template-columns: auto minmax(0, 1fr);
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

.workspace-actions {
  margin-right: 0.75rem;
}

.workspace-menu {
  min-width: 10rem;
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

.confirm-card {
  @include financial-simple-dialog;
}

.invite-loading {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 4rem;
  color: var(--color-copy);
}

.invite-link {
  margin-top: 1.25rem;
}

.invite-error {
  margin-top: 1.25rem;
  background: #fff0ef;
  color: #7d2823;
}

@media (max-width: 699px) {
  .hub-header {
    align-items: stretch;
    flex-direction: column;
    gap: 1.25rem;
  }
}
</style>
