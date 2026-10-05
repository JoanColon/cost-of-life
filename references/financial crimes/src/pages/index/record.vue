<template>
  <q-page class="page">
    <header class="screen-header">
      <div>
        <h1>CRIMINAL RECORD</h1>
        <div class="section-kicker">Committed and prevented crimes</div>
      </div>
    </header>

    <EmptyState
      v-if="!archiveEvents.length"
      title="NO CRIMINAL RECORD"
      text="Suspiciously responsible."
    />

    <template v-else>
      <section class="record-date-filter">
        <div class="record-date-filter__header">
          <div class="record-date-filter__title">CRIMINAL PERIOD</div>
          <div class="record-date-filter__count">{{ filteredArchiveEvents.length }} cases</div>
        </div>
        <div class="record-date-filter__presets">
          <q-select
            v-model="selectedMonth"
            class="record-date-filter__select"
            :class="{ 'record-date-filter__select--active': selectedDateMode === 'month' }"
            dark
            dense
            emit-value
            map-options
            options-dense
            borderless
            dropdown-icon="expand_more"
            :options="monthOptions"
            @popup-show="selectedDateMode = 'month'"
            @update:model-value="applyMonth"
          >
            <template #prepend>
              <q-icon name="calendar_month" />
            </template>
          </q-select>
          <q-select
            v-model="selectedYear"
            class="record-date-filter__select"
            :class="{ 'record-date-filter__select--active': selectedDateMode === 'year' }"
            dark
            dense
            emit-value
            map-options
            options-dense
            borderless
            dropdown-icon="expand_more"
            :options="yearOptions"
            @popup-show="selectedDateMode = 'year'"
            @update:model-value="applyYear"
          >
            <template #prepend>
              <q-icon name="calendar_month" />
            </template>
          </q-select>
        </div>
        <div class="record-date-filter__summary">
          <div>
            Total damage for this criminal period:
            <strong>{{ formatMoney(filteredDamageTotal, currency) }}</strong>
          </div>
          <div>
            Prevented damage for this criminal period:
            <strong class="record-date-filter__summary-prevented">
              {{ formatMoney(filteredPreventedDamageTotal, currency) }}
            </strong>
          </div>
        </div>
      </section>

      <section v-if="categoryGroups.length" class="record-categories">
        <q-expansion-item
          v-for="group in categoryGroups"
          :key="group.category.id"
          class="record-accordion"
          expand-icon="keyboard_arrow_down"
        >
          <template #header>
            <q-item-section avatar>
              <div class="record-accordion__emoji">{{ group.category.emoji }}</div>
            </q-item-section>
            <q-item-section>
              <q-item-label class="record-accordion__category">
                {{ group.category.label }}
              </q-item-label>
              <q-item-label class="record-accordion__meta">
                {{ group.count }} cases
                <span v-if="group.preventedCount"> · {{ group.preventedCount }} prevented</span>
                <span v-if="group.pendingCount"> · {{ group.pendingCount }} incomplete</span>
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <div
                class="record-accordion__total"
                :class="{
                  'record-accordion__total--prevented': !group.total && group.preventedTotal,
                }"
              >
                {{
                  group.total
                    ? formatMoney(group.total, currency)
                    : `Saved ${formatMoney(group.preventedTotal, currency)}`
                }}
              </div>
            </q-item-section>
          </template>

          <div class="record-accordion__body">
            <CrimeCard
              v-for="crime in group.crimes"
              :key="crime.id"
              :crime="crime"
              :currency="currency"
              @roast="openRoast"
              @edit="openEdit"
              @delete="confirmDelete"
              @cancel-subscription="confirmCancelSubscription"
            />
          </div>
        </q-expansion-item>
      </section>

      <EmptyState
        v-else
        title="NO CASES IN RANGE"
        text="The selected dates are unusually law-abiding."
      />
    </template>

    <q-dialog v-model="editDialog">
      <q-card class="edit-dialog">
        <q-card-section class="dialog-header">
          <div>
            <div class="section-kicker">CASE FILE</div>
            <h2>{{ editingCrime?.title || editingCrime?.crimeName }}</h2>
          </div>
          <q-btn v-close-popup flat round dense color="white" icon="close" aria-label="Close" />
        </q-card-section>
        <q-card-section class="q-gutter-md">
          <q-select
            v-if="isEditingPreventedCrime"
            v-model="editCategoryId"
            dark
            emit-value
            map-options
            :options="categoryOptions"
            label="Category"
          />
          <q-input v-if="isEditingPreventedCrime" v-model="editTitle" dark label="Description" />
          <q-input
            v-model="editAmount"
            dark
            :label="isEditingPreventedCrime ? 'Potential damage' : 'Damages'"
            :prefix="currencySymbol"
            type="number"
            min="0.01"
          />
          <q-select
            v-if="editingCrime?.categoryId === 'subscriptions'"
            v-model="editRecurrence"
            dark
            emit-value
            map-options
            :options="recurrenceEditOptions"
            label="How often"
          />
          <q-input v-model="editOccurredAt" dark label="Occurred at" type="date" />
          <q-input v-model="editNotes" dark autogrow label="Notes" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn v-close-popup flat no-caps label="Cancel" />
          <q-btn
            color="warning"
            text-color="black"
            unelevated
            no-caps
            label="Save"
            :loading="isSavingEdit"
            :disable="isSavingEdit || !hasValidEditAmount"
            @click="saveEdit"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="roastDialog" class="criminal-card-dialog-shell">
      <q-card class="criminal-card-dialog">
        <div
          class="criminal-card-frame"
          :style="{ backgroundImage: `url(${selectedCriminalCardImage})` }"
        >
          <q-btn
            v-close-popup
            class="verdict-dialog__close"
            flat
            round
            dense
            icon="close"
            color="white"
            aria-label="Close"
          />

          <q-card-section v-if="roastCrime" class="criminal-card-poster">
            <div class="criminal-card-poster__case">
              CASE NO. {{ roastCaseNumber }}
              <br />
              DATE {{ roastDate }}
              <br />
              CATEGORY {{ roastCategoryLabel }}
            </div>
            <div class="criminal-card-poster__amount">
              {{ roastAmountLabel }}
            </div>
            <div class="criminal-card-poster__title">
              {{ roastCrime.title || roastCrime.crimeName }}
            </div>
            <blockquote class="criminal-card-poster__quote">"{{ roastQuote }}"</blockquote>
          </q-card-section>
        </div>

        <q-inner-loading
          :showing="isSharingRoast || isLoadingRoastQuote"
          dark
          :label="isLoadingRoastQuote ? 'Generating roast...' : 'Generating card...'"
        />

        <q-card-actions class="verdict-dialog__actions">
          <q-btn
            class="verdict-share-button criminal-card-share-button"
            text-color="white"
            unelevated
            no-caps
            icon="ios_share"
            :loading="isSharingRoast"
            :disable="isSharingRoast || isLoadingRoastQuote || !roastQuote"
            :label="isSharingRoast ? 'GENERATING...' : 'SHARE'"
            @click="shareRoast"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <AppConfirmDialog
      v-model="confirmDialog"
      :title="confirmDialogOptions.title"
      :message="confirmDialogOptions.message"
      :confirm-label="confirmDialogOptions.confirmLabel"
      :confirm-color="confirmDialogOptions.confirmColor"
      :confirm-text-color="confirmDialogOptions.confirmTextColor"
      @confirm="runConfirmedAction"
    />

    <div class="share-export-host" aria-hidden="true">
      <CriminalShareCard v-if="roastCrime" ref="criminalShareCard" v-bind="roastShareData" />
    </div>
  </q-page>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useQuasar } from 'quasar'
