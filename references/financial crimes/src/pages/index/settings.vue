<template>
  <q-page class="page">
    <header class="screen-header">
      <div>
        <h1>Settings</h1>
        <div class="section-kicker">CONTROL ROOM</div>
      </div>
    </header>

    <section class="panel upgrade-panel">
      <div class="section-heading">UPGRADE</div>

      <div class="upgrade-panel__status">
        <div>
          <div class="panel-label">Current access</div>
          <span>{{ aiCreditsStore.balanceLabel }}</span>
        </div>
        <q-icon
          :name="aiCreditsStore.unlimited ? matVerified : matLocalFireDepartment"
          color="warning"
          size="28px"
        />
      </div>

      <div v-if="aiCreditsStore.unlimited" class="upgrade-panel__pro-active">
        <q-icon :name="matVerified" color="warning" size="24px" />
        <div>
          <strong>PRO ACTIVE</strong>
          <span>Extended AI access is enabled.</span>
        </div>
      </div>

      <div
        v-else-if="aiCreditsStore.billingStatus === 'loading'"
        class="upgrade-panel__unavailable"
      >
        <q-spinner color="warning" size="20px" />
        Connecting to Google Play…
      </div>

      <div v-else-if="aiCreditsStore.creditPacks.length" class="upgrade-options">
        <q-btn
          v-for="pack in aiCreditsStore.creditPacks"
          :key="pack.productId"
          class="upgrade-option"
          :class="{ 'upgrade-option--pro': pack.unlimited }"
          outline
          color="warning"
          no-caps
          :loading="aiCreditsStore.purchasingProductId === pack.productId"
          :disable="aiCreditsStore.isPurchasing"
          @click="buyAiProduct(pack.productId)"
        >
          <span class="upgrade-option__copy">
            <span class="upgrade-option__title">
              {{ pack.unlimited ? 'PRO' : `${pack.credits} AI Crimes` }}
            </span>
            <span v-if="pack.unlimited" class="upgrade-option__description">
              Extended AI access · No credit deductions · Fair-use limits may apply
            </span>
          </span>
          <span class="upgrade-option__price">
            <span v-if="pack.unlimited" class="upgrade-option__badge">BEST VALUE</span>
            <strong>{{ pack.product.priceString }}</strong>
          </span>
        </q-btn>
      </div>

      <div v-else class="upgrade-panel__unavailable">Purchases unavailable from Google Play</div>

      <div class="upgrade-panel__share">
        <div>
          <div class="section-heading">SHARE THE APP</div>
          <p>Help recruit more convicted spenders.</p>
        </div>
        <q-btn
          outline
          color="warning"
          no-caps
          icon="share"
          label="Share Financial Crimes"
          @click="shareApp"
        />
      </div>
    </section>

    <section class="panel q-gutter-md">
      <div class="section-heading">FINANCIAL PARAMETERS</div>
      <q-select
        v-model="localCurrency"
        dark
        emit-value
        map-options
        :options="currencyOptions"
        label="Currency"
        @update:model-value="saveCurrency"
      />

      <div class="allowance-setting">
        <div>
          <div class="panel-label">Monthly Crime Allowance</div>
          <strong>{{ currentAllowanceLabel }}</strong>
        </div>
        <q-btn
          outline
          color="warning"
          no-caps
          icon="edit"
          label="Edit"
          @click="openAllowanceDialog"
        />
      </div>
    </section>

    <q-dialog v-model="allowanceDialog">
      <q-card class="edit-dialog allowance-history-dialog">
        <q-card-section class="dialog-header">
          <div>
            <div class="section-kicker">FINANCIAL PARAMETERS</div>
            <h2>Monthly allowance</h2>
          </div>
          <q-btn flat round dense color="white" icon="close" aria-label="Close" v-close-popup />
        </q-card-section>

        <q-card-section class="allowance-history-editor">
          <div class="allowance-history-editor__header">
            <div class="panel-label">Changes</div>
            <q-btn
              flat
              round
              dense
              color="warning"
              icon="add"
              aria-label="Add allowance month"
              @click="addAllowanceEntry"
            />
          </div>

          <div class="allowance-history-editor__rows">
            <div
              v-for="(entry, index) in draftAllowanceHistory"
              :key="`${entry.month}-${index}`"
              class="allowance-history-editor__row"
            >
              <q-input v-model="entry.month" dark dense label="From month" type="month" />
              <q-input
                v-model="entry.amount"
                dark
                dense
                label="Allowance"
                :prefix="currencySymbol"
                type="number"
              />
              <q-btn
                flat
                round
                dense
                color="negative"
                icon="delete"
                aria-label="Delete allowance month"
                @click="removeAllowanceEntry(index)"
              />
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat color="white" no-caps label="Cancel" v-close-popup />
          <q-btn
            color="warning"
            text-color="black"
            no-caps
            label="Save"
            @click="saveAllowanceHistory"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <section class="panel">
      <div class="section-heading">CRIMES BEFORE THE COURT</div>
      <div class="settings-category-grid">
        <button
          v-for="category in crimeCategories"
          :key="category.id"
          class="category-choice"
          :class="{ 'category-choice--selected': localCategories.includes(category.id) }"
          type="button"
          @click="toggleCategory(category.id)"
        >
          <span>{{ category.emoji }}</span>
          <strong>{{ category.label }}</strong>
        </button>
      </div>
    </section>

    <section class="panel q-gutter-md">
      <div class="section-heading">COURT SETTINGS</div>
      <q-option-group
        v-model="localStrictness"
        dark
        :options="strictnessOptions"
        color="warning"
        @update:model-value="saveSettings"
      />
      <div class="ai-setting">
        <div>
          <div class="panel-label">
            AI roasts, verdicts & artwork
            <q-icon
              class="ai-info-button"
              name="info"
              color="warning"
              size="18px"
              role="img"
              aria-label="About AI roasts, verdicts and artwork"
            >
              <q-tooltip class="app-tooltip" max-width="260px">
                When AI is used, the app pairs Gemini-generated roasts and verdicts with remote
                artwork. If AI is disabled or unavailable, local copy and artwork are used instead.
              </q-tooltip>
            </q-icon>
          </div>
          <span>Use AI copy and remote artwork</span>
        </div>
        <q-toggle v-model="localAiTextEnabled" color="warning" @update:model-value="saveSettings" />
      </div>
    </section>

    <section class="panel q-gutter-sm">
      <div class="section-heading">DATA</div>
      <q-btn outline color="warning" no-caps label="Reset onboarding" @click="resetOnboarding" />
      <q-btn outline color="negative" no-caps label="Delete all data" @click="deleteAll" />
    </section>

    <section class="panel contact-panel">
      <div class="section-heading">CONTACT OFFBEAT STUDIO</div>
      <p>Need help or have a problem?</p>

      <div class="contact-panel__field">
        <span>Email us at:</span>
        <a :href="supportEmailHref">{{ supportEmail }}</a>
      </div>

      <div class="contact-panel__field">
        <span>Your User ID:</span>
        <div class="contact-panel__user-id">
          <code>{{ supportUserId || 'Loading…' }}</code>
          <q-btn
            flat
            round
            dense
            color="warning"
            icon="content_copy"
            aria-label="Copy User ID"
            :disable="!supportUserId || supportUserId === 'Unavailable'"
            @click="copySupportUserId"
          />
        </div>
      </div>

      <p class="contact-panel__note">
        To request deletion of data associated with your anonymous User ID, or for help with an
        in-app purchase, contact us at <a :href="supportEmailHref">{{ supportEmail }}</a
        >. Please include your User ID in the message.
      </p>
    </section>

    <section class="panel privacy-panel">
      <div class="section-heading">PRIVACY</div>
      <p>
        Financial Crimes is local-first. Your expenses, subscriptions, categories, and case history
        are stored on this device and are not uploaded as a complete financial history. The app does
        not connect to your bank or request your account credentials.
      </p>
      <p>
        Firebase assigns this installation an anonymous User ID. We store limited backend data
        associated with that ID to manage AI credits, verify in-app purchases, prevent duplicate
        grants, and provide support. Firebase Analytics may also process app usage and technical
        device information. We do not require your name, email address, or password.
      </p>
      <p>
        Optional AI features send only the information needed to generate the requested content
        through Firebase Cloud Functions to Google Gemini. Financial Crimes does not retain those AI
        requests or responses in its own database. Avoid entering sensitive personal information in
        content that may be processed by AI.
      </p>
      <p>
        Clearing app data, uninstalling the app, changing devices, or using Delete all data may
        permanently remove local records and may create a new anonymous User ID, causing you to lose
        access to previous credits.
      </p>
      <div class="privacy-panel__actions">
        <q-btn
          outline
          color="warning"
          no-caps
          icon="policy"
          label="Privacy Policy"
          :href="privacyPolicyUrl"
          target="_blank"
          rel="noopener noreferrer"
        />
        <q-btn
          outline
          color="warning"
          no-caps
          icon="flag"
          label="Report an AI response"
          @click="openAiReportDialog"
        />
      </div>
    </section>

    <q-dialog v-model="aiReportDialog">
      <q-card class="edit-dialog ai-report-dialog">
        <q-card-section class="dialog-header">
          <div>
            <div class="section-kicker">AI SAFETY</div>
            <h2>Report an AI response</h2>
          </div>
          <q-btn flat round dense color="white" icon="close" aria-label="Close" v-close-popup />
        </q-card-section>

        <q-card-section class="q-gutter-md">
          <p class="ai-report-dialog__copy">
            Report offensive, harmful, or misleading content generated by Gemini. Only the
            information you enter below will be submitted for moderation.
          </p>
          <q-select
            v-model="aiReportResponseType"
            dark
            emit-value
            map-options
            :options="aiResponseTypeOptions"
            label="Response type"
          />
          <q-select
            v-model="aiReportReason"
            dark
            emit-value
            map-options
            :options="aiReportReasonOptions"
            label="Reason"
          />
          <q-input
            v-model="aiReportDetails"
            dark
            autogrow
            counter
            maxlength="1000"
            type="textarea"
            label="What happened? (optional)"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat color="white" no-caps label="Cancel" v-close-popup />
          <q-btn
            color="warning"
            text-color="black"
            no-caps
            icon="flag"
            label="Submit report"
            :loading="isSubmittingAiReport"
            :disable="!aiReportResponseType || !aiReportReason"
            @click="submitAiReport"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <AppConfirmDialog
      v-model="deleteAllDialog"
      title="Delete all data?"
      message="Every case file, prevented crime, subscription, and court setting stored on this device will be deleted."
      confirm-label="Delete all data"
      @confirm="confirmDeleteAll"
    />
  </q-page>
