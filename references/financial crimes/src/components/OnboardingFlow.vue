<template>
  <q-page class="onboarding-page">
    <section v-if="step === 0" class="onboarding-panel">
      <div class="brand-stamp">CASE FILE 001</div>
      <h1>FINANCIAL CRIMES</h1>
      <p>Your money has rights.<br />You violated them.</p>
      <q-btn
        class="full-width q-mt-xl"
        color="warning"
        text-color="black"
        size="lg"
        unelevated
        no-caps
        label="START COURT"
        @click="step = 1"
      />
    </section>

    <section v-else-if="step === 1" class="onboarding-panel">
      <div class="onboarding-kicker-row">
        <div>
          <div class="onboarding-step">STEP 1/3</div>
          <div class="section-kicker">WEAKNESSES</div>
        </div>
        <q-btn
          class="onboarding-info-button"
          flat
          round
          color="warning"
          icon="info"
          aria-label="More information about expense categories"
          @click="openInfo('categories')"
        />
      </div>
      <h2>What usually gets you into trouble?</h2>
      <div class="category-grid">
        <button
          v-for="category in crimeCategories"
          :key="category.id"
          class="category-choice"
          :class="{ 'category-choice--selected': selectedCategories.includes(category.id) }"
          type="button"
          @click="toggleCategory(category.id)"
        >
          <span>{{ category.emoji }}</span>
          <strong>{{ category.label }}</strong>
        </button>
      </div>
      <q-btn
        class="full-width q-mt-lg"
        color="warning"
        text-color="black"
        unelevated
        no-caps
        label="CONTINUE"
        :disable="selectedCategories.length === 0"
        @click="step = 2"
      />
    </section>

    <section v-else-if="step === 2" class="onboarding-panel">
      <div class="onboarding-kicker-row">
        <div>
          <div class="onboarding-step">STEP 2/3</div>
          <div class="section-kicker">COURT SETTINGS</div>
        </div>
        <q-btn
          class="onboarding-info-button"
          flat
          round
          color="warning"
          icon="info"
          aria-label="More information about court settings"
          @click="openInfo('court')"
        />
      </div>
      <h2>How harsh should the jury be?</h2>
      <p class="onboarding-copy">This changes the tone of AI roasts and verdicts.</p>
      <q-option-group v-model="courtStrictness" :options="strictnessOptions" color="warning" dark />
      <q-btn
        class="full-width q-mt-lg"
        color="warning"
        text-color="black"
        unelevated
        no-caps
        label="CONTINUE"
        @click="step = 3"
      />
    </section>

    <section v-else class="onboarding-panel">
      <div class="onboarding-kicker-row">
        <div>
          <div class="onboarding-step">STEP 3/3</div>
          <div class="section-kicker">MONTHLY CRIME ALLOWANCE</div>
        </div>
        <q-btn
          class="onboarding-info-button"
          flat
          round
          color="warning"
          icon="info"
          aria-label="More information about monthly allowance"
          @click="openInfo('allowance')"
        />
      </div>
      <h2>How much questionable spending are you willing to tolerate every month?</h2>
      <p class="onboarding-copy">
        Spending consciously is fine. Repeatedly breaking your own rules is questionable.
      </p>
      <q-select
        v-model="currency"
        class="q-mb-md"
        dark
        emit-value
        map-options
        :options="currencyOptions"
        label="Currency"
      />
      <q-input
        v-model="allowance"
        dark
        inputmode="decimal"
        label="Crime allowance"
        :prefix="currencySymbol"
        type="number"
      />
      <q-btn
        class="full-width q-mt-lg"
        color="warning"
        text-color="black"
        unelevated
        no-caps
        label="OPEN CASE"
        :disable="!hasValidAllowance"
        @click="finish"
      />
    </section>

    <q-dialog v-model="infoDialog" position="bottom">
      <q-card v-if="activeInfo" class="onboarding-info-sheet">
        <q-card-section class="onboarding-info-sheet__header">
          <div>
            <div class="section-kicker">CASE NOTES</div>
            <h2>{{ activeInfo.title }}</h2>
          </div>
          <q-btn flat round dense color="white" icon="close" aria-label="Close" v-close-popup />
        </q-card-section>

        <q-card-section class="onboarding-info-sheet__body">
          <p>{{ activeInfo.copy }}</p>
          <p class="onboarding-info-sheet__note">{{ activeInfo.note }}</p>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { crimeCategories, defaultCategoryIds } from '@/config/crimeCategories'
import { currencyOptions, getCurrencySymbol } from '@/config/currencies'
import { useSettingsStore } from '@/stores/settingsStore'
import { normalizeAmount } from '@/services/database'

const settingsStore = useSettingsStore()
const $q = useQuasar()
const router = useRouter()

const step = ref(0)
const selectedCategories = ref([...defaultCategoryIds])
const courtStrictness = ref('reasonable')
const currency = ref('USD')
const allowance = ref('350')
const infoDialog = ref(false)
const activeInfo = ref(null)
const currencySymbol = computed(() => getCurrencySymbol(currency.value))
const hasValidAllowance = computed(() => normalizeAmount(allowance.value) !== null)
const strictnessOptions = [
  { label: 'CHILL', value: 'chill' },
  { label: 'REASONABLE', value: 'reasonable' },
  { label: 'RUTHLESS', value: 'ruthless' },
]
const onboardingInfo = {
  categories: {
    title: 'Expense Categories',
    copy: 'Choose which spending categories appear as quick actions when reporting a crime. They make it faster to file the questionable purchases you want to track.',
    note: 'You can add, remove or change your categories anytime in Settings.',
  },
  allowance: {
    title: 'Monthly Allowance',
    copy: 'Set the monthly spending limit the court will compare against your recorded damages. It helps determine whether your Monthly Verdict is Not Guilty, Probation or Guilty.',
    note: "Your financial situation isn't a life sentence. You can change your monthly allowance and currency anytime in Settings.",
  },
  court: {
    title: 'Court Settings',
    copy: "Choose how sharp the court's language should be: Chill, Reasonable or Ruthless. This changes the tone of AI-generated roasts and verdicts, not whether the verdict is Guilty, Probation or Not Guilty.",
    note: 'You can change the court rules anytime in Settings.',
  },
}

function openInfo(key) {
  activeInfo.value = onboardingInfo[key]
  infoDialog.value = true
}

function toggleCategory(categoryId) {
  if (selectedCategories.value.includes(categoryId)) {
    selectedCategories.value = selectedCategories.value.filter((id) => id !== categoryId)
  } else {
    selectedCategories.value.push(categoryId)
  }
}

async function finish() {
  const monthlyCrimeAllowance = normalizeAmount(allowance.value)
  if (monthlyCrimeAllowance === null) return

  try {
    await settingsStore.completeOnboarding({
      selectedCategories: selectedCategories.value,
      courtStrictness: courtStrictness.value,
      currency: currency.value,
      monthlyCrimeAllowance,
    })
    await router.replace('/')
  } catch {
    $q.notify({ type: 'negative', message: 'Unable to save onboarding settings.' })
  }
}
</script>
