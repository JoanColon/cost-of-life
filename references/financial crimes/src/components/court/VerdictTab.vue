<template>
  <section class="monthly-verdict">
    <h1>{{ verdictHeading }}</h1>
    <p>It's time to face the jury.</p>
    <p>Have you been a good citizen... or a repeat offender?</p>

    <q-btn
      class="face-jury-button"
      color="warning"
      text-color="black"
      unelevated
      no-caps
      icon="gavel"
      :label="verdictResult ? 'VERDICT DELIVERED' : 'FACE THE JURY'"
      :disable="isDeliberating"
      @click="$emit('face-jury')"
    />

    <q-slide-transition>
      <div v-if="isDeliberating" class="deliberation-box">
        <div class="deliberation-box__label">{{ deliberationStep }}</div>
        <q-linear-progress indeterminate rounded color="warning" />
      </div>
    </q-slide-transition>

    <q-dialog
      v-model="verdictDialog"
      class="verdict-dialog-shell"
      @hide="$emit('verdict-dismissed')"
    >
      <q-card class="verdict-dialog" :style="{ '--verdict-accent': verdictPresentation.color }">
        <div
          ref="verdictPosterFrame"
          class="verdict-poster-frame"
          :style="{
            backgroundImage: `url(${verdictPresentation.image})`,
          }"
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

          <q-card-section v-if="verdictResult" class="verdict-poster">
            <div class="verdict-poster__stats">
              <div class="verdict-poster__stat">
                <q-icon :name="matReceiptLong" />
                <strong>{{ stats.crimesCommitted }}</strong>
                <span>Crimes<br />Committed</span>
              </div>
              <div class="verdict-poster__stat">
                <q-icon :name="matPaid" />
                <strong>{{ formatMoney(stats.totalDamages, currency) }}</strong>
                <span>Total<br />Damages</span>
              </div>
              <div class="verdict-poster__stat">
                <q-icon :name="matTrendingUp" />
                <strong>{{ overBudgetLabel }}</strong>
                <span>{{ budgetStatusLabelParts[0] }}<br />{{ budgetStatusLabelParts[1] }}</span>
              </div>
            </div>

            <div class="verdict-poster__verdict-card">
              <q-icon :name="matGavel" />
              <div>
                <span>Verdict - {{ periodMonth }}</span>
                <strong>{{ verdictQuote }}</strong>
              </div>
            </div>
          </q-card-section>
        </div>

        <q-inner-loading :showing="isSharingVerdict" dark label="Generating verdict..." />

        <q-card-actions class="verdict-dialog__actions">
          <q-btn
            class="verdict-share-button"
            text-color="white"
            unelevated
            no-caps
            icon="ios_share"
            :loading="isSharingVerdict"
            :disable="isSharingVerdict"
            :label="isSharingVerdict ? 'GENERATING...' : 'SHARE VERDICT'"
            @click="shareVerdict"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <div class="share-export-host" aria-hidden="true">
      <VerdictShareCard v-if="verdictResult" ref="verdictShareCard" v-bind="verdictShareData" />
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { matGavel, matPaid, matReceiptLong, matTrendingUp } from '@quasar/extras/material-icons'
import { useQuasar } from 'quasar'
import guiltyImage from '@/assets/verdict/Guilty_1.webp'
import notGuiltyImage from '@/assets/verdict/NotGuilty_1.webp'
import probationImage from '@/assets/verdict/Probation_1.webp'
import VerdictShareCard from '@/components/court/VerdictShareCard.vue'
import { formatMoney } from '@/utils/crimeStats'
import { nodeToPngBlob, shareImageBlob } from '@/utils/shareImage'

defineEmits(['face-jury', 'verdict-dismissed'])

const $q = useQuasar()
const verdictDialog = ref(false)
const verdictPosterFrame = ref(null)
const verdictShareCard = ref(null)
const isSharingVerdict = ref(false)
const fallbackStatus = 'probation'
const verdictPresentations = {
  guilty: {
    image: guiltyImage,
    color: '#ff363b',
  },
  probation: {
    image: probationImage,
    color: '#ffd13d',
  },
  'not-guilty': {
    image: notGuiltyImage,
    color: '#39d98a',
  },
}

