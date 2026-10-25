<template>
  <q-card flat class="workspace-card">
    <q-card-section class="q-pa-none">
      <h1>{{ firstWorkspace ? t('workspace.firstTitle') : t('workspace.newTitle') }}</h1>
      <p class="description">
        {{ firstWorkspace ? t('workspace.firstDescription') : t('workspace.newDescription') }}
      </p>
    </q-card-section>

    <q-card-section class="q-pa-none q-mt-xl">
      <q-form class="q-gutter-lg" @submit="submit">
        <q-input
          v-model.trim="name"
          outlined
          autofocus
          :label="t('workspace.name')"
          maxlength="60"
          lazy-rules
          :rules="nameRules"
        >
          <template #prepend><q-icon name="account_balance_wallet" /></template>
        </q-input>

        <q-banner v-if="errorMessage" rounded class="error-banner">
          <template #avatar><q-icon name="error_outline" color="negative" /></template>
          {{ errorMessage }}
        </q-banner>

        <div class="form-actions">
          <q-btn
            v-if="showCancel"
            flat
            no-caps
            :label="t('common.cancel')"
            :disable="loading"
            @click="emit('cancel')"
          />
          <q-btn
            unelevated
            no-caps
            color="primary"
            class="create-button"
            type="submit"
            :label="t('workspace.create')"
            :loading="loading"
          />
        </div>
      </q-form>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { authUser } from '@/services/auth'

defineProps({
  firstWorkspace: {
    type: Boolean,
    default: false,
  },
  showCancel: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['created', 'cancel'])
const { t } = useI18n()
const workspaceStore = useWorkspaceStore()

const name = ref('')
const loading = ref(false)
const errorMessage = ref('')

const nameRules = [
  (value) => Boolean(value) || t('workspace.validation.nameRequired'),
  (value) => value.length <= 60 || t('workspace.validation.nameLength'),
]
async function submit() {
  if (!authUser.value) return

  loading.value = true
  errorMessage.value = ''

  try {
    const workspace = await workspaceStore.create({ name: name.value })

    emit('created', { workspace })
  } catch {
    errorMessage.value = t('workspace.errors.create')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
.workspace-card {
  width: 100%;
  max-width: 36rem;
  padding: clamp(1.75rem, 5vw, 3rem);
  border: 1px solid var(--color-line);
  border-radius: 1.5rem;
  background: var(--color-surface-raised);
  box-shadow: var(--shadow-dialog);
}

h1 {
  margin: 0;
  color: var(--color-ink);
  font-family: var(--font-family-display);
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 500;
  line-height: 1.08;
  letter-spacing: -0.035em;
}

.description {
  margin: 1rem 0 0;
  color: var(--color-copy);
  font-size: 1rem;
  line-height: 1.65;
}

.error-banner {
  background: var(--color-red-soft);
  color: var(--color-danger-dark);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.create-button {
  min-height: 3rem;
  min-width: 10rem;
  border-radius: 0.75rem;
  font-weight: 600;
}

@media (max-width: 480px) {
  .workspace-card {
    padding: 1.35rem;
    border-radius: 1.15rem;
  }

  .form-actions {
    flex-direction: column-reverse;
  }

  .form-actions .q-btn,
  .create-button {
    width: 100%;
    min-height: 3rem;
  }
}
</style>
