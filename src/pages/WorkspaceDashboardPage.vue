<template>
  <q-page class="workspace-dashboard-page">
    <main class="dashboard-shell">
      <header class="dashboard-header">
        <div class="dashboard-heading">
          <h1>{{ greeting }}</h1>
          <p>{{ t('dashboard.snapshotSubtitle') }}</p>
        </div>
      </header>

      <FinancialSetupCard v-if="showSetup" :items="setupItems" class="setup-guide" />

      <section class="dashboard-grid" aria-label="Financial dashboard">
        <FinancialPositionCard
          :data="dashboardData"
          :history-points="historyPoints"
          :history-loading="historyLoading"
          :history-error="Boolean(historyError)"
          @open-assets="openSection('assets')"
          @open-liabilities="openSection('liabilities')"
        />
        <CostOfLifeCard
          :data="dashboardData"
          @open-expenses="openSection('expenses')"
          @open-income="openSection('income')"
          @open-tracker="openSection('expense-tracker')"
        />
      </section>
    </main>
  </q-page>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import CostOfLifeCard from '@/components/dashboard/CostOfLifeCard.vue'
import FinancialSetupCard from '@/components/dashboard/FinancialSetupCard.vue'
import FinancialPositionCard from '@/components/dashboard/FinancialPositionCard.vue'
import { buildNetWorthSeries } from '@/domain/financial/history'
import {
  financialYearAvailableIncomeValue,
  financialYearMonthValue,
  financialYearValue,
} from '@/domain/financial/financial-year'
import { authUser } from '@/services/auth'
import { useFinancialScopeStore } from '@/stores/financial-scope-store'
import { useAssetsStore } from '@/stores/assets-store'
import { useExpensesStore } from '@/stores/expenses-store'
import { useIncomeStore } from '@/stores/income-store'
import { useLiabilitiesStore } from '@/stores/liabilities-store'
import { useMilestonesStore } from '@/stores/milestones-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { getWorkspaceMembers } from '@/utils/workspace-members'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const assetsStore = useAssetsStore()
const expensesStore = useExpensesStore()
const incomeStore = useIncomeStore()
const liabilitiesStore = useLiabilitiesStore()
const milestonesStore = useMilestonesStore()
const scopeStore = useFinancialScopeStore()
const workspaceStore = useWorkspaceStore()
const setupLoading = ref(true)

const workspaceId = computed(() => String(route.params.workspaceId))
const { currentMonth, currentYear, financialYear, historyDocuments, historyError, historyLoading } =
  storeToRefs(milestonesStore)
const workspace = computed(
  () => workspaceStore.workspaces.find((candidate) => candidate.id === workspaceId.value) || null,
)
const members = computed(() => getWorkspaceMembers(workspace.value, authUser.value))
const memberIds = computed(() => members.value.map((member) => member.id))
const selectedMemberId = computed({
  get: () => scopeStore.get(workspaceId.value, memberIds.value, authUser.value?.uid),
  set: (memberId) => scopeStore.select(workspaceId.value, memberId),
})
const historyPoints = computed(() =>
  buildNetWorthSeries(
    [
      ...historyDocuments.value.filter(
        (document) => Number(document.year || document.id) !== currentYear.value,
      ),
      ...(financialYear.value ? [financialYear.value] : []),
    ],
    {
      throughPeriod: `${currentYear.value}-${currentMonth.value}`,
      memberId: selectedMemberId.value,
    },
  ),
)
const dashboardData = computed(() => {
  const assets = financialYearMonthValue(
    financialYear.value,
    currentMonth.value,
    'assets',
    selectedMemberId.value,
  )
  const liabilities = financialYearMonthValue(
    financialYear.value,
    currentMonth.value,
    'liabilities',
    selectedMemberId.value,
  )
  const income = financialYear.value
    ? financialYearAvailableIncomeValue(financialYear.value, selectedMemberId.value)
    : 0
  const annualCostOfLife = financialYear.value
    ? financialYearValue(financialYear.value, 'expenses', selectedMemberId.value)
    : 0
  const savingsCapacity = Math.round((income - annualCostOfLife + Number.EPSILON) * 100) / 100

  return {
    assets,
    liabilities,
    income,
    monthlyIncome: income / 12,
    annualCost: annualCostOfLife,
    monthlyCost: annualCostOfLife / 12,
    savingsCapacity,
    monthlySavingsCapacity: savingsCapacity / 12,
    savingsRate: income > 0 ? Math.round((savingsCapacity / income) * 100) : 0,
    costRatio: income > 0 ? Math.round((annualCostOfLife / income) * 100) : 0,
    netWorth: financialYearMonthValue(
      financialYear.value,
      currentMonth.value,
      'netWorth',
      selectedMemberId.value,
    ),
  }
})