import { matLocalFireDepartment } from '@quasar/extras/material-icons'
import AppConfirmDialog from '@/components/AppConfirmDialog.vue'
import CrimeCard from '@/components/CrimeCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import CriminalShareCard from '@/components/record/CriminalShareCard.vue'
import criminalCardImage from '@/assets/crimialCards/CriminalCard.webp'
import { crimeCategories } from '@/config/crimeCategories'
import { getCurrencySymbol } from '@/config/currencies'
import { logAnalyticsEvent } from '@/services/analytics'
import { callRoast, isAiCreditsExhaustedError } from '@/services/functions'
import { getCrimeAsset } from '@/services/remoteAssets'
import { useAiCreditsStore } from '@/stores/aiCreditsStore'
import { useCrimesStore } from '@/stores/crimesStore'
import { usePreventedCrimesStore } from '@/stores/preventedCrimesStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { formatMoney, sumAmounts } from '@/utils/crimeStats'
import {
  eventDate,
  formatDateInput,
  getPersistedEventId,
  mergeDateInputWithEventTime,
} from '@/utils/eventDates'
import { nodeToPngBlob, shareImageBlob } from '@/utils/shareImage'
import { isValidRequiredAmount, normalizeRequiredAmount } from '@/utils/amounts'
import { buildRoastPayload } from '@/utils/payloadRoast'
import {
  getEventsForPeriod,
  getMonthKey,
  getMonthOptions,
  getTimelineStart,
  periodTypes,
} from '@/utils/timePeriods'

