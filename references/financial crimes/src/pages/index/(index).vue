<template>
  <q-page class="page page--home">
    <header class="screen-header">
      <div>
        <div class="app-title">FINANCIAL CRIMES</div>
        <div class="status-line">
          <span>{{ status.icon }}</span>
          <span>{{ status.label }}</span>
        </div>
      </div>
    </header>

    <section class="panel allowance-panel">
      <div class="panel-label">MONTHLY CRIME ALLOWANCE</div>
      <div class="allowance-summary">
        <div>
          <span>Spent</span>
          <strong>{{ formatMoney(monthlyDamage, currency) }}</strong>
        </div>
        <div>
          <span>Allowance</span>
          <strong>{{ allowance ? formatMoney(allowance, currency) : 'Not set' }}</strong>
        </div>
      </div>
      <q-linear-progress
        v-if="allowance"
        class="q-mt-sm"
        rounded
        size="10px"
        :value="Math.min(monthlyDamage / allowance, 1)"
        :color="monthlyDamage > allowance ? 'negative' : 'warning'"
      />
      <div class="allowance-copy">
        <template v-if="!allowance">
          Set a monthly allowance in Settings to keep the court calibrated.
        </template>
        <template v-else-if="monthlyDamage <= allowance">
          {{ formatMoney(allowance - monthlyDamage, currency) }} before the court gets concerned.
        </template>
        <template v-else>🚨 CRIME ALLOWANCE EXCEEDED</template>
      </div>
      <div class="allowance-meta">
        <span>{{ monthlyItems.length }} crimes this month</span>
        <span v-if="pendingCount">{{ pendingCount }} unreported damages</span>
      </div>
    </section>

    <section v-if="pendingCount" class="pending-banner">
      <div>
        <strong>{{ pendingCount }} CASE FILES INCOMPLETE</strong>
        <span>The paperwork department is watching.</span>
      </div>
      <q-btn
        color="warning"
        text-color="black"
        unelevated
        no-caps
        label="COMPLETE"
        @click="pendingDialog = true"
      />
    </section>

    <section class="quick-crimes">
      <div class="section-heading">REPORT A FINANCIAL CRIME</div>
      <div class="quick-grid">
        <CrimeQuickButton
          v-for="category in quickCategories"
          :key="category.id"
          :category="category"
          @select="openAmountSelector"
        />
      </div>
    </section>

    <section class="prevented-entry">
      <q-btn
        class="full-width"
        outline
        color="positive"
        icon="shield"
        no-caps
        label="I ALMOST COMMITTED A CRIME"
        @click="preventedDialog = true"
      />
    </section>

    <q-banner v-if="bannerMessage" class="verdict-banner">{{ bannerMessage }}</q-banner>

    <CrimeAmountSelector
      v-model="amountDialog"
      :category="selectedCategory"
      :currency="currency"
      @amount="reportSelectedCrime"
      @later="reportSelectedCrime(null)"
    />

    <SubscriptionFlowSelector
      v-model="subscriptionDialog"
      :currency="currency"
      :saving="isSavingSubscription"
      @subscription="reportSubscription"
    />

    <q-dialog v-model="pendingDialog" maximized>
      <q-card class="case-files-dialog">
        <q-card-section class="dialog-header">
          <div>
            <div class="section-kicker">CASE FILES</div>
            <h2>Complete Case Files</h2>
          </div>
          <q-btn v-close-popup flat round icon="close" />
        </q-card-section>

        <q-card-section v-if="activePendingCrime" class="pending-case">
          <div class="pending-case__emoji">
            {{ getCategory(activePendingCrime.categoryId).emoji }}
          </div>
          <h3>{{ activePendingCrime.title || activePendingCrime.crimeName }}</h3>
          <p>{{ relativeCrimeDate(activePendingCrime.createdAt) }}</p>
          <div class="section-heading">DAMAGES</div>
          <div class="amount-grid">
            <q-btn
              v-for="amount in getCategory(activePendingCrime.categoryId).quickAmounts"
              :key="amount"
              class="amount-choice"
              unelevated
              no-caps
              :label="formatMoney(amount, currency)"
              :disable="isSavingPending"
              @click="completePending(amount)"
            />
            <q-btn
              class="amount-choice"
              unelevated
              no-caps
              label="OTHER"
              :disable="isSavingPending"
              @click="showPendingOther = true"
            />
            <q-btn
              class="amount-choice amount-choice--later"
              unelevated
              no-caps
              label="SKIP"
              :disable="isSavingPending"
              @click="nextPending"
            />
          </div>

          <q-slide-transition>
            <div v-if="showPendingOther" class="other-amount">
              <q-input
                v-model="pendingCustomAmount"
                autofocus
                dark
                dense
                :prefix="currencySymbol"
                type="number"
                min="0.01"
              />
              <q-btn
                class="other-amount__button"
                color="warning"
                text-color="black"
                unelevated
                no-caps
                label="UPDATE"
                :loading="isSavingPending"
                :disable="isSavingPending || !isValidRequiredAmount(pendingCustomAmount)"
                @click="completePending(pendingCustomAmount)"
              />
            </div>
          </q-slide-transition>
        </q-card-section>

        <q-card-section v-else>
          <EmptyState title="ALL CASE FILES COMPLETE" text="The paperwork department is shocked." />
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="preventedDialog">
      <q-card class="edit-dialog prevented-dialog">
        <q-card-section class="dialog-header">
          <div>
            <div class="section-kicker">REHABILITATION</div>
            <h2>Crime Prevented</h2>
          </div>
          <q-btn v-close-popup flat round dense color="white" icon="close" aria-label="Close" />
        </q-card-section>
        <q-card-section class="q-gutter-md">
          <q-select
            v-model="preventedCategoryId"
            dark
            emit-value
            map-options
            :options="categoryOptions"
            label="Category"
          />
          <q-input
            v-model="preventedAmount"
            dark
            label="Potential damage"
            :prefix="currencySymbol"
            type="number"
            min="0.01"
          />
          <q-input v-model="preventedTitle" dark label="Description" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn v-close-popup flat no-caps label="Cancel" />
          <q-btn
            color="positive"
            unelevated
            no-caps
            label="PREVENT"
            :loading="isSavingPrevented"
            :disable="
              isSavingPrevented || !preventedCategoryId || !isValidRequiredAmount(preventedAmount)
            "
            @click="savePreventedCrime"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import CrimeAmountSelector from '@/components/CrimeAmountSelector.vue'
