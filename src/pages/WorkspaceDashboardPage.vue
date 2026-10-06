<template>
  <q-page class="workspace-dashboard-page">
    <main class="dashboard-shell">
      <header class="dashboard-header">
        <div class="dashboard-heading">
          <div class="workspace-name">{{ workspace?.name }}</div>
          <h1>{{ t('dashboard.title') }}</h1>
          <p>{{ greeting }}</p>
        </div>

        <MemberScopeSelector v-model="selectedMemberId" :members="members" />
      </header>

      <section class="dashboard-grid" aria-label="Financial dashboard">
        <CostOfLifeCard
          class="cost-card"
          :data="dashboardData"
          @open="openSection('cost-of-life')"
        />
        <FinancialPositionCard
          class="position-card"
          :data="dashboardData"
          @open="openSection('financial-position')"
          @open-assets="openSection('assets')"
          @open-liabilities="openSection('liabilities')"
        />
        <MilestonesCard
          class="milestones-card"
          :milestones="dashboardData.milestones"
          @open="openSection('milestones')"
        />
        <WhatIfCard
          class="what-if-card"
          :scenarios="dashboardData.scenarios"
          @open="openSection('what-if')"
        />
      </section>
    </main>
  </q-page>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import CostOfLifeCard from '@/components/dashboard/CostOfLifeCard.vue'
import FinancialPositionCard from '@/components/dashboard/FinancialPositionCard.vue'
import MemberScopeSelector from '@/components/dashboard/MemberScopeSelector.vue'
import MilestonesCard from '@/components/dashboard/MilestonesCard.vue'
import WhatIfCard from '@/components/dashboard/WhatIfCard.vue'
import { getMockDashboard } from '@/mocks/workspace-dashboard'
import { authUser } from '@/services/auth'
import { useAssetsStore } from '@/stores/assets-store'
import { useFinancialScopeStore } from '@/stores/financial-scope-store'
import { useLiabilitiesStore } from '@/stores/liabilities-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { getWorkspaceMembers } from '@/utils/workspace-members'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const assetsStore = useAssetsStore()
const liabilitiesStore = useLiabilitiesStore()
const scopeStore = useFinancialScopeStore()
const workspaceStore = useWorkspaceStore()

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

const dashboardData = computed(() => {
  const mockDashboard = getMockDashboard(selectedMemberId.value, memberIds.value)
  const assets = assetsStore.total(selectedMemberId.value)
  const liabilities = liabilitiesStore.total(selectedMemberId.value)

  return {
    ...mockDashboard,
    assets,
    liabilities,
    netWorth: assets - liabilities,
  }
})

const greeting = computed(() => {
  const selectedMember = members.value.find((member) => member.id === selectedMemberId.value)
  const fallbackMember = members.value.find((member) => member.id === authUser.value?.uid)
  const name = selectedMember?.name || fallbackMember?.name

  if (!name) return t('dashboard.greeting.fallback')

  const hour = new Date().getHours()
  const period = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
  return t(`dashboard.greeting.${period}`, { name })
})

watch(
  workspaceId,
  (id) => {
    assetsStore.loadSummary(id)
    liabilitiesStore.loadSummary(id)
  },
  { immediate: true },
)

function openSection(section) {
  router.push({ name: section, params: { workspaceId: route.params.workspaceId } })
}
</script>

<style scoped lang="scss">
.workspace-dashboard-page {
  min-height: calc(100vh - 64px);
  min-height: calc(100dvh - 64px);
  padding: clamp(1.25rem, 3vw, 2.75rem);
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

.workspace-name {
  overflow: hidden;
  max-width: 28rem;
  margin-bottom: 0.2rem;
  color: var(--color-primary);
  font-size: 0.72rem;
  font-weight: 750;
  letter-spacing: 0.09em;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
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
  gap: 1.25rem;
}

@media (min-width: 1280px) {
  .dashboard-grid {
    grid-template-columns: minmax(0, 7fr) minmax(22rem, 5fr);
    grid-template-areas:
      'cost position'
      'milestones what-if';
    align-items: start;
  }

  .cost-card {
    grid-area: cost;
    align-self: stretch;
  }

  .position-card {
    grid-area: position;
    align-self: stretch;
  }

  .milestones-card {
    grid-area: milestones;
  }

  .what-if-card {
    grid-area: what-if;
  }
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

  .workspace-name {
    max-width: 11rem;
  }

  h1 {
    font-size: 2.35rem;
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
