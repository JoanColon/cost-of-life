<template>
  <q-page class="new-workspace-page">
    <WorkspaceForm
      show-cancel
      @created="workspaceCreated"
      @cancel="router.push({ name: 'home' })"
    />
  </q-page>
</template>

<script setup>
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import WorkspaceForm from '@/components/workspace/WorkspaceForm.vue'

const $q = useQuasar()
const { t } = useI18n()
const router = useRouter()

async function workspaceCreated({ workspace, hasPendingInvite }) {
  $q.notify({
    type: 'positive',
    message: hasPendingInvite ? t('workspace.pendingInvite') : t('workspace.created'),
    position: 'top',
  })
  await router.replace({ name: 'workspace-dashboard', params: { workspaceId: workspace.id } })
}
</script>

<style scoped lang="scss">
.new-workspace-page {
  display: grid;
  place-items: center;
  min-height: calc(100vh - 64px);
  min-height: calc(100dvh - 64px);
  padding: clamp(1rem, 5vw, 3rem);
  padding-right: max(clamp(1rem, 5vw, 3rem), env(safe-area-inset-right));
  padding-bottom: max(clamp(1rem, 5vw, 3rem), env(safe-area-inset-bottom));
  padding-left: max(clamp(1rem, 5vw, 3rem), env(safe-area-inset-left));
  background: #f5f3ec;
}

@media (max-width: 700px) {
  .new-workspace-page {
    min-height: calc(100dvh - 56px - env(safe-area-inset-top));
  }
}
</style>