import CrimeQuickButton from '@/components/CrimeQuickButton.vue'
import EmptyState from '@/components/EmptyState.vue'
import SubscriptionFlowSelector from '@/components/SubscriptionFlowSelector.vue'
import { getCurrencySymbol } from '@/config/currencies'
import { crimeCategories, getCategory } from '@/config/crimeCategories'
import { useAchievementsStore } from '@/stores/achievementsStore'
import { useCrimesStore } from '@/stores/crimesStore'
import { usePreventedCrimesStore } from '@/stores/preventedCrimesStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { relativeCrimeDate } from '@/utils/dateGroups'
import { formatMoney, getCitizenStatus, monthlyCrimes, sumAmounts } from '@/utils/crimeStats'
import { isValidRequiredAmount, normalizeRequiredAmount } from '@/utils/amounts'

const settingsStore = useSettingsStore()
const crimesStore = useCrimesStore()
const preventedStore = usePreventedCrimesStore()
const achievementsStore = useAchievementsStore()
const $q = useQuasar()

const amountDialog = ref(false)
const subscriptionDialog = ref(false)
const selectedCategory = ref(null)
const bannerMessage = ref('')
const pendingDialog = ref(false)
const pendingIndex = ref(0)
const showPendingOther = ref(false)
const pendingCustomAmount = ref('')
const preventedDialog = ref(false)
const preventedCategoryId = ref('tech')
const preventedAmount = ref('')
const preventedTitle = ref('')
const isSavingSubscription = ref(false)
const isSavingPending = ref(false)
const isSavingPrevented = ref(false)

// Home dashboard uses effective monthly events, including virtual subscription charges.
const currency = computed(() => settingsStore.currency)
const currencySymbol = computed(() => getCurrencySymbol(currency.value))
const allowance = computed(() => Number(settingsStore.settings.monthlyCrimeAllowance) || null)
const monthlyItems = computed(() => monthlyCrimes(crimesStore.crimes))
const monthlyDamage = computed(() => sumAmounts(monthlyItems.value))
const pendingCount = computed(() => crimesStore.pendingCrimes.length)
const status = computed(() => getCitizenStatus(crimesStore.crimes))
const quickCategories = computed(() =>
  crimeCategories.filter((category) => settingsStore.selectedCategories.includes(category.id)),
)
const activePendingCrime = computed(() => crimesStore.pendingCrimes[pendingIndex.value])
const categoryOptions = computed(() =>
  crimeCategories.map((category) => ({
    label: `${category.emoji} ${category.label}`,
    value: category.id,
  })),
)

