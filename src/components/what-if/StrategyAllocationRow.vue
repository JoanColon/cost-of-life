<template>
  <article class="allocation-card">
    <span :class="['allocation-icon', tone]"><q-icon :name="icon" /></span>
    <div class="allocation-identity">
      <strong>{{ title }}</strong>
      <small>{{ description }}</small>
      <span class="allocation-track" aria-hidden="true">
        <i :class="tone" :style="{ width: `${percent}%` }" />
      </span>
    </div>
    <button type="button" class="allocation-values" :aria-label="`Edit ${title} allocation`">
      <strong>{{ percent }}%</strong>
      <small>{{ formatCurrency(amount) }} / month</small>
      <q-popup-edit
        :model-value="percent"
        buttons
        :title="`Edit ${title} allocation`"
        :label-set="t('common.save')"
        :label-cancel="t('common.cancel')"
        anchor="bottom right"
        self="top right"
        @save="save"
      >
        <template #default="scope">
          <q-input
            v-model.number="scope.value"
            autofocus
            dense
            outlined
            type="number"
            inputmode="numeric"
            min="0"
            max="100"
            step="5"
            suffix="%"
            :label="title"
            @keyup.enter="scope.set"
          />
        </template>
      </q-popup-edit>
    </button>
  </article>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { formatCurrency } from '@/utils/formatters'

defineProps({
  icon: { type: String, required: true },
  tone: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  percent: { type: Number, required: true },
  amount: { type: Number, required: true },
})

const emit = defineEmits(['change'])
const { t } = useI18n()

function save(value) {
  emit('change', Math.min(100, Math.max(0, Number(value) || 0)))
}
</script>

<style scoped lang="scss">
.allocation-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.7rem;
  padding: 0.65rem 0.7rem;
  border: 1px solid var(--color-line);
  border-radius: 0.8rem;
  background: white;
}

.allocation-icon {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  font-size: 1.3rem;
}

.allocation-icon.cash {
  background: var(--color-green-soft);
  color: var(--color-success-dark);
}

.allocation-icon.invest {
  background: var(--color-blue-soft);
  color: var(--color-primary);
}

.allocation-icon.debt {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.allocation-identity,
.allocation-values {
  display: grid;
}

.allocation-identity {
  gap: 0.1rem;
}

.allocation-identity strong {
  font-size: 0.9rem;
}

.allocation-identity small,
.allocation-values small {
  color: var(--color-copy);
  font-size: 0.72rem;
}

.allocation-values {
  padding: 0.2rem 0;
  border: 0;
  border-bottom: 1px dashed transparent;
  background: transparent;
  color: inherit;
  font: inherit;
  min-width: 7rem;
  justify-items: end;
  cursor: pointer;
}

.allocation-values:hover,
.allocation-values:focus-visible {
  border-bottom-color: var(--color-primary);
  outline: 0;
}

.allocation-values strong {
  font-size: 1.1rem;
  line-height: 1.1;
}

.allocation-track {
  width: 100%;
  height: 0.42rem;
  margin-top: 0.35rem;
  overflow: hidden;
  border-radius: 999px;
  background: #e9eef3;
}

.allocation-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
}

.allocation-track i.cash {
  background: var(--color-success-dark);
}

.allocation-track i.invest {
  background: var(--color-primary);
}

.allocation-track i.debt {
  background: var(--color-warning);
}

@media (max-width: 520px) {
  .allocation-card {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 0.65rem;
  }

  .allocation-icon {
    width: 2.6rem;
    height: 2.6rem;
  }

  .allocation-values {
    grid-column: 2;
    grid-row: 2;
    min-width: 0;
    justify-items: start;
  }
}
</style>