const props = defineProps({
  stats: {
    type: Object,
    required: true,
  },
  currency: {
    type: String,
    required: true,
  },
  periodMonth: {
    type: String,
    required: true,
  },
  verdictHeading: {
    type: String,
    default: 'MONTHLY VERDICT',
  },
  verdictResult: {
    type: Object,
    default: null,
  },
  isDeliberating: {
    type: Boolean,
    required: true,
  },
  deliberationStep: {
    type: String,
    required: true,
  },
  aggravatingCircumstances: {
    type: String,
    required: true,
  },
  mitigatingCircumstances: {
    type: String,
    required: true,
  },
})

const shareTitle = computed(() =>
  props.verdictResult
    ? `Financial Crimes verdict: ${props.verdictResult.title}`
    : 'Financial Crimes verdict',
)
const verdictStatus = computed(() => props.verdictResult?.status || fallbackStatus)
const verdictPresentation = computed(() => {
  const localPresentation =
    verdictPresentations[verdictStatus.value] || verdictPresentations[fallbackStatus]

  return {
    ...localPresentation,
    image: props.verdictResult?.visualAsset || localPresentation.image,
  }
})
const verdictQuote = computed(() => props.verdictResult?.quote || '')
const overBudgetLabel = computed(() => {
  if (!props.stats.allowance || props.stats.allowanceConsumed == null) return '0%'

  const percent = Math.round((props.stats.allowanceConsumed - 1) * 100)
  if (percent > 0) return `+${percent}%`
  return `${percent}%`
})
const budgetStatusLabel = computed(() => {
  if (!props.stats.allowance || props.stats.allowanceConsumed == null) return 'Over Budget'
  if (props.stats.allowanceConsumed > 1.1) return 'Over Budget'
  if (props.stats.allowanceConsumed < 0.9) return 'Under Budget'
  return 'Near Budget'
})
const budgetStatusLabelParts = computed(() => budgetStatusLabel.value.split(' '))
const shareText = computed(() => {
  if (!props.verdictResult) return ''

  const mostWanted = props.stats.mostWantedCategory
    ? `Most serious offense: ${
        props.stats.mostWantedCategory.crimeName || props.stats.mostWantedCategory.label
      }`
    : ''

  return [
    `${props.periodMonth}: ${props.verdictResult.title}`,
    `${props.stats.crimesCommitted} crimes · ${formatMoney(
      props.stats.totalDamages,
      props.currency,
    )} total damages`,
    mostWanted,
    `"${verdictQuote.value}"`,
  ]
    .filter(Boolean)
    .join('\n')
})
const pngShareImageName = computed(() => `financial-crimes-${verdictStatus.value}.png`)
const verdictShareData = computed(() => ({
  backgroundAsset: verdictPresentation.value.image,
  accentColor: verdictPresentation.value.color,
  quote: verdictQuote.value,
  monthLabel: props.periodMonth,
  crimesCommitted: props.stats.crimesCommitted,
  totalDamagesLabel: formatMoney(props.stats.totalDamages, props.currency),
  budgetDeltaLabel: overBudgetLabel.value,
  budgetStatusLabel: budgetStatusLabel.value.toUpperCase(),
}))

watch(
  () => props.verdictResult,
  (result) => {
    if (result) verdictDialog.value = true
  },
)

async function shareVerdict() {
  if (!props.verdictResult || isSharingVerdict.value) return

  isSharingVerdict.value = true
  try {
    const blob = await createVerdictImageBlob()
    const result = await shareImageBlob({
      blob,
      fileName: pngShareImageName.value,
      title: shareTitle.value,
      text: shareText.value,
    })

    if (result === 'copied') {
      $q.notify({ type: 'positive', message: 'Verdict image copied to clipboard.' })
    } else if (result === 'downloaded') {
      $q.notify({ type: 'positive', message: 'Verdict image downloaded.' })
    }
  } catch (error) {
    if (error?.name === 'AbortError') return

    $q.notify({ type: 'negative', message: 'Unable to share this verdict image.' })
  } finally {
    isSharingVerdict.value = false
  }
}

function createVerdictImageBlob() {
  return nodeToPngBlob(verdictShareCard.value?.$el)
}
</script>
