<template>
  <q-page class="page court-page">
    <section class="court-hero" :style="{ backgroundImage: `url(${courtroomImage})` }" />

    <q-tabs
      v-model="activeTab"
      class="court-tabs"
      active-class="court-tabs__tab--active"
      align="justify"
      dense
      no-caps
      outside-arrows
    >
      <q-tab name="scrutiny" icon="search" label="SCRUTINY" inline-label />
      <q-tab name="verdict" icon="gavel" label="VERDICT" inline-label />
      <q-tab name="rehabilitation" icon="eco" label="REHAB" inline-label />
    </q-tabs>

    <section class="court-period-card">
      <section class="court-period-selectors" aria-label="Court period">
        <q-select
          v-model="selectedMonthKey"
          class="court-period-select court-period-select--month"
          :class="{ 'court-period-select--active': selectedPeriodMode === 'month' }"
          dark
          dense
          emit-value
          map-options
          options-dense
          borderless
          dropdown-icon="expand_more"
          :options="monthOptions"
          :disable="isDeliberating"
          @popup-show="selectedPeriodMode = 'month'"
          @update:model-value="applyMonth"
        >
          <template #prepend>
            <q-icon name="calendar_month" />
          </template>
        </q-select>
        <q-select
          v-model="selectedYear"
          class="court-period-select court-period-select--year"
          :class="{ 'court-period-select--active': selectedPeriodMode === 'year' }"
          dark
          dense
          emit-value
          map-options
          options-dense
          borderless
          dropdown-icon="expand_more"
          :options="yearOptions"
          :disable="isDeliberating"
          @popup-show="selectedPeriodMode = 'year'"
          @update:model-value="applyYear"
        >
          <template #prepend>
            <q-icon name="calendar_month" />
          </template>
        </q-select>
      </section>

      <q-tab-panels v-model="activeTab" class="court-panels" animated>
        <q-tab-panel name="scrutiny" class="court-panel">
          <EmptyState
            v-if="!hasAnyCourtEvidence"
            class="court-empty"
            title="NO EVIDENCE"
            text="The court has insufficient evidence to prosecute."
          />
          <ScrutinyTab
            v-else
            :stats="stats"
            :currency="currency"
            :timeline="crimeTimeline"
            :timeline-mode="selectedPeriodMode"
            :stat-cards="statCards"
            :behaviour-insight="behaviourInsight"
            :previous-damage-label="previousDamageLabel"
          />
        </q-tab-panel>

        <q-tab-panel name="verdict" class="court-panel">
          <EmptyState
            v-if="!hasPeriodEvidence"
            class="court-empty"
            title="NO EVIDENCE"
            text="The court has insufficient evidence to prosecute."
          />
          <VerdictTab
            v-else
            :stats="stats"
            :currency="currency"
            :period-month="periodMonth"
            :verdict-heading="verdictHeading"
            :verdict-result="verdictResult"
            :is-deliberating="isDeliberating"
            :deliberation-step="deliberationSteps[deliberationIndex]"
            :aggravating-circumstances="aggravatingCircumstances"
            :mitigating-circumstances="mitigatingCircumstances"
            @face-jury="faceTheJury"
            @verdict-dismissed="handleVerdictDismissed"
          />
        </q-tab-panel>

        <q-tab-panel name="rehabilitation" class="court-panel">
          <EmptyState
            v-if="!hasPeriodEvidence"
            class="court-empty"
            title="NO EVIDENCE"
            text="The court has insufficient evidence to prosecute."
          />
          <RehabTab
            v-else
            :stats="stats"
            :currency="currency"
            :period-mode="selectedPeriodMode"
            :reduction-options="reductionOptions"
            :rate-options="rateOptions"
            :rehabilitated-monthly="rehabilitatedMonthly"
            :rehabilitated-yearly="rehabilitatedYearly"
            :future-values="futureValues"
            v-model:selected-reduction="selectedReduction"
            v-model:selected-annual-rate="selectedAnnualRate"
          />
        </q-tab-panel>
      </q-tab-panels>
    </section>
  </q-page>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { matLocalFireDepartment } from '@quasar/extras/material-icons'
