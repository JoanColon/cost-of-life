<template>
  <q-page class="setup-page">
    <main class="setup-shell">
      <header>
        <div>
          <q-btn
            flat
            dense
            no-caps
            color="grey-7"
            icon="arrow_back"
            :label="t('navigation.backToWorkspaceHome')"
            :to="homeRoute"
            class="back-button"
          />
          <h1>{{ t('setup.title') }}</h1>
          <p>{{ t('setup.subtitle') }}</p>
        </div>
      </header>

      <section class="setup-grid" :aria-label="t('navigation.setup')">
        <router-link v-for="item in items" :key="item.key" :to="item.to" class="setup-link">
          <span class="setup-icon"><q-icon :name="item.icon" /></span>
          <span>
            <strong>{{ t(`dashboard.setup.${item.key}.title`) }}</strong>
            <small>{{ t(`dashboard.setup.${item.key}.description`) }}</small>
          </span>
          <q-icon name="arrow_forward" />
        </router-link>
      </section>
    </main>
  </q-page>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

const { t } = useI18n()
const route = useRoute()
const homeRoute = computed(() => ({
  name: 'workspace-dashboard',
  params: { workspaceId: route.params.workspaceId },
}))
const items = computed(() => [
  setupItem('assets', 'inventory_2'),
  setupItem('liabilities', 'request_quote'),
  setupItem('income', 'payments'),
  setupItem('expenses', 'credit_card'),
])

function setupItem(key, icon) {
  return { key, icon, to: { name: key, params: { workspaceId: route.params.workspaceId } } }
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;

.setup-page {
  @include financial-page;
}

.setup-shell {
  @include financial-shell;
  max-width: 58rem;
}

header {
  @include financial-header;
  margin-bottom: 0.75rem;
}

.back-button {
  @include financial-back-button;
}

h1 {
  @include financial-title;
}

.setup-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.setup-link {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-ink);
  text-decoration: none;
  box-shadow: var(--shadow-card);
}

.setup-link:hover {
  border-color: var(--color-primary-border);
}

.setup-icon {
  display: grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: var(--color-blue-soft);
  color: var(--color-primary);
  font-size: 1.4rem;
}

.setup-link strong,
.setup-link small {
  display: block;
}

.setup-link small {
  margin-top: 0.2rem;
  color: var(--color-copy);
}

@media (max-width: 699px) {
  .setup-grid {
    grid-template-columns: 1fr;
  }
}
</style>
