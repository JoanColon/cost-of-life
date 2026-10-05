<template>
  <q-dialog v-model="dialogModel" position="bottom">
    <q-card class="amount-sheet">
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
      <div class="amount-sheet__icon">🚨</div>
      <div class="amount-sheet__title">{{ category?.crimeName }}</div>
      <div class="amount-sheet__prompt">How much damage?</div>

      <div class="amount-grid">
        <q-btn
          v-for="amount in category?.quickAmounts || []"
          :key="amount"
          class="amount-choice"
          unelevated
          no-caps
          :label="formatMoney(amount, currency)"
          @click="chooseAmount(amount)"
        />
        <q-btn class="amount-choice" unelevated no-caps label="OTHER" @click="showOther = true" />
        <q-btn
          class="amount-choice amount-choice--later"
          unelevated
          no-caps
          label="LATER"
          @click="chooseLater"
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
            :disable="!isValidRequiredAmount(customAmount)"
            @click="chooseAmount(customAmount)"
          />
        </div>
      </q-slide-transition>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { getCurrencySymbol } from '@/config/currencies'
import { formatMoney } from '@/utils/crimeStats'
import { isValidRequiredAmount, normalizeRequiredAmount } from '@/utils/amounts'

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true,
  },
  category: {
    type: Object,
    default: null,
  },
  currency: {
    type: String,
    default: 'EUR',
  },
})

const emit = defineEmits(['update:modelValue', 'amount', 'later'])

const showOther = ref(false)
const customAmount = ref('')
const currencySymbol = computed(() => getCurrencySymbol(props.currency))

const dialogModel = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      showOther.value = false
      customAmount.value = ''
    }
  },
)

function chooseAmount(amount) {
  if (!isValidRequiredAmount(amount)) return

  emit('amount', normalizeRequiredAmount(amount))
  emit('update:modelValue', false)
}

function chooseLater() {
  emit('later')
  emit('update:modelValue', false)
}
</script>