import EmptyState from '@/components/EmptyState.vue'
import ScrutinyTab from '@/components/court/ScrutinyTab.vue'
import RehabTab from '@/components/court/RehabTab.vue'
import VerdictTab from '@/components/court/VerdictTab.vue'
import courtroomImage from '@/assets/verdict/monthlyVerdict.webp'
import { logAnalyticsEvent } from '@/services/analytics'
import { callVerdict, isAiCreditsExhaustedError } from '@/services/functions'
import { requestMonthlyVerdictReview } from '@/services/inAppReview'
import { getVerdictAsset } from '@/services/remoteAssets'
import { useAchievementsStore } from '@/stores/achievementsStore'
import { useAiCreditsStore } from '@/stores/aiCreditsStore'
import { useCrimesStore } from '@/stores/crimesStore'
import { usePreventedCrimesStore } from '@/stores/preventedCrimesStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { getAllowanceForPeriod } from '@/utils/allowanceHistory'
import {
  formatMoney,
  getMonthlyCrimeTimeline,
  getPeriodMetrics,
  getYearlyCrimeTimeline,
} from '@/utils/crimeStats'
import { calculateFutureValue, generateVerdict, getBehaviourInsight } from '@/utils/courtExperience'
import {
  getMonthKey,
  getMonthOptions,
  getTimelineStart,
  parseMonthKey,
  periodTypes,
} from '@/utils/timePeriods'
import { buildVerdictPayload } from '@/utils/payloadVerdict'
import { isCurrentVerdictRequest } from '@/utils/verdictRequests'

const crimesStore = useCrimesStore()
const preventedStore = usePreventedCrimesStore()
const settingsStore = useSettingsStore()
const achievementsStore = useAchievementsStore()
const aiCreditsStore = useAiCreditsStore()
const $q = useQuasar()

const activeTab = ref('verdict')
const selectedReduction = ref(0.25)
const selectedAnnualRate = ref(7)
const isDeliberating = ref(false)
const deliberationIndex = ref(0)
const verdictResult = ref(null)
const selectedMonthKey = ref(getMonthKey(new Date()))
const selectedYear = ref(new Date().getFullYear())
const selectedPeriodMode = ref('month')
const reviewPendingAfterBadgeDialog = ref(false)
let verdictRequestSequence = 0
let activeVerdictRequestId = 0
let deliberationInterval = null

const deliberationSteps = [
  'REVIEWING EVIDENCE...',
  'CHECKING CRIMINAL RECORD...',
  'JURY DELIBERATING...',
]
const reductionOptions = [
  { label: '10%', value: 0.1 },
  { label: '25%', value: 0.25 },
  { label: '50%', value: 0.5 },
]
const rateOptions = [
  { label: '5%', value: 5 },
  { label: '7%', value: 7 },
  { label: '9%', value: 9 },
]

