<template>
  <q-layout view="hHh Lpr fFf" class="app-layout">
    <q-header class="app-header">
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
          :display-value="activeWorkspace?.name || t('navigation.selectWorkspace')"
          emit-value
          map-options
          dense
          borderless
          options-dense
          class="workspace-selector"
          :aria-label="t('navigation.switchWorkspace')"
          @update:model-value="handleWorkspaceSelection"
        >
          <template #prepend><q-icon name="workspaces_outline" size="1.15rem" /></template>
          <template #option="scope">
            <q-item v-bind="scope.itemProps">
              <q-item-section avatar><q-icon :name="scope.opt.icon" /></q-item-section>
              <q-item-section>{{ scope.opt.label }}</q-item-section>
            </q-item>
          </template>
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
          :to="{ name: 'home', query: { manage: '1' } }"
          exact
          active-class="active-nav-item"
          @click="closeMobileDrawer"
        >
          <q-item-section avatar><q-icon name="space_dashboard" /></q-item-section>
          <q-item-section>{{ t('navigation.manageWorkspaces') }}</q-item-section>
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
        <div class="workspace-list-label">{{ t('navigation.switchWorkspace') }}</div>
        <q-list dense>
          <q-item
            v-for="workspace in workspaceStore.workspaces"
            :key="workspace.id"
            v-ripple
            clickable
            exact
            :active="workspace.id === activeWorkspaceId"
            active-class="active-workspace"
            @click="switchWorkspace(workspace.id)"
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

      <template v-if="activeWorkspaceId">
        <q-separator class="q-my-sm" />
        <div class="workspace-list-label">{{ activeWorkspace?.name }}</div>
        <nav class="workspace-navigation" :aria-label="t('navigation.financialWorkspace')">
          <q-tree
            v-model:expanded="expandedNavigationNodes"
            :nodes="workspaceNavigationNodes"
            :selected="activeNavigationNode"
            node-key="key"
            no-connectors
            no-selection-unset
            selected-color="primary"
            class="workspace-navigation-tree"
          />
        </nav>
      </template>
    </q-drawer>

    <q-page-container>
      <div v-if="workspaceStore.loading" class="loading-state">
        <q-spinner color="primary" size="2rem" />
        <span>{{ t('home.loadingWorkspace') }}</span>
      </div>
      <div v-else-if="workspaceStore.error" class="loading-state">
        <q-icon name="cloud_off" size="2rem" />
        <span>{{ t('workspace.errors.load') }}</span>
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon="refresh"
          :label="t('common.retry')"
          @click="loadWorkspaces(true)"
        />
      </div>
      <router-view
        v-else-if="workspaceStore.ready"
        :key="`${route.fullPath}:${financialPeriodKey}`"
      />
    </q-page-container>

    <q-footer v-if="showMobileNavigation" class="mobile-footer">
      <MobileBottomNav />
    </q-footer>
  </q-layout>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import MobileBottomNav from '@/components/dashboard/MobileBottomNav.vue'
import { currentFinancialMonth, currentFinancialYear } from '@/domain/financial/financial-year'
import { authUser, signOut } from '@/services/auth'
import { useAssetsStore } from '@/stores/assets-store'
import { useExpensesStore } from '@/stores/expenses-store'
import { useExpenseTrackingStore } from '@/stores/expense-tracking-store'
import { useFinancialScopeStore } from '@/stores/financial-scope-store'
import { useFinancialYearsStore } from '@/stores/financial-years-store'
import { useIncomeStore } from '@/stores/income-store'
import { useLiabilitiesStore } from '@/stores/liabilities-store'
import { useMilestonesStore } from '@/stores/milestones-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useWhatIfStore } from '@/stores/what-if-store'

const MANAGE_WORKSPACES_OPTION = '__manage-workspaces__'
const CREATE_WORKSPACE_OPTION = '__create-workspace__'

const $q = useQuasar()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const assetsStore = useAssetsStore()
const expensesStore = useExpensesStore()
const expenseTrackingStore = useExpenseTrackingStore()
const liabilitiesStore = useLiabilitiesStore()
const incomeStore = useIncomeStore()
const milestonesStore = useMilestonesStore()
const scopeStore = useFinancialScopeStore()
const financialYearsStore = useFinancialYearsStore()
const workspaceStore = useWorkspaceStore()
const whatIfStore = useWhatIfStore()