const crimesStore = useCrimesStore()
const preventedStore = usePreventedCrimesStore()
const settingsStore = useSettingsStore()
const aiCreditsStore = useAiCreditsStore()
const $q = useQuasar()

const editDialog = ref(false)
const roastDialog = ref(false)
const confirmDialog = ref(false)
const confirmDialogOptions = ref({
  title: '',
  message: '',
  confirmLabel: '',
  confirmColor: 'negative',
  confirmTextColor: undefined,
})
let confirmedAction = null
const editingCrime = ref(null)
const roastCrime = ref(null)
const remoteRoastQuote = ref('')
const isLoadingRoastQuote = ref(false)
const selectedCriminalCardImage = ref(criminalCardImage)
const criminalShareCard = ref(null)
const isSharingRoast = ref(false)
const editCategoryId = ref('')
const editTitle = ref('')
const editAmount = ref('')
const editRecurrence = ref(null)
const editOccurredAt = ref('')
const editNotes = ref('')
const isSavingEdit = ref(false)
const selectedDateMode = ref('month')
const selectedMonth = ref(getMonthKey(new Date()))
const selectedYear = ref(new Date().getFullYear())
let roastRequestSequence = 0

const recurrenceEditOptions = [
  { label: 'Once', value: null },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Yearly', value: 'yearly' },
]

const currency = computed(() => settingsStore.currency)
const currencySymbol = computed(() => getCurrencySymbol(currency.value))
const isEditingPreventedCrime = computed(() => editingCrime.value?.eventType === 'prevented')
const hasValidEditAmount = computed(() => isValidRequiredAmount(editAmount.value))
const categoryOptions = computed(() =>
  crimeCategories.map((category) => ({
    label: `${category.emoji} ${category.label}`,
    value: category.id,
  })),
)
const archiveEvents = computed(() => [...crimesStore.crimes, ...preventedStore.preventedCrimes])
const selectedPeriod = computed(() =>
  selectedDateMode.value === 'month'
    ? selectedMonth.value === getMonthKey(new Date())
      ? { type: periodTypes.MONTH_TO_DATE }
      : monthPeriod(selectedMonth.value)
    : selectedYear.value === new Date().getFullYear()
      ? { type: periodTypes.YEAR_TO_DATE }
      : { type: periodTypes.YEAR, year: selectedYear.value },
)
const monthOptions = computed(() => getMonthOptions(archiveEvents.value))
const yearOptions = computed(() => {
  const firstYear = getTimelineStart(archiveEvents.value).getFullYear()
  const currentYear = new Date().getFullYear()
  const options = []

  for (let year = currentYear; year >= firstYear; year -= 1) {
    options.push({ label: String(year), value: year })
  }

  return options
})
// Record expands subscriptions only for the selected visible date range.
const filteredArchiveEvents = computed(
  () => getEventsForPeriod(archiveEvents.value, selectedPeriod.value).events,
)
const filteredCrimes = computed(() =>
  filteredArchiveEvents.value.filter((event) => event.eventType !== 'prevented'),
)
const filteredPreventedCrimes = computed(() =>
  filteredArchiveEvents.value.filter((event) => event.eventType === 'prevented'),
)
const filteredDamageTotal = computed(() => sumAmounts(filteredCrimes.value))
const filteredPreventedDamageTotal = computed(() => sumAmounts(filteredPreventedCrimes.value))
const categoryGroups = computed(() => buildCategoryGroups(filteredArchiveEvents.value))
const roastCategory = computed(() =>
  crimeCategories.find((category) => category.id === roastCrime.value?.categoryId),
)
const roastCategoryLabel = computed(() =>
  (roastCategory.value?.label || roastCrime.value?.categoryId || 'Unknown').toUpperCase(),
)
const roastDate = computed(() => {
  if (!roastCrime.value) return ''

  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
    .format(new Date(eventDate(roastCrime.value)))
    .toUpperCase()
})
const roastAmountLabel = computed(() => {
  if (!roastCrime.value) return ''
  if (roastCrime.value.amount == null) return 'DAMAGES PENDING'

  const amountWithOneDecimal = Math.trunc(Number(roastCrime.value.amount) * 10) / 10

  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency: currency.value,
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(amountWithOneDecimal)
})
const roastCaseNumber = computed(() => {
  if (!roastCrime.value) return ''

  const date = new Date(eventDate(roastCrime.value))
  const datePart = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('')
  const idPart = String(roastCrime.value.id || '')
    .replace(/[^a-z0-9]/gi, '')
    .slice(-4)
    .padStart(4, '0')
    .toUpperCase()

  return `${datePart}-${idPart}`
})
const roastQuote = computed(() => {
  if (!roastCrime.value) return ''
  if (isLoadingRoastQuote.value) return ''

  return remoteRoastQuote.value || getFallbackRoastQuote(roastCrime.value)
})
const roastShareTitle = computed(() =>
  roastCrime.value
    ? `Financial Crimes roast: ${roastCrime.value.title || roastCrime.value.crimeName}`
    : 'Financial Crimes roast',
)
const roastShareText = computed(() => {
  if (!roastCrime.value) return ''

  return [
    `${roastAmountLabel.value} ${roastCrime.value.title || roastCrime.value.crimeName}`,
    roastCategoryLabel.value,
    `"${roastQuote.value}"`,
  ].join('\n')
})
const roastShareImageName = computed(() => `financial-crimes-roast-${roastCaseNumber.value}.png`)
const roastShareData = computed(() => ({
  backgroundAsset: selectedCriminalCardImage.value,
  caseNumber: roastCaseNumber.value,
  dateLabel: roastDate.value,
  categoryLabel: roastCategoryLabel.value,
  amountLabel: roastAmountLabel.value,
  title: roastCrime.value?.title || roastCrime.value?.crimeName || '',
  quote: roastQuote.value,
}))