const currency = computed(() => settingsStore.currency)
const allCourtEvents = computed(() => [...crimesStore.crimes, ...preventedStore.preventedCrimes])
const hasAnyCourtEvidence = computed(() => allCourtEvents.value.length > 0)
const monthOptions = computed(() => getMonthOptions(allCourtEvents.value))
const yearOptions = computed(() => {
  const firstYear = getTimelineStart(allCourtEvents.value).getFullYear()
  const currentYear = new Date().getFullYear()

  return Array.from({ length: currentYear - firstYear + 1 }, (_, index) => {
    const year = currentYear - index
    return { label: String(year), value: year }
  })
})
const selectedMonth = computed(() => parseMonthKey(selectedMonthKey.value))
const currentPeriod = computed(() => ({
  type: selectedPeriodMode.value === 'month' ? periodTypes.MONTH : periodTypes.YEAR,
  year: selectedPeriodMode.value === 'month' ? selectedMonth.value.year : selectedYear.value,
  monthIndex: selectedMonth.value.monthIndex,
}))
const previousPeriod = computed(() => {
  if (selectedPeriodMode.value === 'year') {
    return {
      type: periodTypes.YEAR,
      year: selectedYear.value - 1,
    }
  }

  const { year, monthIndex } = selectedMonth.value
  return {
    type: periodTypes.MONTH,
    year: monthIndex === 0 ? year - 1 : year,
    monthIndex: monthIndex === 0 ? 11 : monthIndex - 1,
  }
})
const allowance = computed(() => getAllowanceForPeriod(settingsStore.settings, currentPeriod.value))
const previousAllowance = computed(() =>
  getAllowanceForPeriod(settingsStore.settings, previousPeriod.value),
)
const stats = computed(() =>
  getPeriodMetrics({
    crimes: crimesStore.crimes,
    preventedCrimes: preventedStore.preventedCrimes,
    period: currentPeriod.value,
    allowance: allowance.value,
  }),
)
const previousStats = computed(() =>
  getPeriodMetrics({
    crimes: crimesStore.crimes,
    preventedCrimes: preventedStore.preventedCrimes,
    period: previousPeriod.value,
    allowance: previousAllowance.value,
  }),
)
const hasPeriodEvidence = computed(() =>
  Boolean(stats.value.crimesCommitted || stats.value.damagesPrevented),
)
const crimeTimeline = computed(() =>
  selectedPeriodMode.value === 'year'
    ? getYearlyCrimeTimeline({
        crimes: crimesStore.crimes,
        settings: settingsStore.settings,
      })
    : getMonthlyCrimeTimeline({
        crimes: crimesStore.crimes,
        settings: settingsStore.settings,
        endMonthKey: selectedMonthKey.value,
      }),
)
const periodMonth = computed(() =>
  selectedPeriodMode.value === 'year'
    ? String(selectedYear.value)
    : new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' })
        .format(stats.value.period.range.start)
        .toUpperCase(),
)
const verdictHeading = computed(() =>
  selectedPeriodMode.value === 'year' ? 'YEARLY VERDICT' : 'MONTHLY VERDICT',
)
const behaviourInsight = computed(() =>
  getBehaviourInsight(stats.value, previousStats.value, selectedPeriodMode.value),
)
const previousDamageLabel = computed(() =>
  formatMoney(previousStats.value.totalDamages, currency.value),
)
const rehabMonthlyBase = computed(() =>
  selectedPeriodMode.value === 'year' ? stats.value.totalDamages / 12 : stats.value.totalDamages,
)
const rehabilitatedMonthly = computed(() => rehabMonthlyBase.value * selectedReduction.value)
const rehabilitatedYearly = computed(() => rehabilitatedMonthly.value * 12)
const futureValues = computed(() =>
  [5, 10, 20].map((years) => ({
    years,
    value: calculateFutureValue({
      monthlyContribution: rehabilitatedMonthly.value,
      annualRate: selectedAnnualRate.value,
      years,
    }),
  })),
)
const statCards = computed(() => [
  { label: 'AVERAGE DAMAGE', value: formatMoney(stats.value.averageCrime, currency.value) },
  { label: 'WORST OFFENSE', value: formatMoney(stats.value.biggestCrime, currency.value) },
  {
    label: 'MOST WANTED CATEGORY',
    value: stats.value.mostWantedCategory
      ? `${stats.value.mostWantedCategory.emoji} ${stats.value.mostWantedCategory.shortLabel}`
      : 'None',
  },
  { label: 'UNREPORTED DAMAGES', value: `${stats.value.unreportedDamages} cases` },
  { label: 'CLEAN STREAK', value: `${stats.value.cleanStreak} days` },
  { label: 'DAMAGES PREVENTED', value: formatMoney(stats.value.damagesPrevented, currency.value) },
])
const aggravatingCircumstances = computed(() => {
  if (stats.value.allowanceExceededBy) {
    return `Crime Allowance exceeded by ${formatMoney(stats.value.allowanceExceededBy, currency.value)}`
  }
  if (stats.value.mostWantedCategory?.count >= 3) return 'Repeat category offender'
  return 'Evidence remains concerning'
})
const mitigatingCircumstances = computed(() => {
  if (stats.value.damagesPrevented) {
    return `${formatMoney(stats.value.damagesPrevented, currency.value)} in crimes prevented`
  }
  if (stats.value.cleanStreak) return `${stats.value.cleanStreak}-day clean streak`
  return 'No mitigating paperwork filed'
})

