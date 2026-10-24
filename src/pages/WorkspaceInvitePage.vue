<template>
  <q-layout view="lHh Lpr lFf" class="invite-layout">
    <q-page-container>
      <q-page class="invite-page">
        <q-card flat class="invite-card">
          <div class="brand-mark" aria-hidden="true">C</div>

          <q-card-section v-if="loading" class="invite-state">
            <q-spinner color="primary" size="2.5rem" />
            <p>{{ t('workspace.invitePage.loading') }}</p>
          </q-card-section>

          <template v-else-if="invite">
            <q-card-section class="q-pa-none">
              <p class="eyebrow">{{ t('workspace.invitePage.eyebrow') }}</p>
              <h1>{{ t('workspace.invitePage.title') }}</h1>
              <p class="workspace-name">{{ invite.workspaceName }}</p>
              <p class="description">
                {{ t('workspace.invitePage.description') }}
              </p>
            </q-card-section>

            <q-card-section class="q-pa-none q-mt-xl">
              <q-banner v-if="acceptError" rounded class="error-banner">
                <template #avatar><q-icon name="error_outline" color="negative" /></template>
                {{ acceptError }}
              </q-banner>

              <q-btn
                unelevated
                no-caps
                color="primary"
                class="full-width join-button"
                :label="joinLabel"
                :loading="joining"
                @click="continueInvite"
              />
            </q-card-section>
          </template>

          <q-card-section v-else class="q-pa-none">
            <q-icon name="link_off" size="3rem" color="grey-6" />
            <h1 class="error-title">{{ t('workspace.invitePage.unavailableTitle') }}</h1>
            <p class="description">{{ loadError }}</p>
            <q-btn
              flat
              no-caps
              color="primary"
              :label="t('workspace.invitePage.goHome')"
              class="q-mt-md"
              :to="authUser ? { name: 'home' } : { name: 'login' }"
            />
          </q-card-section>
        </q-card>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { authUser } from '@/services/auth'
import { acceptWorkspaceInvite, getWorkspaceInvite } from '@/services/firebase/workspace.service'
import { useWorkspaceStore } from '@/stores/workspace-store'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const workspaceStore = useWorkspaceStore()
const invite = ref(null)
const loading = ref(true)
const joining = ref(false)
const loadError = ref('')
const acceptError = ref('')
const token = computed(() => String(route.params.token || ''))
const joinLabel = computed(() =>
  authUser.value ? t('workspace.invitePage.join') : t('workspace.invitePage.signInToJoin'),
)

onMounted(loadInvite)

async function loadInvite() {
  loading.value = true
  loadError.value = ''
  try {
    invite.value = await getWorkspaceInvite(token.value)
  } catch (error) {
    loadError.value = inviteErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function continueInvite() {
  if (!authUser.value) {
    await router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }

  joining.value = true
  acceptError.value = ''
  try {
    const result = await acceptWorkspaceInvite(token.value)
    await workspaceStore.load(authUser.value, true)
    await workspaceStore.setActiveWorkspace(result.workspaceId)
    await router.replace({
      name: 'workspace-dashboard',
      params: { workspaceId: result.workspaceId },
    })
  } catch (error) {
    acceptError.value = inviteErrorMessage(error)
  } finally {
    joining.value = false
  }
}

function inviteErrorMessage(error) {
  const code = String(error?.code || '').replace('functions/', '')
  const messages = {
    'deadline-exceeded': t('workspace.invitePage.errors.expired'),
    'failed-precondition': t('workspace.invitePage.errors.used'),
    'invalid-argument': t('workspace.invitePage.errors.invalid'),
    'not-found': t('workspace.invitePage.errors.invalid'),
    unauthenticated: t('workspace.invitePage.errors.signIn'),
  }
  return messages[code] || t('workspace.invitePage.errors.generic')
}
</script>

<style scoped lang="scss">
.invite-layout {
  background:
    radial-gradient(circle at 12% 12%, rgba(66, 121, 99, 0.18), transparent 34rem), #f5f3ec;
}

.invite-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: max(1.25rem, env(safe-area-inset-top)) max(1.25rem, env(safe-area-inset-right))
    max(1.25rem, env(safe-area-inset-bottom)) max(1.25rem, env(safe-area-inset-left));
}

.invite-card {
  width: min(100%, 34rem);
  padding: clamp(1.75rem, 6vw, 3.25rem);
  border: 1px solid rgba(40, 91, 72, 0.1);
  border-radius: 1.5rem;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 24px 70px rgba(31, 48, 42, 0.1);
  text-align: center;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  margin: 0 auto 2rem;
  border-radius: 0.85rem;
  background: var(--color-primary);
  color: white;
  font-family: Georgia, serif;
  font-size: 1.5rem;
}

.eyebrow {
  margin: 0 0 0.65rem;
  color: var(--color-primary);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  color: var(--color-ink);
  font-family: Georgia, serif;
  font-size: clamp(2rem, 7vw, 3rem);
  font-weight: 500;
  line-height: 1.08;
  letter-spacing: -0.035em;
}

.workspace-name {
  margin: 0.75rem 0 0;
  color: var(--color-primary);
  font-size: clamp(1.35rem, 4vw, 1.8rem);
  font-weight: 700;
}

.description,
.invite-state p {
  margin: 1rem 0 0;
  color: var(--color-copy);
  line-height: 1.6;
}

.join-button {
  min-height: 3.1rem;
  border-radius: 0.75rem;
  font-weight: 600;
}

.error-banner {
  margin-bottom: 1rem;
  background: #fff0ef;
  color: #7d2823;
  text-align: left;
}

.invite-state {
  min-height: 12rem;
  display: grid;
  place-content: center;
  justify-items: center;
}

.error-title {
  margin-top: 1rem;
  font-size: 2rem;
}
</style>
