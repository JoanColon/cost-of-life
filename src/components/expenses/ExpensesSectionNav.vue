<template>
  <div class="expenses-section-context">
    <div class="expenses-context-meta">
      <p v-if="context">{{ context }}</p>
      <q-btn
        flat
        round
        dense
        icon="info_outline"
        color="primary"
        :aria-label="t('expenses.views.info.action')"
        @click="infoOpen = true"
      />
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

    <q-dialog v-model="infoOpen">
      <q-card class="expenses-info-dialog">
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
  context: { type: String, default: '' },
})
const { t } = useI18n()
const infoOpen = ref(false)
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
      query: { view: 'track' },
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
.expenses-context-meta {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-top: 0.45rem;
}
.expenses-context-meta > p {
  margin: 0;
  color: var(--color-copy);
  font-size: 0.9rem;
  font-weight: 600;
  text-transform: capitalize;
}
.expenses-context-meta .q-btn {
  min-width: 1.8rem;
  min-height: 1.8rem;
  font-size: 0.85rem;
}
.expenses-section-nav {
  display: inline-flex;
  gap: 0.2rem;
  margin-top: 0.65rem;
  padding: 0.25rem;
  border: 1px solid var(--color-line);
  border-radius: 999px;
  background: var(--color-surface);
}
.expenses-section-nav a {
  min-width: 5.5rem;
  padding: 0.5rem 0.85rem;
  border-radius: 999px;
  color: var(--color-copy);
  font-size: 0.82rem;
  font-weight: 650;
  text-align: center;
  text-decoration: none;
}
.expenses-section-nav a.active {
  background: var(--color-ink);
  color: white;
}
.expenses-section-nav a:focus-visible {
  @include focus-ring;
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
  .expenses-section-nav {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    width: 100%;
    margin-top: 0.5rem;
  }
  .expenses-section-nav a {
    min-width: 0;
    padding: 0.42rem;
    font-size: 0.75rem;
  }
  .expenses-context-meta {
    margin-top: 0.25rem;
  }
  .expenses-context-meta > p {
    font-size: 0.75rem;
  }
  .info-heading h2 {
    font-size: 1.5rem;
  }
  .info-copy {
    font-size: 1rem;
  }
}
</style>
