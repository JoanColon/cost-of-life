<template>
  <nav class="mobile-nav" :aria-label="t('navigation.primary')">
    <button
      v-for="item in items"
      :key="item.key"
      type="button"
      class="nav-button"
      :class="{ active: item.key === activeItem, featured: item.featured }"
      :aria-current="item.key === activeItem ? 'page' : undefined"
      @click="navigate(item.key)"
    >
      <q-icon :name="item.icon" />
      <span>{{ t(item.label) }}</span>
    </button>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const items = [
  { key: 'home', icon: 'home', label: 'navigation.home', implemented: true },
  { key: 'plan', icon: 'track_changes', label: 'navigation.plan', implemented: true },
  {
    key: 'tracker',
    icon: 'add',
    label: 'navigation.tracker',
    implemented: true,
    featured: true,
  },
  { key: 'progress', icon: 'bar_chart', label: 'navigation.progress', implemented: true },
  { key: 'setup', icon: 'tune', label: 'navigation.setup', implemented: true },
]
const activeItem = computed(() => {
  if (route.name === 'workspace-dashboard') return 'home'
  if (
    route.name === 'expenses' ||
    route.name === 'expense-category' ||
    route.name === 'expense-tracker'
  )
    return route.name === 'expense-tracker' ? 'tracker' : 'setup'
  if (route.name === 'progress' || route.name === 'achievements') return 'progress'
  if (route.name === 'plan' || route.name === 'what-if' || route.name === 'what-if-strategy')
    return 'plan'
  if (
    route.name === 'setup' ||
    route.name === 'assets' ||
    route.name === 'asset-category' ||
    route.name === 'liabilities' ||
    route.name === 'liability-category' ||
    route.name === 'income' ||
    route.name === 'income-category'
  )
    return 'setup'
  return null
})

function navigate(key) {
  const workspaceId = route.params.workspaceId
  if (typeof workspaceId !== 'string') return
  const routeName =
    key === 'home'
      ? 'workspace-dashboard'
      : key === 'tracker'
        ? 'expense-tracker'
        : key === 'progress'
          ? 'progress'
          : key === 'plan'
            ? 'plan'
            : key === 'setup'
              ? 'setup'
              : null
  if (routeName) router.push({ name: routeName, params: { workspaceId } })
}
</script>

<style scoped lang="scss">
.mobile-nav {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  min-height: var(--mobile-nav-height);
  padding: 0.35rem max(0.65rem, env(safe-area-inset-right)) env(safe-area-inset-bottom)
    max(0.65rem, env(safe-area-inset-left));
  border-top: 1px solid var(--color-line);
  background: var(--color-surface-raised);
  backdrop-filter: blur(16px);
}

.nav-button {
  position: relative;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 0.2rem;
  border: 0;
  background: transparent;
  color: var(--color-copy);
  font-size: 0.72rem;
}

.nav-button.featured {
  color: var(--color-primary);
  font-weight: 700;
}

.nav-button.featured .q-icon {
  display: grid;
  place-items: center;
  width: 2.7rem;
  height: 2.7rem;
  margin-top: -1.15rem;
  border: 4px solid var(--color-surface-raised);
  border-radius: 50%;
  background: var(--color-primary);
  color: var(--color-inverse);
  box-shadow: 0 8px 18px rgb(8 112 216 / 28%);
}

.nav-button .q-icon {
  font-size: 1.55rem;
}

.nav-button.active {
  color: var(--color-primary);
}

.nav-button:disabled {
  opacity: 0.42;
}
</style>
