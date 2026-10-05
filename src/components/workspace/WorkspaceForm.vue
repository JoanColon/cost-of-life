<template>
  <q-card flat class="workspace-card">
    <q-card-section class="q-pa-none">
      <div class="eyebrow">
        {{ firstWorkspace ? t('workspace.firstEyebrow') : t('workspace.newEyebrow') }}
      </div>
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
          :hint="t('workspace.nameHint')"
          maxlength="60"
          lazy-rules
          :rules="nameRules"
        >
          <template #prepend><q-icon name="account_balance_wallet" /></template>
        </q-input>

        <q-toggle
          v-model="wantsToShare"
          color="primary"
          :label="t('workspace.shareQuestion')"
          @update:model-value="clearInviteEmail"
        />

        <q-slide-transition>
          <div v-if="wantsToShare">
            <q-input
              v-model.trim="inviteEmail"
              outlined
              type="email"
              :label="t('workspace.inviteEmail')"
              :hint="t('workspace.inviteHint')"
              autocomplete="email"
              lazy-rules
              :rules="inviteEmailRules"
            >
              <template #prepend><q-icon name="person_add_alt" /></template>
            </q-input>
          </div>
        </q-slide-transition>

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
const wantsToShare = ref(false)
const inviteEmail = ref('')
const loading = ref(false)
const errorMessage = ref('')

const nameRules = [
  (value) => Boolean(value) || t('workspace.validation.nameRequired'),
  (value) => value.length <= 60 || t('workspace.validation.nameLength'),
]
const inviteEmailRules = [
  (value) => Boolean(value) || t('workspace.validation.emailRequired'),
  (value) => /.+@.+\..+/.test(value) || t('workspace.validation.emailInvalid'),
]

async function submit() {
  if (!authUser.value) return

  loading.value = true
  errorMessage.value = ''

  try {
    const workspace = await workspaceStore.create({
      name: name.value,
      inviteEmail: wantsToShare.value ? inviteEmail.value : null,
      user: authUser.value,
    })

    emit('created', {
      workspace,
      hasPendingInvite: wantsToShare.value,
    })
  } catch {
    errorMessage.value = t('workspace.errors.create')
  } finally {
    loading.value = false
  }
}

function clearInviteEmail(value) {
  if (!value) inviteEmail.value = ''
}
</script>

<style scoped lang="scss">
.workspace-card {
  width: 100%;
  max-width: 36rem;
  padding: clamp(1.75rem, 5vw, 3rem);
  border: 1px solid rgba(40, 91, 72, 0.1);
  border-radius: 1.5rem;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 24px 70px rgba(31, 48, 42, 0.1);
}

.eyebrow {
  color: #477763;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

h1 {
  margin: 0.45rem 0 0;
  color: #1c2c26;
  font-family: Georgia, serif;
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 500;
  line-height: 1.08;
  letter-spacing: -0.035em;
}

.description {
  margin: 1rem 0 0;
  color: #68736f;
  font-size: 1rem;
  line-height: 1.65;
}

.error-banner {
  background: #fff0ef;
  color: #7d2823;
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
