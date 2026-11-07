<template>
  <section class="review-panel">
    <div class="review-toolbar">
      <q-input
        v-model="period"
        outlined
        dense
        type="month"
        :label="t('expenseTracker.review.month')"
        class="month-input"
      />
      <div class="month-total">
        <span>{{ t('expenseTracker.review.trackedTotal') }}</span>
        <strong>{{ formatCurrency(trackedTotal) }}</strong>
      </div>
      <div class="month-total">
        <span>{{ t('expenseTracker.review.modelTotal') }}</span>
        <strong>{{ formatCurrency(modelTotal) }}</strong>
      </div>
    </div>

    <div class="review-groups">
      <section
        v-for="group in groups"
        :key="group.id"
        class="review-group"
        :class="`tracking-category--${group.id}`"
      >
        <button type="button" class="review-group-button" @click="$emit('view-group', group)">
          <span class="review-group-icon"><q-icon :name="group.icon" /></span>
          <span class="review-group-copy">
            <strong>{{ t(group.nameKey) }}</strong>
            <small>
              {{
                t('expenseTracker.review.categoryCount', {
                  count: group.subcategories.length,
                })
              }}
            </small>
          </span>
          <span class="review-group-total">
            <small>{{ t('expenseTracker.review.tracked') }}</small>
            <strong>{{ formatCurrency(groupTrackedTotal(group)) }}</strong>
          </span>
          <span class="review-group-total">
            <small>{{ t('expenseTracker.review.model') }}</small>
            <strong>{{ formatCurrency(groupModelTotal(group)) }}</strong>
          </span>
          <q-icon name="chevron_right" class="review-chevron" />
        </button>
      </section>
    </div>

    <div class="review-actions">
      <q-btn
        flat
        no-caps
        icon="done_all"
        color="primary"
        :disable="saving || !canUseAllTracked"
        :label="t('expenseTracker.review.useAllTracked')"
        @click="$emit('use-all-tracked')"
      />
    </div>
  </section>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { formatCurrency } from '@/utils/formatters'

const period = defineModel({ type: String, required: true })
defineProps({
  groups: { type: Array, required: true },
  trackedTotal: { type: Number, default: 0 },
  modelTotal: { type: Number, default: 0 },
  canUseAllTracked: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
})
defineEmits(['view-group', 'use-all-tracked'])
const { t } = useI18n()

function groupTrackedTotal(group) {
  return group.subcategories.reduce(
    (total, subcategory) => total + Number(subcategory.trackedTotal || 0),
    0,
  )
}

function groupModelTotal(group) {
  return group.subcategories.reduce(
    (total, subcategory) => total + Number(subcategory.modelValue || 0),
    0,
  )
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;
@use '@/css/expense-tracking' as tracking;

@include tracking.category-colors;

.review-panel {
  margin-top: 2rem;
}

.review-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 5.8rem;
  margin-bottom: 1.35rem;
  padding: 1rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: 0 8px 24px rgb(34 55 78 / 4%);
}

.month-input {
  width: 15rem;
  margin-right: auto;
}

.month-total {
  display: grid;
  min-width: 8.5rem;
  gap: 0.15rem;
}

.month-total span {
  color: var(--color-copy);
  font-size: 0.75rem;
}

.month-total strong {
  color: var(--color-ink);
  font-size: 1.65rem;
  line-height: 1;
}

.review-groups {
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.review-actions {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin-top: 0;
  padding: 0;
}

.review-actions .q-btn {
  margin-left: -0.75rem;
}

.review-group {
  border-bottom: 1px solid var(--color-line);
}

.review-group:last-child {
  border-bottom: 0;
}

.review-group-button {
  @include button-reset;
  display: grid;
  grid-template-columns: 3.1rem minmax(0, 1fr) minmax(7rem, auto) minmax(7rem, auto) auto;
  align-items: center;
  gap: 0.9rem;
  width: 100%;
  min-height: 5.2rem;
  padding: 0.85rem 1rem;
  background: var(--color-surface);
  color: var(--color-ink);
}

.review-group-button:hover {
  background: color-mix(in srgb, var(--tracking-soft, var(--color-blue-soft)) 28%, white);
}

.review-group-button:focus-visible {
  @include focus-ring;
}

.review-group-icon {
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 50%;
  background: var(--tracking-soft, var(--color-blue-soft));
  color: var(--tracking-color, var(--color-primary));
  font-size: 1.35rem;
}

.review-group-copy {
  display: grid;
  min-width: 0;
  gap: 0.2rem;
}

.review-group-copy strong,
.review-group-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.review-group-total {
  display: grid;
  gap: 0.15rem;
  text-align: right;
}

.review-group-total small {
  color: var(--color-copy);
  font-size: 0.72rem;
}

.review-group-total strong {
  color: var(--color-ink);
  font-size: 0.95rem;
}

.review-group-copy strong {
  font-size: 1.04rem;
}

.review-group-copy small {
  color: var(--color-copy);
  font-size: 0.8rem;
}

.review-chevron {
  color: var(--color-ink);
  font-size: 1.4rem;
}

@media (max-width: 899px) {
  .review-group-button {
    grid-template-columns: 3.1rem minmax(0, 1fr) minmax(6rem, auto) auto;
  }

  .review-group-total:last-of-type {
    display: none;
  }
}

@media (max-width: 599px) {
  .review-panel {
    margin-top: 0.85rem;
  }

  .review-toolbar {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.65rem;
    min-height: 0;
    margin-bottom: 0.75rem;
    padding: 0.7rem;
  }

  .month-input {
    width: auto;
    margin-right: 0;
    grid-column: 1 / -1;
  }

  .month-total {
    min-width: 0;
  }

  .month-total strong {
    font-size: 1.3rem;
  }

  .review-actions {
    margin-top: 0;
    padding: 0;
  }

  .review-group-button {
    grid-template-columns: 2.65rem minmax(0, 1fr) minmax(5.5rem, auto) auto;
    gap: 0.75rem;
    min-height: 4.6rem;
    padding: 0.65rem 0.75rem;
  }

  .review-group-icon {
    width: 2.65rem;
    height: 2.65rem;
    font-size: 1.2rem;
  }

  .review-group-copy strong {
    font-size: 0.95rem;
  }

  .review-group-copy small {
    font-size: 0.72rem;
  }

  .review-group-total strong {
    font-size: 0.86rem;
  }
}
</style>
