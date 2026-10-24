<template>
  <q-page class="workspace-dashboard-page">
    <main class="dashboard-shell">
      <header class="dashboard-header">
        <div class="dashboard-heading">
          <h1>{{ greeting }}</h1>
          <p>{{ t('dashboard.snapshotSubtitle') }}</p>
        </div>

        <MemberScopeSelector v-model="selectedMemberId" :members="members" />
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

      <section class="insight-grid" :aria-label="t('dashboard.insights.label')">
        <router-link :to="{ name: 'progress', params: { workspaceId } }" class="insight-card">
          <span>{{ t('dashboard.insights.nextMilestone') }}</span>
          <template v-if="nextMilestone">
            <strong>{{ t(`milestones.items.${nextMilestone.id}`) }}</strong>
            <small>{{ Math.round(nextMilestone.progress * 100) }}%</small>
            <q-linear-progress
              rounded
              size="0.55rem"
              color="primary"
              track-color="grey-3"
              :value="nextMilestone.progress"
            />
          </template>
          <p v-else>{{ t('dashboard.insights.milestoneEmpty') }}</p>
        </router-link>

        <router-link :to="{ name: 'what-if', params: { workspaceId } }" class="insight-card">
          <span>{{ t('dashboard.insights.whatIf') }}</span>
          <strong>{{ t('dashboard.insights.spendLess') }}</strong>
          <p>{{ t('dashboard.insights.spendLessDescription') }}</p>
          <b>{{ t('dashboard.insights.explore') }} <q-icon name="arrow_forward" /></b>
        </router-link>

        <router-link :to="{ name: 'progress', params: { workspaceId } }" class="insight-card">
          <span>{{ t('dashboard.insights.thisYear') }}</span>
          <strong v-if="yearChange !== null" :class="{ negative: yearChange < 0 }">
            {{ yearChange >= 0 ? '+' : '−' }}{{ formatCurrency(Math.abs(yearChange)) }}
          </strong>
          <strong v-else>—</strong>
          <p>
            {{
              yearChange === null
                ? t('dashboard.insights.historyBuilding')
                : t('dashboard.insights.netWorthChange')
            }}
          </p>
          <b>{{ t('dashboard.insights.progress') }} <q-icon name="arrow_forward" /></b>
        </router-link>
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
import MemberScopeSelector from '@/components/dashboard/MemberScopeSelector.vue'
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
import { formatCurrency } from '@/utils/formatters'

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
    { throughPeriod: `${currentYear.value}-${currentMonth.value}` },
  ),
)
const currentYearPoints = computed(() =>
  historyPoints.value.filter(({ period }) => period.startsWith(`${currentYear.value}-`)),
)
const yearChange = computed(() =>
  currentYearPoints.value.length > 1
    ? currentYearPoints.value.at(-1).value - currentYearPoints.value[0].value
    : null,
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
const visibleMilestones = computed(() =>
  milestonesStore.progress.filter(
    (item) => item.family !== 'debt' || item.relevant || item.previouslyAchieved,
  ),
)
const nextMilestone = computed(
  () =>
    visibleMilestones.value.find((item) =>
      milestonesStore.trackingActive ? !item.previouslyAchieved : !item.reached,
    ) || null,
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
  background:
    radial-gradient(circle at 68% 4%, rgb(226 242 255 / 72%), transparent 34rem), var(--color-page);
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
.insight-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  margin-top: 1.15rem;
}
.insight-card {
  display: grid;
  align-content: start;
  min-height: 11rem;
  padding: 1.25rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  color: var(--color-ink);
  text-decoration: none;
  box-shadow: var(--shadow-card);
}
.insight-card:hover {
  border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-line));
}
.insight-card > span {
  color: var(--color-copy);
  font-size: 0.72rem;
  font-weight: 750;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}
.insight-card > strong {
  margin-top: 0.55rem;
  font-size: 1.3rem;
  line-height: 1.2;
}
.insight-card > strong.negative {
  color: var(--color-danger);
}
.insight-card > small {
  margin-top: 0.2rem;
  color: var(--color-copy);
}
.insight-card > .q-linear-progress {
  margin-top: auto;
}
.insight-card > p {
  margin: 0.45rem 0 0;
  color: var(--color-copy);
  font-size: 0.84rem;
}
.insight-card > b {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: auto;
  padding-top: 1rem;
  color: var(--color-primary);
  font-size: 0.82rem;
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

  .dashboard-header :deep(.member-selector) {
    max-width: 52%;
  }

  .dashboard-grid {
    gap: 1rem;
  }

  .insight-grid {
    grid-template-columns: 1fr;
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