watch(selectedMonthKey, () => {
  verdictResult.value = null
  deliberationIndex.value = 0
})

watch(selectedYear, () => {
  verdictResult.value = null
  deliberationIndex.value = 0
})

watch(selectedPeriodMode, () => {
  verdictResult.value = null
  deliberationIndex.value = 0
})

watch(
  () => achievementsStore.unlockDialogOpen,
  (isOpen) => {
    if (isOpen || !reviewPendingAfterBadgeDialog.value) return

    reviewPendingAfterBadgeDialog.value = false
    requestMonthlyVerdictReview()
  },
)

function applyMonth(value) {
  selectedPeriodMode.value = 'month'
  selectedMonthKey.value = value
  selectedYear.value = parseMonthKey(value).year
}

function applyYear(value) {
  selectedPeriodMode.value = 'year'
  selectedYear.value = value
}

function faceTheJury() {
  if (isDeliberating.value) return

  const request = createVerdictRequest()
  verdictResult.value = null
  isDeliberating.value = true
  deliberationIndex.value = 0
  activeVerdictRequestId = request.id
  startDeliberationTimer()
  deliverVerdict(request).catch(() => {
    if (!isActiveVerdictRequest(request)) return

    $q.notify({ type: 'negative', message: 'Unable to deliver this verdict.' })
  })
}

function handleVerdictDismissed() {
  const isCompletedMonthlyVerdict =
    selectedPeriodMode.value === 'month' && selectedMonthKey.value < getMonthKey(new Date())

  if (!verdictResult.value || !isCompletedMonthlyVerdict) return

  if (achievementsStore.unlockDialogOpen) {
    reviewPendingAfterBadgeDialog.value = true
    return
  }

  requestMonthlyVerdictReview()
}

async function deliverVerdict(request) {
  try {
    const useAiExperience = settingsStore.settings.aiTextEnabled !== false
    const assetPromise = useAiExperience ? getVerdictAsset(request.verdict.status) : null
    const generation = await loadVerdictQuote(request)
    const resolvedAsset = generation.didUseAi ? await assetPromise : undefined

    if (!isActiveVerdictRequest(request)) return

    trackVerdict(request.verdict, request)

    try {
      await achievementsStore.processPendingMonths({
        crimes: crimesStore.crimes,
        preventedCrimes: preventedStore.preventedCrimes,
        settings: settingsStore.settings,
      })
    } catch {
      if (isActiveVerdictRequest(request)) {
        $q.notify({
          type: 'negative',
          message: 'Verdict delivered, but achievements could not be processed.',
        })
      }
    }

    if (isActiveVerdictRequest(request)) {
      verdictResult.value = { ...generation.verdict, visualAsset: resolvedAsset }
    }
  } finally {
    if (request.id === activeVerdictRequestId) {
      isDeliberating.value = false
      stopDeliberationTimer()
    }
  }
}

