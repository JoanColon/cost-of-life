<template>
  <q-card class="details-card">
    <q-form @submit.prevent="submit">
      <q-card-section class="dialog-header">
        <div>
          <h2>{{ t('whatIf.details.title') }}</h2>
          <p>{{ t('whatIf.details.description') }}</p>
        </div>
        <q-btn
          flat
          round
          dense
          icon="close"
          :aria-label="t('common.cancel')"
          @click="$emit('cancel')"
        />
      </q-card-section>
      <q-card-section class="dialog-body">
        <div class="field">
          <label>{{ t('whatIf.details.expectedReturn') }}</label>
          <q-input
            v-model.number="annualReturn"
            outlined
            :dense="$q.screen.lt.sm"
            type="number"
            min="0"
            max="100"
            step="0.1"
            suffix="%"
            :rules="[percentageRule]"
          />
          <small>{{ t('whatIf.details.expectedReturnHint') }}</small>
        </div>
        <div v-if="liabilities.length" class="field">
          <label>{{ t('whatIf.details.liability') }}</label>
          <q-select
            v-model="liabilityId"
            outlined
            :dense="$q.screen.lt.sm"
            emit-value
            map-options
            :options="liabilityOptions"
          />
          <small>{{ t('whatIf.details.liabilityHint') }}</small>
        </div>
      </q-card-section>
      <q-card-actions class="dialog-actions">
        <q-btn outline no-caps :label="t('common.cancel')" @click="$emit('cancel')" />
        <q-btn unelevated no-caps color="primary" type="submit" :label="t('common.save')" />
      </q-card-actions>
    </q-form>
  </q-card>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatCurrency } from '@/utils/formatters'

const props = defineProps({
  expectedAnnualReturnPercent: { type: Number, required: true },
  selectedLiabilityId: { type: String, default: null },
  liabilities: { type: Array, default: () => [] },
})
const emit = defineEmits(['save', 'cancel'])
const { t } = useI18n()
const annualReturn = ref(7)
const liabilityId = ref(null)

const liabilityOptions = computed(() =>
  props.liabilities.map((liability) => ({
    value: liability.id,
    label: `${liability.name} · ${formatCurrency(liability.balance)}`,
  })),
)

watch(
  () => [props.expectedAnnualReturnPercent, props.selectedLiabilityId, props.liabilities],
  seed,
  { immediate: true, deep: true },
)

function seed() {
  annualReturn.value = props.expectedAnnualReturnPercent
  liabilityId.value = props.liabilities.some(({ id }) => id === props.selectedLiabilityId)
    ? props.selectedLiabilityId
    : props.liabilities[0]?.id || null
}

function percentageRule(value) {
  const number = Number(value)
  return (
    (Number.isFinite(number) && number >= 0 && number <= 100) || t('whatIf.validation.percentage')
  )
}

function submit() {
  if (percentageRule(annualReturn.value) !== true) return
  emit('save', {
    expectedAnnualReturnPercent: Number(annualReturn.value),
    selectedLiabilityId: liabilityId.value,
  })
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;
.details-card {
  @include financial-dialog-card(36rem);
}
.dialog-header {
  @include financial-dialog-header;
}
.dialog-header p {
  margin: 0.25rem 0 0;
  color: var(--color-copy);
}
.dialog-body {
  @include financial-dialog-body;
  display: grid;
  gap: 1rem;
}
.field {
  @include financial-dialog-field;
  margin: 0;
}
.field small {
  color: var(--color-copy);
}
.dialog-actions {
  @include financial-dialog-actions;
}
</style>