</template>

<script setup>
import { Share } from '@capacitor/share'
import { matLocalFireDepartment, matVerified } from '@quasar/extras/material-icons'
import { computed, onMounted, ref } from 'vue'
import { copyToClipboard, useQuasar } from 'quasar'
import AppConfirmDialog from '@/components/AppConfirmDialog.vue'
import { crimeCategories } from '@/config/crimeCategories'
import { currencyOptions, getCurrencySymbol, normalizeCurrency } from '@/config/currencies'
import { logAnalyticsEvent } from '@/services/analytics'
import { ensureRemoteAuthReady } from '@/services/remoteReadiness'
import { useAchievementsStore } from '@/stores/achievementsStore'
import { useAiCreditsStore } from '@/stores/aiCreditsStore'
import { useCrimesStore } from '@/stores/crimesStore'
import { usePreventedCrimesStore } from '@/stores/preventedCrimesStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { getAllowanceForMonth, normalizeAllowanceHistory } from '@/utils/allowanceHistory'
import { formatMoney } from '@/utils/crimeStats'
import { getMonthKey } from '@/utils/timePeriods'
import { reportAiResponse } from '@/services/functions'

const settingsStore = useSettingsStore()
const crimesStore = useCrimesStore()
const preventedCrimesStore = usePreventedCrimesStore()
const achievementsStore = useAchievementsStore()
const aiCreditsStore = useAiCreditsStore()
const $q = useQuasar()

