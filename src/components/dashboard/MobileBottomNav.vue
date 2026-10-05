<template>
  <nav class="mobile-nav" :aria-label="t('navigation.primary')">
    <button
      v-for="item in items"
      :key="item.key"
      type="button"
      class="nav-button"
      :class="{ active: item.key === activeItem }"
      :disabled="!item.implemented"
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
  { key: 'expenses', icon: 'credit_card', label: 'navigation.expenses', implemented: false },
  { key: 'plan', icon: 'track_changes', label: 'navigation.plan', implemented: false },
  { key: 'progress', icon: 'bar_chart', label: 'navigation.progress', implemented: false },
]
const activeItem = computed(() => (route.name === 'workspace-dashboard' ? 'home' : null))

function navigate(key) {
  const workspaceId = route.params.workspaceId
  if (key !== 'home' || typeof workspaceId !== 'string') return

  router.push({ name: 'workspace-dashboard', params: { workspaceId } })
}
</script>

<style scoped lang="scss">
.mobile-nav {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  min-height: var(--mobile-nav-height);
  padding: 0.35rem max(0.65rem, env(safe-area-inset-right)) env(safe-area-inset-bottom)
    max(0.65rem, env(safe-area-inset-left));
  border-top: 1px solid var(--color-line);
  background: rgb(255 255 255 / 96%);
  backdrop-filter: blur(16px);
}

.nav-button {
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 0.2rem;
  border: 0;
  background: transparent;
  color: var(--color-copy);
  font-size: 0.72rem;
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