function openEdit(crime) {
  editingCrime.value = crime
  editCategoryId.value = crime.categoryId || ''
  editTitle.value = crime.title || crime.crimeName || ''
  editAmount.value = crime.amount ?? ''
  editRecurrence.value = crime.recurrence || null
  editOccurredAt.value = formatDateInput(crime.occurredAt || crime.createdAt)
  editNotes.value = crime.notes || ''
  editDialog.value = true
}

function openRoast(crime) {
  const requestSequence = ++roastRequestSequence
  const useAiExperience = settingsStore.settings.aiTextEnabled !== false

  roastCrime.value = crime
  remoteRoastQuote.value = ''
  selectedCriminalCardImage.value = criminalCardImage
  isLoadingRoastQuote.value = true
  roastDialog.value = true

  const quotePromise = useAiExperience
    ? requestRemoteRoast(crime)
    : Promise.resolve({ quote: '', didUseAi: false })
  const assetPromise = useAiExperience ? getCrimeAsset(crime.categoryId) : null

  trackRoastClick(crime)
  loadRoastQuote(crime, quotePromise, assetPromise, requestSequence)
}

function trackRoastClick(crime) {
  // Keep analytics payloads behavioral and non-sensitive; titles and notes stay local.
  logAnalyticsEvent('roast_clicked', {
    category_id: crime.categoryId || 'unknown',
    has_amount: crime.amount == null ? 0 : 1,
    is_virtual_occurrence: crime.isVirtualOccurrence ? 1 : 0,
    date_mode: selectedDateMode.value,
  })
}

async function loadRoastQuote(crime, quotePromise, assetPromise, requestSequence) {
  const generation = await quotePromise

  if (roastCrime.value?.id !== crime.id || requestSequence !== roastRequestSequence) {
    logRoastDevelopment('=== ROAST RESPONSE IGNORED ===', {
      crimeId: crime.id,
      category: crime.categoryId,
      currentlySelectedCrimeId: roastCrime.value?.id,
      currentlySelectedCategory: roastCrime.value?.categoryId,
      requestSequence,
      activeRequestSequence: roastRequestSequence,
    })
    return
  }

  const resolvedAsset = generation.didUseAi ? await assetPromise : criminalCardImage

  if (roastCrime.value?.id === crime.id && requestSequence === roastRequestSequence) {
    remoteRoastQuote.value = generation.quote
    selectedCriminalCardImage.value = resolvedAsset
    isLoadingRoastQuote.value = false
    logRoastDevelopment('=== ROAST APPLIED ===', {
      crimeId: crime.id,
      category: crime.categoryId,
      currentlySelectedCrimeId: roastCrime.value?.id,
      currentlySelectedCategory: roastCrime.value?.categoryId,
      roast: generation.quote,
    })
  }
}