const localStrictness = ref('reasonable')
const localAiTextEnabled = ref(true)
const localCurrency = ref('EUR')
const localAllowanceHistory = ref([])
const draftAllowanceHistory = ref([])
const localCategories = ref([])
const allowanceDialog = ref(false)
const aiReportDialog = ref(false)
const deleteAllDialog = ref(false)
const aiReportResponseType = ref(null)
const aiReportReason = ref(null)
const aiReportDetails = ref('')
const isSubmittingAiReport = ref(false)
const supportUserId = ref('')
const supportEmail = 'offbeatstudioapps@gmail.com'
const privacyPolicyUrl =
  'https://doc-hosting.flycricket.io/financial-crimes-privacy-policy/aa270cfe-6ca0-4f3b-ac58-b51e59f1c4bb/privacy'

const strictnessOptions = [
  { label: '😇 CHILL', value: 'chill' },
  { label: '⚖️ REASONABLE', value: 'reasonable' },
  { label: '😈 RUTHLESS', value: 'ruthless' },
]

const aiResponseTypeOptions = [
  { label: 'Roast', value: 'roast' },
  { label: 'Verdict', value: 'verdict' },
  { label: 'Other AI content', value: 'other' },
]

const aiReportReasonOptions = [
  { label: 'Offensive content', value: 'offensive' },
  { label: 'Harmful content', value: 'harmful' },
  { label: 'Misleading content', value: 'misleading' },
  { label: 'Other concern', value: 'other' },
]

