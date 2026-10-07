<template>
  <q-layout view="hHh Lpr fFf" class="app-layout">
    <q-header v-if="showAppHeader" class="app-header">
      <q-toolbar class="app-toolbar">
        <q-btn
          flat
          round
          dense
          icon="menu"
          :aria-label="t('navigation.workspaces')"
          @click="drawerOpen = !drawerOpen"
        />
        <div class="mini-mark">C</div>
        <q-toolbar-title class="app-title">Cost of Life</q-toolbar-title>

        <q-select
          v-if="workspaceStore.hasWorkspaces"
          :model-value="activeWorkspaceId"
          :options="workspaceOptions"
          :display-value="activeWorkspace?.name || t('navigation.workspaces')"
          emit-value
          map-options
          dense
          borderless
          options-dense
          class="workspace-selector"
          :aria-label="t('home.activeWorkspace')"
          @update:model-value="openWorkspace"
        >
          <template #prepend><q-icon name="workspaces_outline" size="1.15rem" /></template>
        </q-select>

        <q-btn
          flat
          round
          icon="logout"
          :aria-label="t('navigation.signOut')"
          :loading="loggingOut"
          @click="logout"
        >
          <q-tooltip>{{ t('navigation.signOut') }}</q-tooltip>
        </q-btn>
      </q-toolbar>
    </q-header>

    <q-drawer v-model="drawerOpen" show-if-above bordered :width="280" class="app-drawer">
      <div class="drawer-brand">
        <div class="drawer-mark">C</div>
        <div>
          <div class="drawer-title">Cost of Life</div>
          <div class="drawer-caption">{{ authUser?.email }}</div>
        </div>
      </div>

      <q-list padding class="q-px-sm">
        <q-item
          v-ripple
          clickable
          :to="{ name: 'home' }"
          exact
          active-class="active-nav-item"
          @click="closeMobileDrawer"
        >
          <q-item-section avatar><q-icon name="space_dashboard" /></q-item-section>
          <q-item-section>{{ t('navigation.home') }}</q-item-section>
        </q-item>

        <q-item
          v-ripple
          clickable
          :to="{ name: 'create-workspace' }"
          exact
          active-class="active-nav-item"
          @click="closeMobileDrawer"
        >
          <q-item-section avatar><q-icon name="add_business" /></q-item-section>
          <q-item-section>{{ t('navigation.createWorkspace') }}</q-item-section>
        </q-item>
      </q-list>

      <q-separator class="q-my-sm" />

      <div v-if="workspaceStore.hasWorkspaces" class="workspace-list">
        <div class="workspace-list-label">{{ t('navigation.workspaces') }}</div>
        <q-list dense>
          <q-item
            v-for="workspace in workspaceStore.workspaces"
            :key="workspace.id"
            v-ripple
            clickable
            :to="workspaceRoute(workspace.id)"
            exact
            :active="workspace.id === activeWorkspaceId"
            active-class="active-workspace"
            @click="closeMobileDrawer"
          >
            <q-item-section avatar>
              <q-icon :name="isSharedWorkspace(workspace) ? 'group' : 'person_outline'" />
            </q-item-section>
            <q-item-section>{{ workspace.name }}</q-item-section>
            <q-item-section v-if="workspace.id === activeWorkspaceId" side>
              <q-icon name="check" color="primary" />
            </q-item-section>
          </q-item>
        </q-list>
      </div>
    </q-drawer>

    <q-page-container>
      <div v-if="workspaceStore.loading" class="loading-state">
        <q-spinner color="primary" size="2rem" />
        <span>{{ t('home.loadingWorkspace') }}</span>
      </div>
      <router-view v-else :key="route.fullPath" />
    </q-page-container>

    <q-footer v-if="showMobileNavigation" class="mobile-footer">
      <MobileBottomNav />
    </q-footer>
  </q-layout>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import MobileBottomNav from '@/components/dashboard/MobileBottomNav.vue'
import { authUser, signOut } from '@/services/auth'
import { useAssetsStore } from '@/stores/assets-store'
import { useFinancialScopeStore } from '@/stores/financial-scope-store'
import { useIncomeStore } from '@/stores/income-store'
import { useLiabilitiesStore } from '@/stores/liabilities-store'
import { useWorkspaceStore } from '@/stores/workspace-store'

const $q = useQuasar()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const assetsStore = useAssetsStore()
const liabilitiesStore = useLiabilitiesStore()
const incomeStore = useIncomeStore()
const scopeStore = useFinancialScopeStore()
const workspaceStore = useWorkspaceStore()