async function requestRemoteRoast(crime) {
  const balanceRequestSequence = aiCreditsStore.beginBalanceRequest()

  try {
    const payload = {
      ...buildRoastPayload({
        crime,
        crimes: crimesStore.crimes,
        settings: settingsStore.settings,
        currency: currency.value,
      }),
      context: {
        currency: currency.value,
        dateMode: selectedDateMode.value,
        courtStrictness: settingsStore.settings.courtStrictness,
      },
    }
    logRoastDevelopment('=== ROAST REQUEST CLIENT ===', {
      crimeId: crime.id,
      categoryId: crime.categoryId,
      category: payload.event.category,
      amount: payload.event.amount,
      notes: payload.event.user_notes,
      event: payload.event,
      record: payload.record,
      context: payload.context,
    })

    const result = await callRoast(payload)
    const quote = getCallableQuote(result)
    logRoastDevelopment('=== ROAST RESPONSE CLIENT ===', {
      crimeId: crime.id,
      categoryId: crime.categoryId,
      category: payload.event.category,
      roast: quote,
    })

    aiCreditsStore.applyServerBalance(result, balanceRequestSequence)
    logAnalyticsEvent('ai_credit_consumed', {
      generation_type: 'roast',
      credits_remaining: result.creditsRemaining,
    })
    return { quote, didUseAi: Boolean(quote) }
  } catch (error) {
    if (isAiCreditsExhaustedError(error)) {
      aiCreditsStore.markExhausted(balanceRequestSequence)
      aiCreditsStore.openPurchaseDialog()
      logAnalyticsEvent('ai_credits_exhausted', { generation_type: 'roast' })
      $q.notify({
        type: 'warning',
        icon: matLocalFireDepartment,
        message: 'COURT-APPOINTED COMEDIAN EXHAUSTED',
        caption: 'You have no AI Crimes left. The local roast is still available.',
      })
    }
    return { quote: '', didUseAi: false }
  }
}

function logRoastDevelopment(label, details) {
  if (!import.meta.env.DEV) return

  console.info(label, details)
}

function getCallableQuote(result) {
  return typeof result?.quote === 'string' ? result.quote.trim() : ''
}

function getFallbackRoastQuote(crime) {
  if (crime.amount == null) return 'A mystery charge with commitment issues.'

  return 'Same mistakes, brighter you.'
}

function buildCategoryGroups(events) {
  return crimeCategories
    .map((category) => {
      const crimes = events.filter((crime) => crime.categoryId === category.id)
      const committedCrimes = crimes.filter((crime) => crime.eventType !== 'prevented')
      const preventedCrimes = crimes.filter((crime) => crime.eventType === 'prevented')

      return {
        category,
        crimes,
        count: crimes.length,
        preventedCount: preventedCrimes.length,
        pendingCount: committedCrimes.filter((crime) => crime.status === 'pendingAmount').length,
        total: sumAmounts(committedCrimes),
        preventedTotal: sumAmounts(preventedCrimes),
      }
    })
    .filter((group) => group.count > 0)
    .sort((a, b) => b.total - a.total || b.preventedTotal - a.preventedTotal || b.count - a.count)
}

function monthPeriod(monthKey) {
  const [year, month] = monthKey.split('-').map(Number)
  return { type: periodTypes.MONTH, year, monthIndex: month - 1 }
}

function applyMonth(monthKey) {
  if (!monthKey) return

  const [year] = monthKey.split('-').map(Number)
  selectedDateMode.value = 'month'
  selectedMonth.value = monthKey
  selectedYear.value = year
}

function applyYear(year) {
  if (!year) return

  selectedDateMode.value = 'year'
  selectedYear.value = year
}

