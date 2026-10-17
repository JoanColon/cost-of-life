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
      <div class="review-toolbar-action">
        <q-btn
          unelevated
          no-caps
          color="primary"
          :disable="saving || !canUseAllTracked"
          :label="t('expenseTracker.review.useAllTracked')"
          @click="$emit('use-all-tracked')"
        />
      </div>
    </div>

    <div class="review-groups">
      <section
        v-for="group in groups"
        :key="group.id"
        class="review-group"
        :class="`tracking-category--${group.id}`"
      >
        <h2>
          <span class="review-group-icon"><q-icon :name="group.icon" /></span>
          {{ t(group.nameKey) }}
        </h2>
        <div class="review-list">
          <article
            v-for="subcategory in group.subcategories"
            :key="subcategory.id"
            class="review-row"
          >
            <button type="button" class="review-name" @click="$emit('view', subcategory)">
              <span>
                <strong>{{ t(subcategory.nameKey) }}</strong>
              </span>
              <small>
                {{
                  t('expenseTracker.review.itemCount', {
                    count: subcategory.itemCount,
                  })
                }}
              </small>
            </button>
            <div class="review-values">
              <div class="review-value">
                <span>{{ t('expenseTracker.review.tracked') }}</span>
                <strong>{{ formatCurrency(subcategory.trackedTotal) }}</strong>
              </div>
              <div class="review-value">
                <span>{{ t('expenseTracker.review.model') }}</span>
                <strong>{{ formatCurrency(subcategory.modelValue) }}</strong>
              </div>
            </div>
            <q-btn
              class="review-view"
              flat
              round
              dense
              color="primary"
              icon="search"
              :aria-label="t('expenseTracker.review.view')"
              @click="$emit('view', subcategory)"
            />
            <div
              v-if="hasChanges(subcategory)"
              class="review-decisions"
              role="group"
              :aria-label="t(subcategory.nameKey)"
            >
              <button
                v-for="option in decisionOptions"
                :key="option.value"
                type="button"
                class="review-decision"
                :class="{ selected: subcategory.decision === option.value }"
                :disabled="subcategory.decisionDisabled"
                @click="$emit('decision', subcategory, option.value)"
              >
                <q-icon v-if="subcategory.decision === option.value" name="check" />
                {{ option.label }}
              </button>
            </div>
            <span v-else class="review-no-changes">
              <q-icon name="check" />
              {{ t('expenseTracker.review.noChanges') }}
            </span>
          </article>
        </div>
      </section>
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
  decisionOptions: { type: Array, required: true },
  canUseAllTracked: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
})
defineEmits(['view', 'decision', 'use-all-tracked'])
const { t } = useI18n()

function hasChanges(subcategory) {
  return (
    Math.round(Number(subcategory.trackedTotal || 0) * 100) !==
    Math.round(Number(subcategory.modelValue || 0) * 100)
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

.month-total span,
.review-value span {
  color: var(--color-copy);
  font-size: 0.75rem;
}

.month-total strong {
  color: var(--color-ink);
  font-size: 1.65rem;
  line-height: 1;
}

.review-toolbar-action {
  align-self: stretch;
  display: flex;
  align-items: center;
  padding-left: 1.25rem;
  border-left: 1px solid var(--color-line);
}

.review-toolbar-action .q-btn {
  min-height: 3rem;
  padding-inline: 1.15rem;
}

.review-groups {
  display: grid;
  gap: 1rem;
}

.review-group {
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: 0 6px 20px rgb(34 55 78 / 3%);
}

.review-group h2 {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-height: 4.5rem;
  margin: 0;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-line);
  font-size: 1.05rem;
  font-weight: 600;
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

.review-list {
  background: inherit;
}

.review-row {
  display: grid;
  grid-template-columns: minmax(12rem, 1fr) 13rem auto minmax(15rem, auto);
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 4.6rem;
  padding: 0.65rem 1rem;
  border-bottom: 1px solid var(--color-line);
}

.review-values {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.review-row:last-child {
  border-bottom: 0;
}

.review-name {
  display: grid;
  justify-items: start;
  min-width: 10rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-ink);
  text-align: left;
  cursor: pointer;
}

.review-name > span {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.review-name small {
  color: var(--color-copy);
  font-size: 0.78rem;
}

.review-value {
  display: grid;
  gap: 0.15rem;
  text-align: left;
}

.review-value strong {
  font-size: 0.95rem;
}

.review-decisions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.25rem;
}

.review-decision {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 2.4rem;
  padding: 0.45rem 0.8rem;
  border: 0;
  border-radius: 999px !important;
  background: transparent;
  color: var(--color-copy);
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.review-decision.selected {
  background: var(--color-blue-soft);
  color: #0759b8;
}

.review-decision:disabled {
  cursor: default;
  opacity: 0.5;
}

.review-decision:not(:disabled):focus-visible {
  @include focus-ring;
}

.review-no-changes {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.3rem;
  color: var(--color-copy);
  font-size: 0.78rem;
  white-space: nowrap;
}

@media (max-width: 899px) {
  .review-row {
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 0.45rem 0.4rem;
    min-height: 0;
    padding: 0.6rem 0.75rem;
  }

  .review-name {
    grid-column: 1;
    grid-row: 1;
  }

  .review-view {
    grid-column: 3;
    grid-row: 1;
  }

  .review-values {
    grid-column: 2;
    grid-row: 1;
    gap: 1rem;
    margin-left: 0.7rem;
  }

  .review-decisions,
  .review-no-changes {
    grid-column: 1 / -1;
    grid-row: 2;
    justify-content: flex-start;
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

  .review-toolbar-action {
    grid-column: 1 / -1;
    justify-content: stretch;
    padding-top: 0.6rem;
    padding-left: 0;
    border-top: 1px solid var(--color-line);
    border-left: 0;
  }

  .review-toolbar-action .q-btn {
    width: 100%;
    min-height: 2.45rem;
  }

  .month-total {
    min-width: 0;
  }

  .month-total strong {
    font-size: 1.3rem;
  }

  .review-groups {
    gap: 0.75rem;
  }

  .review-group h2 {
    gap: 1rem;
    min-height: 3.35rem;
    padding: 0.5rem 0.7rem;
    font-size: 0.95rem;
  }

  .review-group-icon {
    width: 2.15rem;
    height: 2.15rem;
    font-size: 1.05rem;
  }

  .review-name {
    min-width: 0;
  }

  .review-name strong,
  .review-value strong {
    font-size: 0.86rem;
  }

  .review-name small,
  .review-value span {
    font-size: 0.68rem;
  }

  .review-values {
    gap: 0.55rem;
  }

  .review-view {
    min-width: 1.9rem;
    min-height: 1.9rem;
    font-size: 0.85rem;
  }

  .review-decision {
    min-height: 2rem;
    padding: 0.3rem 0.5rem;
    font-size: 0.7rem;
  }
}
</style>
