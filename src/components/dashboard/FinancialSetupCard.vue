<template>
  <section class="setup-card">
    <header>
      <div>
        <span>{{ t('dashboard.setup.eyebrow') }}</span>
        <h2>{{ t('dashboard.setup.title') }}</h2>
        <p>{{ t('dashboard.setup.description') }}</p>
      </div>
      <strong>{{ t('dashboard.setup.progress', { completed, total: items.length }) }}</strong>
    </header>

    <q-linear-progress
      rounded
      size="0.55rem"
      color="primary"
      track-color="grey-3"
      :value="progress"
    />

    <div class="setup-list">
      <router-link v-for="item in items" :key="item.key" :to="item.to" class="setup-row">
        <span class="setup-icon" :class="item.key"><q-icon :name="item.icon" /></span>
        <span class="setup-copy">
          <strong>{{ item.title }}</strong>
          <small>{{ item.description }}</small>
        </span>
        <span v-if="item.completed" class="setup-value">
          <q-icon name="check_circle" />
          <strong>{{ formatCurrency(item.total) }}</strong>
        </span>
        <span v-else class="setup-action">
          {{ t('dashboard.setup.add') }} <q-icon name="arrow_forward" />
        </span>
      </router-link>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatCurrency } from '@/utils/formatters'

const props = defineProps({ items: { type: Array, required: true } })
const { t } = useI18n()
const completed = computed(() => props.items.filter(({ completed: value }) => value).length)
const progress = computed(() => (props.items.length ? completed.value / props.items.length : 0))
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;
.setup-card {
  @include dashboard-card;
  padding: clamp(1.2rem, 3vw, 1.8rem);
}
.setup-card header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}
.setup-card header span {
  color: var(--color-primary);
  font-size: 0.72rem;
  font-weight: 750;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.setup-card h2 {
  margin: 0.25rem 0 0;
  font-size: clamp(1.45rem, 3vw, 2rem);
}
.setup-card header p {
  margin: 0.35rem 0 0;
  color: var(--color-copy);
}
.setup-card header > strong {
  flex: 0 0 auto;
  padding: 0.45rem 0.75rem;
  border-radius: 999px;
  background: var(--color-blue-soft);
  color: var(--color-primary);
  font-size: 0.82rem;
}
.setup-card > .q-linear-progress {
  margin-top: 1.2rem;
}
.setup-list {
  margin-top: 0.8rem;
  border-top: 1px solid var(--color-line);
}
.setup-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.85rem;
  min-height: 4.6rem;
  padding: 0.65rem 0;
  border-bottom: 1px solid var(--color-line);
  color: var(--color-ink);
  text-decoration: none;
}
.setup-row:last-child {
  border-bottom: 0;
}
.setup-row:hover .setup-copy > strong {
  color: var(--color-primary);
}
.setup-icon {
  display: grid;
  place-items: center;
  width: 2.65rem;
  height: 2.65rem;
  border-radius: 50%;
  background: var(--color-green-soft);
  color: var(--color-success-dark);
  font-size: 1.2rem;
}
.setup-icon.liabilities {
  background: var(--color-red-soft);
  color: var(--color-danger);
}
.setup-icon.income {
  background: var(--color-blue-soft);
  color: var(--color-primary);
}
.setup-icon.expenses {
  background: var(--color-warning-soft);
  color: var(--color-warning-dark);
}
.setup-copy {
  display: grid;
}
.setup-copy small {
  margin-top: 0.15rem;
  color: var(--color-copy);
}
.setup-value,
.setup-action {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.setup-value > .q-icon {
  color: var(--color-success-dark);
}
.setup-action {
  color: var(--color-primary);
  font-size: 0.82rem;
  font-weight: 650;
}
@media (max-width: 599px) {
  .setup-card header {
    display: grid;
  }
  .setup-card header > strong {
    justify-self: start;
  }
  .setup-row {
    grid-template-columns: auto minmax(0, 1fr);
  }
  .setup-value,
  .setup-action {
    grid-column: 2;
    justify-self: start;
  }
}
</style>