const currencySymbol = computed(() => getCurrencySymbol(localCurrency.value))
const currentMonthKey = computed(() => getMonthKey(new Date()))
const currentAllowance = computed(() =>
  getAllowanceForMonth(
    localAllowanceHistory.value,
    currentMonthKey.value,
    settingsStore.settings.monthlyCrimeAllowance,
  ),
)
const currentAllowanceLabel = computed(() =>
  currentAllowance.value == null
    ? 'Not set'
    : formatMoney(currentAllowance.value, localCurrency.value),
)
const supportEmailHref = computed(() => {
  const subject = encodeURIComponent('Financial Crimes support')
  const body = encodeURIComponent(`\n\nUser ID: ${supportUserId.value || 'Unavailable'}`)
  return `mailto:${supportEmail}?subject=${subject}&body=${body}`
})

onMounted(() => {
  localStrictness.value = settingsStore.settings.courtStrictness
  localAiTextEnabled.value = settingsStore.settings.aiTextEnabled !== false
  localCurrency.value = normalizeCurrency(settingsStore.settings.currency)
  localAllowanceHistory.value = normalizeAllowanceHistory(
    settingsStore.settings.monthlyCrimeAllowanceHistory,
    settingsStore.settings.monthlyCrimeAllowance,
    settingsStore.settings.currency,
  )
  localCategories.value = [...settingsStore.selectedCategories]
  loadSupportUserId()
})

async function loadSupportUserId() {
  try {
    const user = await ensureRemoteAuthReady()
    supportUserId.value = user.uid
  } catch {
    supportUserId.value = 'Unavailable'
  }
}

async function copySupportUserId() {
  if (!supportUserId.value || supportUserId.value === 'Unavailable') return

  try {
    await copyToClipboard(supportUserId.value)
    $q.notify({ type: 'positive', message: 'User ID copied.' })
  } catch {
    $q.notify({ type: 'negative', message: 'Unable to copy User ID.' })
  }
}

async function saveSettings() {
  try {
    const currency = normalizeCurrency(localCurrency.value)

    await settingsStore.update({
      courtStrictness: localStrictness.value,
      aiTextEnabled: localAiTextEnabled.value,
      currency,
      selectedCategories: localCategories.value,
    })

    localCurrency.value = settingsStore.settings.currency
    localAllowanceHistory.value = settingsStore.settings.monthlyCrimeAllowanceHistory.map(
      (entry) => ({ ...entry }),
    )
  } catch {
    $q.notify({ type: 'negative', message: 'Unable to save settings.' })
  }
}

async function saveCurrency(value) {
  try {
    const currency = normalizeCurrency(value)
    localCurrency.value = currency

    await settingsStore.update({ currency })

    localCurrency.value = settingsStore.settings.currency
    localAllowanceHistory.value = settingsStore.settings.monthlyCrimeAllowanceHistory.map(
      (entry) => ({ ...entry }),
    )
  } catch {
    localCurrency.value = settingsStore.currency
    $q.notify({ type: 'negative', message: 'Unable to save currency.' })
  }
}

function openAllowanceDialog() {
  draftAllowanceHistory.value = localAllowanceHistory.value.map((entry) => ({
    ...entry,
    amount: entry.amount ?? '',
  }))
  allowanceDialog.value = true
}

function addAllowanceEntry() {
  const existingMonths = new Set(draftAllowanceHistory.value.map((entry) => entry.month))
  const cursor = new Date()

  while (existingMonths.has(getMonthKey(cursor))) {
    cursor.setMonth(cursor.getMonth() - 1)
  }

  draftAllowanceHistory.value.unshift({
    month: getMonthKey(cursor),
    amount: currentAllowance.value ?? '',
    currency: normalizeCurrency(localCurrency.value),
  })
}

function removeAllowanceEntry(index) {
  draftAllowanceHistory.value.splice(index, 1)
}