const setupItems = computed(() => [
  setupItem(
    'assets',
    'inventory_2',
    'dashboard.setup.assets',
    assetsStore.setupCompleted,
    dashboardData.value.assets,
  ),
  setupItem(
    'liabilities',
    'request_quote',
    'dashboard.setup.liabilities',
    liabilitiesStore.setupCompleted,
    dashboardData.value.liabilities,
  ),
  setupItem(
    'income',
    'payments',
    'dashboard.setup.income',
    incomeStore.setupCompleted,
    dashboardData.value.income,
  ),
  setupItem(
    'expenses',
    'credit_card',
    'dashboard.setup.expenses',
    expensesStore.setupCompleted,
    dashboardData.value.annualCost,
  ),
])
const showSetup = computed(
  () => !setupLoading.value && setupItems.value.some(({ completed }) => !completed),
)
watch(workspaceId, loadDashboard, { immediate: true })

const greeting = computed(() => {
  const selectedMember = members.value.find((member) => member.id === selectedMemberId.value)
  const fallbackMember = members.value.find((member) => member.id === authUser.value?.uid)
  const name = firstName(selectedMember?.name || fallbackMember?.name)

  if (!name) return t('dashboard.greeting.fallback')
  return t('dashboard.greeting.personalized', { name })
})

function firstName(name = '') {
  const value = name.trim().split(/\s+/)[0]
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : ''
}

function openSection(section) {
  router.push({ name: section, params: { workspaceId: route.params.workspaceId } })
}

function setupItem(key, icon, translationKey, completed, total) {
  return {
    key,
    icon,
    title: t(`${translationKey}.title`),
    description: t(`${translationKey}.description`),
    completed,
    total,
    to: { name: key, params: { workspaceId: workspaceId.value } },
  }
}

async function loadDashboard(id) {
  setupLoading.value = true
  await Promise.allSettled([
    milestonesStore.load(id),
    assetsStore.loadConfig(id),
    liabilitiesStore.loadConfig(id),
    incomeStore.loadConfig(id),
    expensesStore.loadConfig(id),
  ])
  if (id === workspaceId.value) setupLoading.value = false
}
</script>

<style scoped lang="scss">
.workspace-dashboard-page {
  min-height: calc(100vh - 64px);
  min-height: calc(100dvh - 64px);
  padding: clamp(1.5rem, 3.5vw, 3rem);
  background: var(--color-page);
}

.dashboard-shell {
  width: 100%;
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.dashboard-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 2rem;
  margin-bottom: 1.5rem;
}

.dashboard-heading {
  min-width: 0;
}

h1 {
  margin: 0;
  font-size: clamp(2rem, 3.5vw, 3.1rem);
  font-weight: 780;
  line-height: 1;
  letter-spacing: -0.055em;
}

.dashboard-heading p {
  margin: 0.45rem 0 0;
  color: var(--color-copy);
  font-size: 1.05rem;
}

.dashboard-grid {
  display: grid;
  gap: 1.15rem;
}

.setup-guide {
  margin-bottom: 1.15rem;
}

@media (max-width: 1023px) {
  .workspace-dashboard-page {
    min-height: calc(100vh - 56px);
    min-height: calc(100dvh - 56px - env(safe-area-inset-top));
    padding-top: max(1.25rem, env(safe-area-inset-top));
    padding-right: max(1rem, env(safe-area-inset-right));
    padding-bottom: calc(var(--mobile-nav-height) + max(1.5rem, env(safe-area-inset-bottom)));
    padding-left: max(1rem, env(safe-area-inset-left));
  }

  .dashboard-header {
    align-items: center;
  }
}

@media (max-width: 699px) {
  .dashboard-header {
    align-items: flex-end;
    gap: 1rem;
  }

  h1 {
    font-size: clamp(1.9rem, 8vw, 2.65rem);
  }

  .dashboard-heading p {
    display: none;
  }

  .dashboard-grid {
    gap: 1rem;
  }
}

@media (max-width: 430px) {
  .workspace-dashboard-page {
    padding-right: max(0.75rem, env(safe-area-inset-right));
    padding-left: max(0.75rem, env(safe-area-inset-left));
  }

  .dashboard-header {
    margin-bottom: 1.1rem;
  }
}
</style>