const drawerOpen = ref($q.screen.gt.sm)
const loggingOut = ref(false)
const financialPeriodKey = ref(currentPeriodKey())
const expandedNavigationNodes = ref(['your-money'])
let periodTimer = null
const workspaceOptions = computed(() => [
  ...workspaceStore.workspaces.map((workspace) => ({
    label: workspace.name,
    value: workspace.id,
    icon: isSharedWorkspace(workspace) ? 'group' : 'person_outline',
  })),
  {
    label: t('navigation.manageWorkspaces'),
    value: MANAGE_WORKSPACES_OPTION,
    icon: 'settings',
  },
  {
    label: t('navigation.createWorkspace'),
    value: CREATE_WORKSPACE_OPTION,
    icon: 'add_business',
  },
])
const activeWorkspaceId = computed(() => workspaceStore.activeWorkspaceId)
const activeWorkspace = computed(() => workspaceStore.activeWorkspace)
const routeWorkspaceId = computed(() => {
  const workspaceId = route.params.workspaceId
  if (typeof workspaceId !== 'string') return null

  return workspaceStore.workspaces.some((workspace) => workspace.id === workspaceId)
    ? workspaceId
    : null
})
const showMobileNavigation = computed(() => $q.screen.lt.md && Boolean(routeWorkspaceId.value))
const activeNavigationNode = computed(() => {
  const routeNodes = {
    'workspace-dashboard': 'workspace-home',
    assets: 'assets',
    'asset-category': 'assets',
    'investment-portfolio': 'assets',
    liabilities: 'liabilities',
    'liability-category': 'liabilities',
    income: 'income',
    'income-category': 'income',
    expenses: 'expenses',
    'expense-category': 'expenses',
    'expense-tracker': 'expenses',
    plan: 'plan',
    'what-if': 'plan',
    'what-if-strategy': 'plan',
    progress: 'progress',
    achievements: 'progress',
  }

  return routeNodes[route.name] || null
})
const workspaceNavigationNodes = computed(() => {
  if (!activeWorkspaceId.value) return []

  return [
    navigationLeaf('workspace-home', 'navigation.home', 'home', 'workspace-dashboard'),
    {
      key: 'your-money',
      label: t('navigation.yourMoney'),
      icon: 'account_balance',
      selectable: false,
      children: [
        navigationLeaf('assets', 'navigation.assets', 'inventory_2', 'assets'),
        navigationLeaf('liabilities', 'navigation.liabilities', 'request_quote', 'liabilities'),
        navigationLeaf('income', 'navigation.income', 'payments', 'income'),
        navigationLeaf('expenses', 'navigation.expenses', 'credit_card', 'expenses'),
      ],
    },
    navigationLeaf('plan', 'navigation.plan', 'route', 'plan'),
    navigationLeaf('progress', 'navigation.progress', 'bar_chart', 'progress'),
  ]
})

onMounted(async () => {
  periodTimer = setInterval(refreshFinancialPeriod, 60_000)
  if (!authUser.value) return

  await loadWorkspaces()
})

onBeforeUnmount(() => clearInterval(periodTimer))

watch(() => route.fullPath, syncWorkspaceFromRoute)
watch(authUser, handleAuthChange)

async function handleAuthChange(user, previousUser) {
  if (!user) {
    resetApplicationState()
    if (!loggingOut.value && route.meta.requiresAuth) await router.replace({ name: 'login' })
    return
  }

  if (previousUser?.uid !== user.uid) {
    if (previousUser?.uid) resetApplicationState()
    await loadWorkspaces()
  }
}

async function syncWorkspaceFromRoute() {
  if (!workspaceStore.ready) return

  const workspaceId = route.params.workspaceId
  if (typeof workspaceId !== 'string') {
    financialYearsStore.stopWatching()
    if (route.name === 'home' && route.query.manage !== '1' && workspaceStore.activeWorkspaceId) {
      await router.replace(workspaceRoute(workspaceStore.activeWorkspaceId))
    }
    return
  }

  if (await workspaceStore.setActiveWorkspace(workspaceId)) return

  financialYearsStore.stopWatching()
  await router.replace({ name: 'home' })
}

async function loadWorkspaces(force = false) {
  if (!authUser.value) return
  try {
    await workspaceStore.load(authUser.value, force)
    await syncWorkspaceFromRoute()
  } catch {
    return
  }
}

async function handleWorkspaceSelection(value) {
  if (value === MANAGE_WORKSPACES_OPTION) {
    closeMobileDrawer()
    await router.push({ name: 'home', query: { manage: '1' } })
    return
  }

  if (value === CREATE_WORKSPACE_OPTION) {
    closeMobileDrawer()
    await router.push({ name: 'create-workspace' })
    return
  }

  await switchWorkspace(value)
}

async function switchWorkspace(workspaceId) {
  if (!(await workspaceStore.setActiveWorkspace(workspaceId))) return

  closeMobileDrawer()
  await router.push(workspaceRoute(workspaceId))
}

function workspaceRoute(workspaceId) {
  return { name: 'workspace-dashboard', params: { workspaceId } }
}

function navigationLeaf(key, labelKey, icon, routeName) {
  return {
    key,
    label: t(labelKey),
    icon,
    handler: () => openNavigationRoute(routeName),
  }
}

async function openNavigationRoute(routeName) {
  closeMobileDrawer()
  await router.push({ name: routeName, params: { workspaceId: activeWorkspaceId.value } })
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
    await signOut()
    resetApplicationState()
    await router.replace({ name: 'login' })
  } finally {
    loggingOut.value = false
  }
}

function resetApplicationState() {
  assetsStore.reset()
  expensesStore.reset()
  expenseTrackingStore.reset()
  liabilitiesStore.reset()
  incomeStore.reset()
  milestonesStore.reset()
  scopeStore.reset()
  financialYearsStore.reset()
  workspaceStore.reset()
  whatIfStore.reset()
}

function refreshFinancialPeriod() {
  financialPeriodKey.value = currentPeriodKey()
}

function currentPeriodKey() {
  return `${currentFinancialYear()}-${currentFinancialMonth()}`
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

.workspace-navigation {
  padding: 0 0.75rem 0.75rem;
}

.workspace-navigation-tree {
  color: var(--color-ink);
}

.workspace-navigation-tree :deep(.q-tree__node-header) {
  min-height: 2.65rem;
  margin-bottom: 0.15rem;
  padding: 0.35rem 0.6rem;
  border-radius: 0.8rem;
}

.workspace-navigation-tree :deep(.q-tree__node-header-content) {
  font-size: 0.9rem;
  font-weight: 600;
}

.workspace-navigation-tree :deep(.q-tree__children .q-tree__node-header-content) {
  font-weight: 500;
}

.workspace-navigation-tree :deep(.q-tree__node-header.q-tree__node--selected) {
  background: #e4eee8;
  color: #214c3c;
}

.workspace-navigation-tree :deep(.q-tree__arrow) {
  color: #829089;
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
