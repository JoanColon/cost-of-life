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

      <section class="dashboard-grid" aria-label="Financial dashboard">
        <FinancialPositionCard
          :data="dashboardData"
          :history-points="historyPoints"
          :history-loading="historyLoading"
          :history-error="Boolean(historyError)"
          @open="openSection('assets')"
          @open-assets="openSection('assets')"
          @open-liabilities="openSection('liabilities')"
        />
        <CostOfLifeCard
          :data="dashboardData"
          @open="openSection('expenses')"
          @open-income="openSection('income')"
          @open-tracker="openSection('expense-tracker')"
        />
      </section>
    </main>
  </q-page>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import CostOfLifeCard from '@/components/dashboard/CostOfLifeCard.vue'
import FinancialPositionCard from '@/components/dashboard/FinancialPositionCard.vue'
import MemberScopeSelector from '@/components/dashboard/MemberScopeSelector.vue'
import { buildNetWorthSeries } from '@/domain/financial/history'
import {
  currentFinancialMonth,
  currentFinancialYear,
  financialYearMonthValue,
  financialYearValue,
} from '@/domain/financial/financial-year'
import { authUser } from '@/services/auth'
import { getFinancialHistory } from '@/services/firebase/history.service'
import { useFinancialYearsStore } from '@/stores/financial-years-store'
import { useFinancialScopeStore } from '@/stores/financial-scope-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { getWorkspaceMembers } from '@/utils/workspace-members'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const financialYearsStore = useFinancialYearsStore()
const scopeStore = useFinancialScopeStore()
const workspaceStore = useWorkspaceStore()
const historyDocuments = ref([])
const historyLoading = ref(false)
const historyError = ref(null)
let historyRequestId = 0
const currentYear = currentFinancialYear()
const currentMonth = currentFinancialMonth()

const workspaceId = computed(() => String(route.params.workspaceId))
const workspace = computed(
  () => workspaceStore.workspaces.find((candidate) => candidate.id === workspaceId.value) || null,
)
const members = computed(() => getWorkspaceMembers(workspace.value, authUser.value))
const memberIds = computed(() => members.value.map((member) => member.id))
const selectedMemberId = computed({
  get: () => scopeStore.get(workspaceId.value, memberIds.value, authUser.value?.uid),
  set: (memberId) => scopeStore.select(workspaceId.value, memberId),
})
const financialYear = computed(() => financialYearsStore.get(workspaceId.value, currentYear))
const historyPoints = computed(() =>
  buildNetWorthSeries(
    [
      ...historyDocuments.value.filter(
        (document) => Number(document.year || document.id) !== currentYear,
      ),
      ...(financialYear.value ? [financialYear.value] : []),
    ],
    { throughPeriod: `${currentYear}-${currentMonth}` },
  ),
)

const dashboardData = computed(() => {
  const assets = financialYearMonthValue(
    financialYear.value,
    currentMonth,
    'assets',
    selectedMemberId.value,
  )
  const liabilities = financialYearMonthValue(
    financialYear.value,
    currentMonth,
    'liabilities',
    selectedMemberId.value,
  )
  const income = financialYear.value
    ? financialYearValue(financialYear.value, 'income', selectedMemberId.value)
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
      currentMonth,
      'netWorth',
      selectedMemberId.value,
    ),
  }
})

const greeting = computed(() => {
  const selectedMember = members.value.find((member) => member.id === selectedMemberId.value)
  const fallbackMember = members.value.find((member) => member.id === authUser.value?.uid)
  const name = firstName(selectedMember?.name || fallbackMember?.name)

  if (!name) return t('dashboard.greeting.fallback')

  const hour = new Date().getHours()
  const period = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
  return t(`dashboard.greeting.${period}`, { name })
})

function firstName(name = '') {
  const value = name.trim().split(/\s+/)[0]
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : ''
}

watch(
  workspaceId,
  (id) => {
    financialYearsStore.load(id, currentYear).catch(() => {})
    loadHistory(id)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  historyRequestId += 1
})

async function loadHistory(id) {
  const requestId = ++historyRequestId
  historyDocuments.value = []
  historyError.value = null
  historyLoading.value = true

  try {
    const documents = await getFinancialHistory(id)
    if (requestId !== historyRequestId) return
    historyDocuments.value = documents
  } catch (error) {
    if (requestId !== historyRequestId) return
    historyError.value = error
  } finally {
    if (requestId === historyRequestId) historyLoading.value = false
  }
}

function openSection(section) {
  router.push({ name: section, params: { workspaceId: route.params.workspaceId } })
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
  font-size: clamp(2.25rem, 4vw, 3.5rem);
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

@media (max-width: 1023px) {
  .workspace-dashboard-page {
    min-height: 100vh;
    min-height: 100dvh;
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
    font-size: clamp(2.1rem, 9vw, 3rem);
  }

  .dashboard-heading p {
    font-size: 0.95rem;
    white-space: nowrap;
  }

  .dashboard-header :deep(.member-selector) {
    max-width: 52%;
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