async function loadVerdictQuote(request) {
  if (settingsStore.settings.aiTextEnabled === false) {
    return { verdict: request.verdict, didUseAi: false }
  }

  const balanceRequestSequence = aiCreditsStore.beginBalanceRequest()

  try {
    const result = await callVerdict(
      buildVerdictPayload({
        verdict: request.verdict,
        stats: request.stats,
        previousStats: request.previousStats,
        periodMode: request.periodMode,
        periodLabel: request.periodLabel,
        currency: request.currency,
        courtStrictness: request.courtStrictness,
        aggravatingCircumstances: request.aggravatingCircumstances,
        mitigatingCircumstances: request.mitigatingCircumstances,
      }),
    )
    aiCreditsStore.applyServerBalance(result, balanceRequestSequence)
    logAnalyticsEvent('ai_credit_consumed', {
      generation_type: 'verdict',
      credits_remaining: result.creditsRemaining,
    })
    const quote = getCallableQuote(result)

    return {
      verdict: quote ? { ...request.verdict, quote } : request.verdict,
      didUseAi: Boolean(quote),
    }
  } catch (error) {
    if (isAiCreditsExhaustedError(error)) {
      aiCreditsStore.markExhausted(balanceRequestSequence)
      aiCreditsStore.openPurchaseDialog()
      logAnalyticsEvent('ai_credits_exhausted', { generation_type: 'verdict' })
      $q.notify({
        type: 'warning',
        icon: matLocalFireDepartment,
        message: 'COURT-APPOINTED COMEDIAN EXHAUSTED',
        caption: 'You have no AI Crimes left. The local verdict is still available.',
      })
    }
    // Keep the local fallback if the remote verdict is unavailable.
    return { verdict: request.verdict, didUseAi: false }
  }
}

function getCallableQuote(result) {
  return typeof result?.quote === 'string' ? result.quote.trim() : ''
}

function trackVerdict(verdict, request) {
  // Verdict analytics stay aggregated: no crime names, notes, or per-transaction details.
  logAnalyticsEvent('monthly_verdict_generated', {
    month: request.periodMode === 'month' ? request.monthKey : null,
    year: request.periodMode === 'year' ? request.year : null,
    period_mode: request.periodMode,
    verdict_id: verdict.id,
    verdict_status: verdict.status,
    severity: verdict.severity,
    crimes_committed: request.stats.crimesCommitted,
    prevented_crimes: request.stats.preventedCrimes.length,
    has_allowance: request.stats.allowance == null ? 0 : 1,
    allowance_exceeded: request.stats.allowanceExceededBy > 0 ? 1 : 0,
  })
}

function createVerdictRequest() {
  return {
    id: ++verdictRequestSequence,
    periodKey: currentVerdictPeriodKey(),
    periodMode: selectedPeriodMode.value,
    periodLabel: periodMonth.value,
    monthKey: selectedMonthKey.value,
    year: selectedYear.value,
    stats: stats.value,
    previousStats: previousStats.value,
    currency: currency.value,
    courtStrictness: settingsStore.settings.courtStrictness,
    aggravatingCircumstances: aggravatingCircumstances.value,
    mitigatingCircumstances: mitigatingCircumstances.value,
    verdict: generateVerdict(stats.value),
  }
}

function currentVerdictPeriodKey() {
  return selectedPeriodMode.value === 'year'
    ? `year:${selectedYear.value}`
    : `month:${selectedMonthKey.value}`
}

function isActiveVerdictRequest(request) {
  return isCurrentVerdictRequest(request, activeVerdictRequestId, currentVerdictPeriodKey())
}

function startDeliberationTimer() {
  stopDeliberationTimer()
  deliberationInterval = window.setInterval(() => {
    deliberationIndex.value =
      deliberationIndex.value < deliberationSteps.length - 1 ? deliberationIndex.value + 1 : 0
  }, 650)
}

function stopDeliberationTimer() {
  if (deliberationInterval === null) return

  window.clearInterval(deliberationInterval)
  deliberationInterval = null
}

onBeforeUnmount(() => {
  activeVerdictRequestId = ++verdictRequestSequence
  stopDeliberationTimer()
})
</script>