async function saveEdit() {
  if (isSavingEdit.value || !editingCrime.value || !hasValidEditAmount.value) return

  const persistedEventId = getPersistedEventId(editingCrime.value)
  const occurredAt = mergeDateInputWithEventTime(
    editOccurredAt.value,
    editingCrime.value.occurredAt || editingCrime.value.createdAt,
  )
  const amount = normalizeRequiredAmount(editAmount.value)

  isSavingEdit.value = true
  try {
    if (isEditingPreventedCrime.value) {
      const category = crimeCategories.find((item) => item.id === editCategoryId.value)

      await preventedStore.updatePreventedCrime(persistedEventId, {
        categoryId: editCategoryId.value,
        title: editTitle.value || category?.label || 'Crime Prevented',
        amount,
        occurredAt,
        notes: editNotes.value,
      })

      editDialog.value = false
      return
    }

    const amountChanged = amount !== Number(editingCrime.value.amount)
    const occurredAtChanged =
      editOccurredAt.value !== formatDateInput(editingCrime.value.occurredAt)
    const isActiveSubscription =
      editingCrime.value.categoryId === 'subscriptions' &&
      editingCrime.value.recurrence &&
      !editingCrime.value.recurrenceEndAt

    const changes = {
      amount,
      occurredAt,
      notes: editNotes.value,
    }

    // Recurrence editing in Record is treated as correcting the saved source event.
    if (editingCrime.value.categoryId === 'subscriptions') {
      changes.recurrence = editRecurrence.value
    }

    if (isActiveSubscription && amountChanged) {
      await crimesStore.replaceActiveSubscriptionTerms(persistedEventId, {
        ...changes,
        occurredAt: occurredAtChanged ? occurredAt : new Date().toISOString(),
      })
    } else {
      await crimesStore.updateCrime(persistedEventId, changes)
    }

    editDialog.value = false
  } catch {
    $q.notify({
      type: 'negative',
      message: isEditingPreventedCrime.value
        ? 'Unable to update this prevented crime.'
        : 'Unable to update this case file.',
    })
  } finally {
    isSavingEdit.value = false
  }
}

async function confirmDelete(crime) {
  const persistedEventId = getPersistedEventId(crime)

  openConfirmDialog({
    title: 'Destroy evidence?',
    message: 'This case file will be permanently deleted from this device.',
    confirmLabel: 'Delete',
    confirmColor: 'negative',
    action: async () => {
      try {
        if (crime.eventType === 'prevented') {
          await preventedStore.deletePreventedCrime(persistedEventId)
        } else {
          await crimesStore.deleteCrime(persistedEventId)
        }
      } catch {
        $q.notify({ type: 'negative', message: 'Unable to delete this case file.' })
      }
    },
  })
}

async function confirmCancelSubscription(crime) {
  const persistedEventId = getPersistedEventId(crime)

  openConfirmDialog({
    title: 'Cancel plan?',
    message: 'This subscription will stop generating future case files from today.',
    confirmLabel: 'Cancel plan',
    confirmColor: 'warning',
    confirmTextColor: 'black',
    action: async () => {
      try {
        await crimesStore.cancelSubscription(persistedEventId)
      } catch {
        $q.notify({ type: 'negative', message: 'Unable to cancel this subscription.' })
      }
    },
  })
}

function openConfirmDialog({ action, ...options }) {
  confirmDialogOptions.value = options
  confirmedAction = action
  confirmDialog.value = true
}

function runConfirmedAction() {
  const action = confirmedAction
  confirmedAction = null
  action?.()
}

async function shareRoast() {
  if (!roastCrime.value || isSharingRoast.value || isLoadingRoastQuote.value || !roastQuote.value) {
    return
  }

  isSharingRoast.value = true
  try {
    const blob = await createCriminalCardImageBlob()
    const result = await shareImageBlob({
      blob,
      fileName: roastShareImageName.value,
      title: roastShareTitle.value,
      text: roastShareText.value,
    })

    if (result === 'copied') {
      $q.notify({ type: 'positive', message: 'Roast image copied to clipboard.' })
    } else if (result === 'downloaded') {
      $q.notify({ type: 'positive', message: 'Roast image downloaded.' })
    }
  } catch (error) {
    if (error?.name === 'AbortError') return

    $q.notify({ type: 'negative', message: 'Unable to share this roast image.' })
  } finally {
    isSharingRoast.value = false
  }
}

function createCriminalCardImageBlob() {
  return nodeToPngBlob(criminalShareCard.value?.$el)
}
</script>