watch(activePendingCrime, () => {
  showPendingOther.value = false
  pendingCustomAmount.value = ''
})

function openAmountSelector(category) {
  selectedCategory.value = category
  if (category.id === 'subscriptions') {
    subscriptionDialog.value = true
    return
  }

  amountDialog.value = true
}

async function reportSelectedCrime(amount) {
  if (!selectedCategory.value) return

  try {
    await crimesStore.reportCrime(selectedCategory.value.id, amount)
    await processImmediateBadges()
    bannerMessage.value = amount == null ? 'CRIME REPORTED. DAMAGES PENDING.' : getVerdict()
    window.setTimeout(() => {
      bannerMessage.value = ''
    }, 1100)
  } catch {
    $q.notify({ type: 'negative', message: 'Unable to report this crime.' })
  }
}

async function reportSubscription(payload) {
  if (isSavingSubscription.value) return

  isSavingSubscription.value = true
  try {
    await crimesStore.reportSubscriptionCrime(payload)
    await processImmediateBadges()
    bannerMessage.value = getVerdict()
    subscriptionDialog.value = false
    window.setTimeout(() => {
      bannerMessage.value = ''
    }, 1100)
  } catch {
    $q.notify({ type: 'negative', message: 'Unable to save this subscription.' })
  } finally {
    isSavingSubscription.value = false
  }
}

function getVerdict() {
  const strictness = settingsStore.settings.courtStrictness
  if (strictness === 'chill') return 'GUILTY, BUT THE COURT IS FEELING GENEROUS.'
  if (strictness === 'ruthless') return 'GUILTY. NO MERCY FROM THE BENCH.'
  return 'GUILTY.'
}

async function completePending(amount) {
  if (!activePendingCrime.value || isSavingPending.value || !isValidRequiredAmount(amount)) return

  isSavingPending.value = true
  try {
    await crimesStore.updateCrime(activePendingCrime.value.id, {
      amount: normalizeRequiredAmount(amount),
    })
    await processImmediateBadges()
    nextPending()
  } catch {
    $q.notify({ type: 'negative', message: 'Unable to update this case file.' })
  } finally {
    isSavingPending.value = false
  }
}

function nextPending() {
  showPendingOther.value = false
  pendingCustomAmount.value = ''

  if (pendingIndex.value >= crimesStore.pendingCrimes.length - 1) {
    pendingIndex.value = 0
    if (crimesStore.pendingCrimes.length === 0) {
      bannerMessage.value = 'CASE FILES UPDATED. The court appreciates your cooperation.'
      pendingDialog.value = false
    }
    return
  }

  pendingIndex.value += 1
}

async function savePreventedCrime() {
  if (isSavingPrevented.value || !isValidRequiredAmount(preventedAmount.value)) return

  const category = getCategory(preventedCategoryId.value)
  const amount = normalizeRequiredAmount(preventedAmount.value)

  isSavingPrevented.value = true
  try {
    await preventedStore.addPreventedCrime({
      categoryId: category.id,
      title: preventedTitle.value || category.label,
      amount,
    })
    await processImmediateBadges()

    bannerMessage.value = `${formatMoney(amount, currency.value)} saved from potential financial misconduct.`
    preventedDialog.value = false
    preventedAmount.value = ''
    preventedTitle.value = ''

    window.setTimeout(() => {
      bannerMessage.value = ''
    }, 1800)
  } catch {
    $q.notify({ type: 'negative', message: 'Unable to save this prevented crime.' })
  } finally {
    isSavingPrevented.value = false
  }
}

async function processImmediateBadges() {
  try {
    await achievementsStore.processImmediate({
      crimes: crimesStore.crimes,
      preventedCrimes: preventedStore.preventedCrimes,
      settings: settingsStore.settings,
    })
  } catch {
    // Badge processing is a secondary reward path. Recording the crime already succeeded,
    // so avoid interrupting the user with a toast if local badge persistence is unavailable.
  }
}
</script>
