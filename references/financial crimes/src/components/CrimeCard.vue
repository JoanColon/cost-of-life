<template>
  <q-card class="crime-card" :class="{ 'crime-card--prevented': isPreventedCrime }" flat>
    <div class="crime-card__main">
      <div class="crime-card__emoji" aria-hidden="true">{{ recordIcon }}</div>
      <div class="crime-card__body">
        <div class="crime-card__name">{{ crime.title || crime.crimeName }}</div>
        <div class="crime-card__meta">
          {{ relativeCrimeDate(crime.occurredAt || crime.createdAt) }}
        </div>
        <div v-if="subscriptionLabel" class="crime-card__meta">{{ subscriptionLabel }}</div>
        <div v-if="crime.notes" class="crime-card__note">{{ crime.notes }}</div>
      </div>
      <div class="crime-card__amount">
        <span v-if="crime.amount != null">{{ amountLabel }}</span>
        <span v-else>Damage unreported</span>
      </div>
    </div>

    <div class="crime-card__actions">
      <q-btn
        v-if="!isPreventedCrime"
        dense
        flat
        no-caps
        icon="auto_awesome"
        label="Roast"
        @click="$emit('roast', crime)"
      />
      <q-btn
        v-if="!crime.isVirtualOccurrence"
        dense
        flat
        no-caps
        icon="edit"
        label="Edit"
        @click="$emit('edit', crime)"
      />
      <q-btn
        v-if="isActiveSubscription"
        dense
        flat
        no-caps
        icon="event_busy"
        label="Cancel plan"
        @click="$emit('cancel-subscription', crime)"
      />
      <q-btn
        v-if="!crime.isVirtualOccurrence"
        dense
        flat
        no-caps
        icon="delete"
        label="Delete"
        @click="$emit('delete', crime)"
      />
    </div>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'
import { relativeCrimeDate } from '@/utils/dateGroups'
import { formatMoney } from '@/utils/crimeStats'

const props = defineProps({
  crime: {
    type: Object,
    required: true,
  },
  currency: {
    type: String,
    default: 'EUR',
  },
})

defineEmits(['edit', 'delete', 'cancel-subscription', 'roast'])

const isPreventedCrime = computed(() => props.crime.eventType === 'prevented')
const recordIcon = computed(() => (isPreventedCrime.value ? '🍃' : '🚨'))
const amountLabel = computed(() => {
  const amount = formatMoney(props.crime.amount, props.currency)
  return isPreventedCrime.value ? `Saved ${amount}` : amount
})

// Runtime subscription hints are display-only; virtual occurrences are never persisted.
const isActiveSubscription = computed(
  () =>
    !isPreventedCrime.value &&
    props.crime.categoryId === 'subscriptions' &&
    props.crime.recurrence &&
    !props.crime.recurrenceEndAt,
)

const subscriptionLabel = computed(() => {
  if (props.crime.categoryId !== 'subscriptions' || !props.crime.recurrence) return ''
  if (props.crime.recurrenceEndAt) {
    return `Subscription ended ${relativeCrimeDate(props.crime.recurrenceEndAt)}`
  }
  return `Repeats ${props.crime.recurrence}`
})
</script>
