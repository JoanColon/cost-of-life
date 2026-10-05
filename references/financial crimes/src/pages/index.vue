<template>
  <q-layout view="hHh lpR fFf" class="app-shell">
    <q-btn
      v-if="settingsStore.onboardingCompleted"
      class="app-menu-button"
      flat
      round
      dense
      icon="menu"
      color="white"
      aria-label="Open menu"
      @click="drawerOpen = true"
    >
    </q-btn>

    <q-drawer
      v-if="settingsStore.onboardingCompleted"
      v-model="drawerOpen"
      class="app-drawer"
      side="left"
      overlay
      bordered
    >
      <div class="app-drawer__brand">
        <div>
          <div class="section-kicker">CASE FILE</div>
          <strong>Financial Crimes</strong>
          <div class="app-drawer__credits">
            <q-icon :name="matLocalFireDepartment" color="warning" />
            {{ aiCreditsStore.balanceLabel }}
          </div>
        </div>
        <q-btn
          class="app-drawer__close"
          flat
          round
          dense
          icon="close"
          color="white"
          aria-label="Close menu"
          @click="drawerOpen = false"
        />
      </div>

      <q-list dark class="app-drawer__nav">
        <q-item
          v-for="item in drawerItems"
          :key="item.to"
          v-ripple
          clickable
          :to="item.to"
          :exact="item.exact"
          active-class="app-drawer__item--active"
          @click="drawerOpen = false"
        >
          <q-item-section avatar>
            <q-icon :name="item.icon" />
          </q-item-section>
          <q-item-section>{{ item.label }}</q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <q-page-container>
      <div v-if="loading" class="fullscreen flex flex-center">
        <q-spinner color="warning" size="42px" />
      </div>
      <OnboardingFlow v-else-if="!settingsStore.onboardingCompleted" />
      <router-view v-else />
    </q-page-container>

    <q-footer v-if="settingsStore.onboardingCompleted" class="bottom-nav">
      <q-tabs align="justify" no-caps dense active-color="warning" indicator-color="warning">
        <q-route-tab to="/" icon="home" label="HOME" exact />
        <q-route-tab to="/record" icon="folder" label="RECORD" />
        <q-route-tab to="/court" icon="search" label="COURT" />
        <q-route-tab to="/achievements" icon="military_tech" label="BADGES" />
      </q-tabs>
    </q-footer>

    <AchievementUnlockDialog
      v-model="unlockDialogOpen"
      :unlocks="achievementsStore.unlockQueue"
      @finished="achievementsStore.clearUnlockQueue()"
    />
    <AiCreditPurchaseDialog />
  </q-layout>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { matLocalFireDepartment } from '@quasar/extras/material-icons'
import AchievementUnlockDialog from '@/components/achievements/AchievementUnlockDialog.vue'
import AiCreditPurchaseDialog from '@/components/AiCreditPurchaseDialog.vue'
import OnboardingFlow from '@/components/OnboardingFlow.vue'
import { useAchievementsStore } from '@/stores/achievementsStore'
import { useAiCreditsStore } from '@/stores/aiCreditsStore'
import { useCrimesStore } from '@/stores/crimesStore'
import { usePreventedCrimesStore } from '@/stores/preventedCrimesStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { hideNativeSplashWhenReady } from '@/services/splashScreen'

const settingsStore = useSettingsStore()
const crimesStore = useCrimesStore()
const preventedCrimesStore = usePreventedCrimesStore()
const achievementsStore = useAchievementsStore()
const aiCreditsStore = useAiCreditsStore()
const $q = useQuasar()
const drawerOpen = ref(false)
const drawerItems = [
  { label: 'Home', icon: 'home', to: '/', exact: true },
  { label: 'Criminal Record', icon: 'folder', to: '/record' },
  { label: 'Court', icon: 'search', to: '/court' },
  { label: 'Badges', icon: 'military_tech', to: '/achievements' },
  { label: 'Settings', icon: 'settings', to: '/settings' },
]

const loading = computed(
  () =>
    !settingsStore.loaded ||
    !crimesStore.loaded ||
    !preventedCrimesStore.loaded ||
    !achievementsStore.loaded,
)
const unlockDialogOpen = computed({
  get: () => achievementsStore.unlockDialogOpen,
  set: (value) => {
    achievementsStore.unlockDialogOpen = value
  },
})

onMounted(async () => {
  const localLoadResults = await Promise.allSettled([
    settingsStore.load(),
    crimesStore.load(),
    preventedCrimesStore.load(),
    achievementsStore.load(),
  ])

  if (import.meta.env.DEV) {
    localLoadResults.forEach((result) => {
      if (result.status === 'rejected')
        console.error('Local startup data failed to load:', result.reason)
    })
  }

  try {
    await hideNativeSplashWhenReady()
  } catch {
    // The watchdog will retry; local functionality must remain available.
  }

  if (settingsStore.onboardingCompleted) processStartupImmediateBadges()

  aiCreditsStore
    .startRemoteServices()
    .then(showMonthlyCreditNotice)
    .catch(() => {})
})

function showMonthlyCreditNotice() {
  const monthlyCreditsGranted = aiCreditsStore.takeMonthlyGrantNotice()
  if (monthlyCreditsGranted) {
    $q.notify({
      type: 'positive',
      icon: matLocalFireDepartment,
      message: 'MONTHLY PARDON GRANTED',
      caption: `The court granted you ${monthlyCreditsGranted} free AI Crimes.`,
      timeout: 5000,
    })
  }
}

async function processStartupImmediateBadges() {
  try {
    await achievementsStore.processImmediate({
      crimes: crimesStore.crimes,
      preventedCrimes: preventedCrimesStore.preventedCrimes,
      settings: settingsStore.settings,
    })
  } catch {
    // Badge processing is secondary; keep startup quiet if local persistence is unavailable.
  }
}
</script>
