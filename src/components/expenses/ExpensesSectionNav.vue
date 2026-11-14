<template>
  <div class="expenses-section-context">
    <div class="expenses-section-header">
      <slot name="header" :open-info="openInfo" />
    </div>
    <nav class="expenses-section-nav" :aria-label="t('expenses.views.label')">
      <router-link
        v-for="item in items"
        :key="item.key"
        :to="item.to"
        :class="{ active: item.key === active }"
        :aria-current="item.key === active ? 'page' : undefined"
      >
        {{ t(item.label) }}
      </router-link>
    </nav>

    <q-dialog v-model="infoOpen" :position="$q.screen.lt.sm ? 'bottom' : undefined">
      <q-card class="expenses-info-dialog responsive-info-card">
        <span class="info-sheet-handle" aria-hidden="true" />
        <q-card-section class="info-heading">
          <h2>{{ t('expenses.views.info.title') }}</h2>
          <q-btn v-close-popup flat round dense icon="close" :aria-label="t('common.close')" />
        </q-card-section>
        <q-card-section class="info-copy">
          <p>
            <strong>{{ t('expenses.views.plan') }}</strong> —
            {{ t('expenses.views.info.plan') }}
          </p>
          <p>
            <strong>{{ t('expenses.views.track') }}</strong> —
            {{ t('expenses.views.info.track') }}
          </p>
          <p>
            <strong>{{ t('expenses.views.review') }}</strong> —
            {{ t('expenses.views.info.review') }}
          </p>
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  workspaceId: { type: String, required: true },
  active: { type: String, required: true },
})
const { t } = useI18n()
const infoOpen = ref(false)
const openInfo = () => {
  infoOpen.value = true
}
const items = computed(() => [
  {
    key: 'plan',
    label: 'expenses.views.plan',
    to: { name: 'expenses', params: { workspaceId: props.workspaceId } },
  },
  {
    key: 'track',
    label: 'expenses.views.track',
    to: {
      name: 'expense-tracker',
      params: { workspaceId: props.workspaceId },
      query: { view: 'track', mode: 'record' },
    },
  },
  {
    key: 'review',
    label: 'expenses.views.review',
    to: {
      name: 'expense-tracker',
      params: { workspaceId: props.workspaceId },
      query: { view: 'review' },
    },
  },
])
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;
.expenses-section-header:empty {
  display: none;
}
.expenses-section-header :deep(.expenses-title-info) {
  min-width: 1.8rem;
  min-height: 1.8rem;
  font-size: 0.85rem;
}
.expenses-section-nav {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  width: 100%;
  margin-top: 0.75rem;
  border-bottom: 1px solid var(--color-line-strong);
}
.expenses-section-nav a {
  position: relative;
  min-width: 0;
  padding: 0.85rem 1rem;
  color: var(--color-muted);
  font-size: 0.95rem;
  font-weight: 700;
  text-align: center;
  text-decoration: none;
  transition: color 150ms ease;
}
.expenses-section-nav a.active {
  color: var(--color-ink);
}
.expenses-section-nav a.active::after {
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 3px;
  background: var(--color-primary);
  content: '';
}
.expenses-section-nav a:hover {
  color: var(--color-ink);
}
.expenses-section-nav a:focus-visible {
  @include focus-ring;
}
@media (min-width: 900px) {
  .expenses-section-context:has(.expenses-section-header:not(:empty)) {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(24rem, 42%);
    align-items: end;
    column-gap: clamp(2rem, 5vw, 5rem);
  }

  .expenses-section-header {
    grid-column: 1;
  }

  .expenses-section-context:has(.expenses-section-header:not(:empty)) .expenses-section-nav {
    grid-column: 2;
    align-self: end;
    margin-top: 0;
  }
}
.expenses-info-dialog {
  width: min(36rem, calc(100vw - 2rem));
  border-radius: var(--radius-card);
}
.info-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 0.5rem;
}
.info-heading h2 {
  margin: 0;
  color: var(--color-ink);
  font-size: 1.7rem;
}
.info-copy {
  padding-top: 0.5rem;
  color: var(--color-copy);
  font-size: 1.05rem;
}
.info-copy p {
  margin: 0 0 1rem;
  line-height: 1.6;
}
.info-copy p:last-child {
  margin-bottom: 0;
}
.info-copy strong {
  color: var(--color-ink);
  font-size: 1.08rem;
}
@media (max-width: 599px) {
  .expenses-section-nav a {
    padding: 0.75rem 0.4rem;
    font-size: 0.86rem;
  }
  .info-heading h2 {
    font-size: 1.5rem;
  }
  .info-copy {
    font-size: 1rem;
  }
}
</style>