const drawerOpen = ref($q.screen.gt.sm)
const loggingOut = ref(false)
const workspacesReady = ref(false)
const workspaceOptions = computed(() =>
  workspaceStore.workspaces.map((workspace) => ({
    label: workspace.name,
    value: workspace.id,
  })),
)
const activeWorkspaceId = computed(() => {
  const workspaceId = route.params.workspaceId
  if (typeof workspaceId !== 'string') return null

  return workspaceStore.workspaces.some((workspace) => workspace.id === workspaceId)
    ? workspaceId
    : null
})
const activeWorkspace = computed(
  () =>
    workspaceStore.workspaces.find((workspace) => workspace.id === activeWorkspaceId.value) || null,
)
const isWorkspaceDashboard = computed(() => route.name === 'workspace-dashboard')
const showAppHeader = computed(() => $q.screen.gt.sm || !isWorkspaceDashboard.value)
const showMobileNavigation = computed(() => $q.screen.lt.md && Boolean(activeWorkspaceId.value))

onMounted(async () => {
  if (!authUser.value) return

  try {
    await workspaceStore.load(authUser.value)
    workspacesReady.value = true
    syncWorkspaceFromRoute()
  } catch {
    $q.notify({ type: 'negative', message: t('workspace.errors.load'), position: 'top' })
  }
})

watch(() => route.fullPath, syncWorkspaceFromRoute)

function syncWorkspaceFromRoute() {
  if (!workspacesReady.value) return

  const workspaceId = route.params.workspaceId
  if (typeof workspaceId !== 'string') {
    workspaceStore.select(null)
    return
  }

  const workspaceExists = workspaceStore.workspaces.some(
    (workspace) => workspace.id === workspaceId,
  )
  if (workspaceExists) {
    workspaceStore.select(workspaceId)
  } else {
    workspaceStore.select(null)
    router.replace({ name: 'home' })
  }
}

async function openWorkspace(workspaceId) {
  if (!workspaceId) return

  closeMobileDrawer()
  await router.push(workspaceRoute(workspaceId))
}

function workspaceRoute(workspaceId) {
  return { name: 'workspace-dashboard', params: { workspaceId } }
}

function closeMobileDrawer() {
  if ($q.screen.lt.md) drawerOpen.value = false
}

function isSharedWorkspace(workspace) {
  return Object.keys(workspace.members || {}).length > 1
}

async function logout() {
  loggingOut.value = true

  try {
    assetsStore.reset()
    liabilitiesStore.reset()
    incomeStore.reset()
    scopeStore.reset()
    workspaceStore.reset()
    await signOut()
    await router.replace({ name: 'login' })
  } finally {
    loggingOut.value = false
  }
}
</script>

<style scoped lang="scss">
.app-layout {
  background: var(--color-page);
}

.app-header {
  background: rgb(255 255 255 / 92%);
  color: var(--color-ink);
  border-bottom: 1px solid var(--color-line);
  backdrop-filter: blur(12px);
}

.app-toolbar {
  min-height: 64px;
  gap: 0.5rem;
  padding-right: max(1rem, env(safe-area-inset-right));
  padding-left: max(1rem, env(safe-area-inset-left));
}

.mini-mark,
.drawer-mark {
  display: grid;
  place-items: center;
  border-radius: 0.7rem;
  background: #285b48;
  color: white;
  font-family: Georgia, serif;
}

.mini-mark {
  width: 2.25rem;
  height: 2.25rem;
  margin-left: 0.5rem;
  font-size: 1.2rem;
}

.app-title {
  font-family: Georgia, serif;
  font-size: 1.2rem;
}

.workspace-selector {
  flex: 0 1 15rem;
  min-width: 0;
  max-width: 15rem;
  margin-right: 0.5rem;
}

.app-drawer {
  background: var(--color-surface);
  color: var(--color-ink);
}

.drawer-brand {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 1.35rem 1.25rem;
}

.drawer-mark {
  width: 2.6rem;
  height: 2.6rem;
  font-size: 1.35rem;
}

.drawer-title {
  font-family: Georgia, serif;
  font-size: 1.15rem;
}

.drawer-caption {
  overflow: hidden;
  max-width: 11rem;
  color: #7a8681;
  font-size: 0.75rem;
  text-overflow: ellipsis;
}

.active-nav-item,
.active-workspace {
  border-radius: 0.8rem;
  background: #e4eee8;
  color: #214c3c;
}

.mobile-footer {
  background: transparent;
  color: var(--color-ink);
}

.workspace-list {
  padding: 0.5rem 0.75rem;
}

.workspace-list-label {
  padding: 0.5rem 0.75rem;
  color: #829089;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.8rem;
  min-height: calc(100vh - 64px);
  min-height: calc(100dvh - 64px);
  color: #62716b;
}

@media (max-width: 700px) {
  .app-toolbar {
    min-height: calc(56px + env(safe-area-inset-top));
    padding-top: env(safe-area-inset-top);
  }

  .mini-mark,
  .app-title {
    display: none;
  }

  .workspace-selector {
    flex: 1 1 auto;
    width: auto;
    max-width: none;
    margin: 0;
  }

  .loading-state {
    min-height: calc(100dvh - 56px - env(safe-area-inset-top));
  }
}
</style>
