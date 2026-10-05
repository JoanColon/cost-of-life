<template>
  <q-dialog v-model="dialogModel" position="bottom">
    <q-card class="amount-sheet subscription-sheet">
      <q-btn
        v-close-popup
        class="amount-sheet__close"
        flat
        round
        dense
        color="white"
        icon="close"
        aria-label="Close"
      />
      <div class="subscription-sheet__header">
        <q-btn
          v-if="step !== 'provider'"
          flat
          round
          dense
          icon="arrow_back"
          aria-label="Go back"
          :disable="saving"
          @click="goBack"
        />
        <div>
          <div class="amount-sheet__icon">💳</div>
          <div class="amount-sheet__title">{{ title }}</div>
          <div class="amount-sheet__prompt">{{ prompt }}</div>
        </div>
      </div>

      <template v-if="step === 'provider'">
        <div v-for="group in providerGroups" :key="group.id" class="subscription-group">
          <div class="subscription-group__label">{{ group.label }}</div>
          <div class="subscription-grid">
            <q-btn
              v-for="provider in providersByGroup(group.id)"
              :key="provider.id"
              class="subscription-choice"
              unelevated
              no-caps
              :disable="saving"
              @click="chooseProvider(provider)"
            >
              <q-icon :name="provider.icon" />
              <span>{{ provider.label }}</span>
            </q-btn>
          </div>
        </div>
      </template>

      <template v-else-if="step === 'recurrence'">
        <div class="amount-grid">
          <q-btn
            v-for="option in recurrenceChoices"
            :key="option.label"
            class="amount-choice"
            unelevated
            no-caps
            :label="option.label"
            :disable="saving"
            @click="chooseRecurrence(option.value)"
          />
        </div>
      </template>

      <template v-else>
        <div class="amount-grid">
          <q-btn
            v-for="amount in selectedProvider?.priceOptions || []"
            :key="amount"
            class="amount-choice"
            unelevated
            no-caps
            :label="formatMoney(amount, currency)"
            :disable="saving"
            @click="chooseAmount(amount)"
          />
          <q-btn
            class="amount-choice"
            unelevated
            no-caps
            label="OTHER"
            :disable="saving"
            @click="showOther = true"
          />
        </div>

        <q-slide-transition>
          <div v-if="showOther" class="other-amount">
            <q-input
              v-model="customAmount"
              autofocus
              dark
              dense
              inputmode="decimal"
              label="Damages"
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
              label="CONVICT"
              :loading="saving"
              :disable="saving || !isValidRequiredAmount(customAmount)"
              @click="chooseAmount(customAmount)"
            />
          </div>
        </q-slide-transition>
      </template>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { getCurrencySymbol } from '@/config/currencies'
import { subscriptionProviderGroups, subscriptionProviders } from '@/config/subscriptionProviders'
import { formatMoney } from '@/utils/crimeStats'
import { isValidRequiredAmount, normalizeRequiredAmount } from '@/utils/amounts'

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true,
  },
  currency: {
    type: String,
    default: 'EUR',
  },
  saving: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue', 'subscription'])

// A compact state machine keeps the subscription flow to provider, recurrence, amount.
const step = ref('provider')
const selectedProvider = ref(null)
const selectedRecurrence = ref(null)
const showOther = ref(false)
const customAmount = ref('')
const currencySymbol = computed(() => getCurrencySymbol(props.currency))

const recurrenceChoices = [
  { label: 'Once', value: null },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Yearly', value: 'yearly' },
]

const dialogModel = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const providerGroups = computed(() =>
  subscriptionProviderGroups.filter((group) =>
    subscriptionProviders.some((provider) => provider.group === group.id),
  ),
)

const title = computed(() => {
  if (step.value === 'provider') return 'Subscription Negligence'
  return selectedProvider.value?.label || 'Subscription Negligence'
})

const prompt = computed(() => {
  if (step.value === 'provider') return 'Which service?'
  if (step.value === 'recurrence') return 'How often?'
  return 'How much damage?'
})

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) resetFlow()
  },
)

function providersByGroup(groupId) {
  return subscriptionProviders.filter((provider) => provider.group === groupId)
}

function resetFlow() {
  step.value = 'provider'
  selectedProvider.value = null
  selectedRecurrence.value = null
  showOther.value = false
  customAmount.value = ''
}

function chooseProvider(provider) {
  selectedProvider.value = provider
  step.value = 'recurrence'
}

function goBack() {
  if (step.value === 'amount') {
    step.value = 'recurrence'
    showOther.value = false
    customAmount.value = ''
    return
  }

  step.value = 'provider'
  selectedRecurrence.value = null
}

function chooseRecurrence(recurrence) {
  selectedRecurrence.value = recurrence
  step.value = 'amount'
}

function chooseAmount(amount) {
  if (props.saving || !isValidRequiredAmount(amount)) return

  // The final click emits all data needed to persist one subscription source event.
  emit('subscription', {
    provider: selectedProvider.value,
    recurrence: selectedRecurrence.value,
    amount: normalizeRequiredAmount(amount),
  })
}
</script>
