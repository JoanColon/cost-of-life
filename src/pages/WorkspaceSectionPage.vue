<template>
  <q-page class="section-page">
    <main class="section-content">
      <q-btn
        flat
        dense
        no-caps
        color="grey-7"
        icon="arrow_back"
        :label="t('navigation.backToWorkspaceHome')"
        :to="workspaceHomeRoute"
        class="back-button"
      />
      <h1>{{ sectionTitle }}</h1>
    </main>
  </q-page>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

const { t } = useI18n()
const route = useRoute()

const workspaceHomeRoute = computed(() => ({
  name: 'workspace-dashboard',
  params: { workspaceId: route.params.workspaceId },
}))
const sectionTitle = computed(() => t(route.meta.sectionTitleKey))
</script>

<style scoped lang="scss">
.section-page {
  min-height: calc(100vh - 64px);
  min-height: calc(100dvh - 64px);
  padding: clamp(1.5rem, 5vw, 4rem);
  background: var(--color-page);
}

.section-content {
  width: 100%;
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.back-button {
  min-height: 2rem;
  margin: 0 0 1rem -0.5rem;
  padding: 0 0.5rem;
  font-size: 0.78rem;
}

h1 {
  margin: 0;
  color: var(--color-ink);
  font-size: clamp(2.25rem, 5vw, 4rem);
  letter-spacing: -0.05em;
}
</style>