async function saveAllowanceHistory() {
  try {
    const currency = normalizeCurrency(localCurrency.value)
    const allowanceHistory = normalizeAllowanceHistory(draftAllowanceHistory.value, null, currency)
    const allowance = getAllowanceForMonth(allowanceHistory, currentMonthKey.value)

    await settingsStore.update({
      currency,
      monthlyCrimeAllowance: allowance,
      monthlyCrimeAllowanceHistory: allowanceHistory,
    })

    localCurrency.value = settingsStore.settings.currency
    localAllowanceHistory.value = settingsStore.settings.monthlyCrimeAllowanceHistory.map(
      (entry) => ({ ...entry }),
    )
    allowanceDialog.value = false
  } catch {
    $q.notify({ type: 'negative', message: 'Unable to save allowance history.' })
  }
}

async function toggleCategory(categoryId) {
  if (localCategories.value.includes(categoryId)) {
    localCategories.value = localCategories.value.filter((id) => id !== categoryId)
  } else {
    localCategories.value.push(categoryId)
  }

  if (localCategories.value.length === 0) {
    localCategories.value = [categoryId]
  }

  await saveSettings()
}

async function resetOnboarding() {
  try {
    await settingsStore.resetOnboarding()
    $q.notify({ type: 'positive', message: 'Onboarding reset.' })
  } catch {
    $q.notify({ type: 'negative', message: 'Unable to reset onboarding.' })
  }
}

async function buyAiProduct(productId) {
  logAnalyticsEvent('ai_purchase_started', { product_id: productId, source: 'settings' })

  try {
    const result = await aiCreditsStore.buyCreditPack(productId)
    if (result.pending) {
      $q.notify({
        type: 'info',
        message: 'Purchase pending',
        caption: 'Google Play is processing it.',
      })
      return
    }

    logAnalyticsEvent('ai_purchase_completed', {
      product_id: productId,
      credits_granted: result.creditsGranted,
      unlimited_granted: result.unlimited ? 1 : 0,
      source: 'settings',
    })
    $q.notify({
      type: 'positive',
      message: result.unlimited ? 'PRO UPGRADE UNLOCKED' : 'AI CRIMES GRANTED',
      caption: result.unlimited
        ? 'Extended AI access is now active.'
        : `${result.credits} AI Crimes are now available.`,
    })
  } catch (error) {
    const cancelled = /cancel/i.test(String(error?.message || error))
    logAnalyticsEvent(cancelled ? 'ai_purchase_cancelled' : 'ai_purchase_verification_failed', {
      product_id: productId,
      source: 'settings',
    })

    if (!cancelled) {
      $q.notify({
        type: 'negative',
        message: 'Purchase could not be completed.',
        caption: 'It will be recovered automatically if Google Play charged it.',
      })
    }
  }
}

async function shareApp() {
  logAnalyticsEvent('app_shared', { source: 'settings' })

  try {
    const { value: canShare } = await Share.canShare()

    if (!canShare) {
      console.warn('App sharing is unavailable on this platform.')
      return
    }

    await Share.share({
      title: 'Financial Crimes',
      text: 'Your spending deserves a criminal record. Join the community of convicted spenders.',
      url: 'https://play.google.com/store/apps/details?id=com.offbeatstudio.financialcrimes',
      dialogTitle: 'Share Financial Crimes',
    })
  } catch (error) {
    if (error?.name === 'AbortError' || error?.message === 'Share canceled') return

    console.warn('Unable to share Financial Crimes:', error)
  }
}

function openAiReportDialog() {
  aiReportResponseType.value = null
  aiReportReason.value = null
  aiReportDetails.value = ''
  aiReportDialog.value = true
}

async function submitAiReport() {
  if (!aiReportResponseType.value || !aiReportReason.value || isSubmittingAiReport.value) return

  isSubmittingAiReport.value = true

  try {
    await reportAiResponse({
      responseType: aiReportResponseType.value,
      reason: aiReportReason.value,
      details: aiReportDetails.value.trim(),
    })

    aiReportDialog.value = false
    $q.notify({ type: 'positive', message: 'AI response reported. Thank you.' })
  } catch {
    $q.notify({ type: 'negative', message: 'Unable to submit the report.' })
  } finally {
    isSubmittingAiReport.value = false
  }
}

function deleteAll() {
  deleteAllDialog.value = true
}

async function confirmDeleteAll() {
  try {
    await settingsStore.deleteEverything()
    crimesStore.clearLocal()
    preventedCrimesStore.clearLocal()
    achievementsStore.clearLocal()
    $q.notify({ type: 'positive', message: 'All local data deleted.' })
  } catch {
    $q.notify({ type: 'negative', message: 'Unable to delete local data.' })
  }
}
</script>
