<template>
  <section class="track-panel">
    <div v-if="categories.length" class="tracking-grid">
      <button
        v-for="subcategory in categories"
        :key="subcategory.id"
        type="button"
        class="tracking-button"
        :class="`tracking-category--${subcategory.categoryId}`"
        @click="$emit('add', subcategory)"
      >
        <span class="tracking-icon"><q-icon :name="subcategory.icon" /></span>
        <span class="tracking-copy">
          <strong>{{ t(subcategory.nameKey) }}</strong>
          <small>{{ t(subcategory.categoryNameKey) }}</small>
        </span>
        <q-icon name="chevron_right" class="tracking-chevron" />
      </button>
    </div>

    <section v-else class="empty-card">
      <q-icon name="tune" />
      <h2>{{ t('expenseTracker.empty.title') }}</h2>
      <p>{{ t('expenseTracker.empty.description') }}</p>
      <q-btn
        unelevated
        no-caps
        color="primary"
        :label="t('expenseTracker.manage.action')"
        @click="$emit('manage')"
      />
    </section>

    <q-btn
      v-if="categories.length"
      flat
      no-caps
      icon="tune"
      color="primary"
      :label="t('expenseTracker.manage.editAction')"
      class="edit-tracker-categories"
      @click="$emit('manage')"
    />
  </section>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

defineProps({ categories: { type: Array, required: true } })
defineEmits(['add', 'manage'])
const { t } = useI18n()
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;
@use '@/css/expense-tracking' as tracking;

@include tracking.category-colors;

.track-panel {
  margin-top: 2rem;
}

.tracking-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.1rem;
}

.tracking-button {
  display: grid;
  grid-template-columns: 3.1rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.9rem;
  min-height: 5.2rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--color-line);
  border-radius: 0.7rem !important;
  background: var(--color-surface);
  color: var(--color-ink);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 150ms ease,
    box-shadow 150ms ease,
    transform 150ms ease;
}

.tracking-button:hover {
  border-color: color-mix(in srgb, var(--tracking-color, var(--color-primary)) 45%, white);
  box-shadow: 0 8px 22px rgb(34 55 78 / 8%);
  transform: translateY(-1px);
}

.tracking-button:focus-visible {
  @include focus-ring;
}

.tracking-icon {
  display: grid;
  place-items: center;
  width: 3.1rem;
  height: 3.1rem;
  border-radius: 50%;
  background: var(--tracking-soft, var(--color-blue-soft));
  color: var(--tracking-color, var(--color-primary));
}

.tracking-icon .q-icon {
  font-size: 1.55rem;
}

.tracking-copy {
  display: grid;
  min-width: 0;
  gap: 0.2rem;
}

.tracking-copy strong,
.tracking-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tracking-copy strong {
  font-size: 1.04rem;
}

.tracking-copy small {
  color: var(--color-copy);
  font-size: 0.86rem;
}

.tracking-chevron {
  color: var(--color-ink);
  font-size: 1.3rem;
}

.edit-tracker-categories {
  margin-top: 1rem;
  margin-left: -0.75rem;
}

.empty-card {
  display: grid;
  min-height: 18rem;
  place-content: center;
  justify-items: center;
  text-align: center;
}

.empty-card p {
  color: var(--color-copy);
}

@media (max-width: 899px) {
  .tracking-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 599px) {
  .track-panel {
    margin-top: 1.5rem;
  }

  .tracking-grid {
    grid-template-columns: 1fr;
    gap: 0;
    overflow: hidden;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-card);
    background: var(--color-surface);
    box-shadow: var(--shadow-card);
  }

  .tracking-button {
    border: 0;
    border-bottom: 1px solid var(--color-line);
    border-radius: 0 !important;
  }

  .tracking-button:last-child {
    border-bottom: 0;
  }
}
</style>
