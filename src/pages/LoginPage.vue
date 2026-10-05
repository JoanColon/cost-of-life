<template>
  <q-layout view="lHh Lpr lFf" class="auth-layout">
    <q-page-container>
      <q-page class="auth-page">
        <section class="auth-intro">
          <div class="brand-mark" aria-hidden="true">C</div>
          <div>
            <div class="brand-name">Cost of Life</div>
            <p class="brand-copy">{{ t('auth.brandMessage') }}</p>
          </div>
        </section>

        <q-card flat class="auth-card">
          <q-card-section class="q-pa-none">
            <div class="eyebrow">{{ t('auth.welcome') }}</div>
            <h1>{{ isRegistering ? t('auth.registerTitle') : t('auth.signInTitle') }}</h1>
            <p class="auth-subtitle">
              {{ isRegistering ? t('auth.registerSubtitle') : t('auth.signInSubtitle') }}
            </p>
          </q-card-section>

          <q-card-section class="q-pa-none q-mt-lg">
            <q-form class="q-gutter-md" @submit="submitEmail">
              <q-input
                v-model.trim="email"
                outlined
                type="email"
                :label="t('common.email')"
                autocomplete="email"
                lazy-rules
                :rules="emailRules"
              >
                <template #prepend><q-icon name="mail_outline" /></template>
              </q-input>

              <q-input
                v-model="password"
                outlined
                :type="showPassword ? 'text' : 'password'"
                :label="t('auth.password')"
                :autocomplete="isRegistering ? 'new-password' : 'current-password'"
                lazy-rules
                :rules="passwordRules"
              >
                <template #prepend><q-icon name="lock_outline" /></template>
                <template #append>
                  <q-btn
                    flat
                    round
                    dense
                    :icon="showPassword ? 'visibility_off' : 'visibility'"
                    :aria-label="showPassword ? t('auth.hidePassword') : t('auth.showPassword')"
                    @click="showPassword = !showPassword"
                  />
                </template>
              </q-input>

              <div v-if="!isRegistering" class="text-right forgot-row">
                <q-btn
                  flat
                  dense
                  no-caps
                  color="primary"
                  :label="t('auth.forgotPassword')"
                  :disable="Boolean(loading)"
                  @click="recoverPassword"
                />
              </div>

              <q-banner v-if="errorMessage" rounded class="error-banner">
                <template #avatar><q-icon name="error_outline" color="negative" /></template>
                {{ errorMessage }}
              </q-banner>

              <q-btn
                unelevated
                no-caps
                size="md"
                color="primary"
                class="full-width auth-submit"
                type="submit"
                :label="isRegistering ? t('auth.register') : t('auth.signIn')"
                :loading="loading === 'email'"
                :disable="Boolean(loading)"
              />
            </q-form>

            <div class="separator">
              <span>{{ t('auth.orContinueWith') }}</span>
            </div>

            <q-btn
              outline
              no-caps
              class="full-width google-button"
              :loading="loading === 'google'"
              :disable="Boolean(loading)"
              @click="submitGoogle"
            >
              <span class="google-g" aria-hidden="true">G</span>
              {{ t('auth.continueWithGoogle') }}
            </q-btn>

            <p class="switch-mode">
              {{ isRegistering ? t('auth.hasAccount') : t('auth.needsAccount') }}
              <q-btn
                flat
                dense
                no-caps
                color="primary"
                :label="isRegistering ? t('auth.switchToSignIn') : t('auth.switchToRegister')"
                :disable="Boolean(loading)"
                @click="toggleMode"
              />
            </p>
          </q-card-section>
        </q-card>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import {
  createAccount,
  finishGoogleRedirect,
  sendPasswordReset,
  signIn,
  signInWithGoogle,
} from '@/services/auth'

const $q = useQuasar()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const isRegistering = ref(false)
const loading = ref(false)
const errorMessage = ref('')

const emailRules = [
  (value) => Boolean(value) || t('auth.validation.emailRequired'),
  (value) => /.+@.+\..+/.test(value) || t('auth.validation.emailInvalid'),
]
const passwordRules = [
  (value) => Boolean(value) || t('auth.validation.passwordRequired'),
  (value) => value.length >= 6 || t('auth.validation.passwordLength'),
]

onMounted(async () => {
  try {
    const result = await finishGoogleRedirect()
    if (result) await goToDestination()
  } catch (error) {
    errorMessage.value = getAuthErrorMessage(error)
  }
})

async function submitEmail() {
  errorMessage.value = ''
  loading.value = 'email'

  try {
    if (isRegistering.value) {
      await createAccount(email.value, password.value)
    } else {
      await signIn(email.value, password.value)
    }

    await goToDestination()
  } catch (error) {
    errorMessage.value = getAuthErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function submitGoogle() {
  errorMessage.value = ''
  loading.value = 'google'

  try {
    const redirect = $q.platform.is.mobile && !$q.platform.is.capacitor
    await signInWithGoogle({ redirect })
    if (!redirect) await goToDestination()
  } catch (error) {
    errorMessage.value = getAuthErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function recoverPassword() {
  errorMessage.value = ''

  if (!/.+@.+\..+/.test(email.value)) {
    errorMessage.value = t('auth.validation.resetEmail')
    return
  }

  loading.value = 'reset'

  try {
    await sendPasswordReset(email.value)
    $q.notify({
      type: 'positive',
      message: t('auth.resetSent'),
      position: 'top',
    })
  } catch (error) {
    errorMessage.value = getAuthErrorMessage(error)
  } finally {
    loading.value = false
  }
}

function toggleMode() {
  isRegistering.value = !isRegistering.value
  errorMessage.value = ''
}

async function goToDestination() {
  const destination =
    typeof route.query.redirect === 'string' ? route.query.redirect : { name: 'home' }
  await router.replace(destination)
}

function getAuthErrorMessage(error) {
  const messages = {
    'auth/email-already-in-use': t('auth.errors.emailInUse'),
    'auth/invalid-credential': t('auth.errors.invalidCredential'),
    'auth/invalid-email': t('auth.errors.invalidEmail'),
    'auth/popup-closed-by-user': t('auth.errors.popupClosed'),
    'auth/popup-blocked': t('auth.errors.popupBlocked'),
    'auth/operation-not-allowed': t('auth.errors.providerDisabled'),
    'auth/too-many-requests': t('auth.errors.tooManyRequests'),
    'auth/unauthorized-domain': t('auth.errors.unauthorizedDomain'),
    'auth/weak-password': t('auth.errors.weakPassword'),
  }

  return messages[error?.code] || t('auth.errors.generic')
}
</script>

<style scoped lang="scss">
.auth-layout {
  background:
    radial-gradient(circle at 12% 12%, rgba(66, 121, 99, 0.18), transparent 34rem), #f5f3ec;
}

.auth-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  grid-template-columns: minmax(18rem, 1fr) minmax(22rem, 32rem);
  align-items: center;
  gap: clamp(3rem, 10vw, 10rem);
  max-width: 74rem;
  margin: 0 auto;
  padding: 3rem;
}

.auth-intro {
  display: flex;
  align-items: flex-start;
  gap: 1.25rem;
  color: #18362c;
}

.brand-mark {
  display: grid;
  place-items: center;
  flex: 0 0 3.75rem;
  width: 3.75rem;
  height: 3.75rem;
  border-radius: 1.15rem;
  background: #285b48;
  color: #fff;
  font-family: Georgia, serif;
  font-size: 2rem;
  box-shadow: 0 14px 30px rgba(30, 72, 56, 0.22);
}

.brand-name {
  font-family: Georgia, serif;
  font-size: clamp(2.25rem, 5vw, 4.5rem);
  line-height: 1;
  letter-spacing: -0.04em;
}

.brand-copy {
  max-width: 31rem;
  margin: 1.5rem 0 0;
  color: #53635d;
  font-size: 1.15rem;
  line-height: 1.7;
}

.auth-card {
  padding: clamp(1.75rem, 5vw, 3rem);
  border: 1px solid rgba(34, 70, 57, 0.1);
  border-radius: 1.5rem;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 24px 70px rgba(31, 48, 42, 0.12);
  backdrop-filter: blur(10px);
}

.eyebrow {
  color: #477763;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

h1 {
  margin: 0.35rem 0 0;
  color: #1c2c26;
  font-family: Georgia, serif;
  font-size: 2.15rem;
  font-weight: 500;
  letter-spacing: -0.025em;
}

.auth-subtitle {
  margin: 0.55rem 0 0;
  color: #68736f;
}

.forgot-row {
  margin-top: -0.75rem;
}

.error-banner {
  background: #fff0ef;
  color: #7d2823;
  font-size: 0.9rem;
}

.auth-submit {
  min-height: 3.25rem;
  border-radius: 0.75rem;
  font-weight: 600;
}

.separator {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 1.6rem 0;
  color: #87908d;
  font-size: 0.8rem;
}

.separator::before,
.separator::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #e0e4e1;
}

.google-button {
  min-height: 3.25rem;
  border-radius: 0.75rem;
  color: #263c34;
}

.google-g {
  margin-right: 0.8rem;
  color: #4285f4;
  font-size: 1.25rem;
  font-weight: 800;
}

.switch-mode {
  margin: 1.5rem 0 0;
  color: #68736f;
  text-align: center;
}

@media (max-width: 800px) {
  .auth-page {
    grid-template-columns: 1fr;
    gap: 2.5rem;
    padding-top: max(2rem, env(safe-area-inset-top));
    padding-right: max(1rem, env(safe-area-inset-right));
    padding-bottom: max(2rem, env(safe-area-inset-bottom));
    padding-left: max(1rem, env(safe-area-inset-left));
  }

  .auth-intro {
    max-width: 32rem;
    margin: 0 auto;
  }

  .brand-name {
    font-size: 2.5rem;
  }

  .brand-copy {
    display: none;
  }

  .auth-card {
    width: 100%;
    max-width: 32rem;
    margin: 0 auto;
  }
}

@media (max-width: 420px) {
  .auth-page {
    gap: 1.5rem;
  }

  .auth-intro {
    align-items: center;
    gap: 0.9rem;
  }

  .brand-mark {
    flex-basis: 3rem;
    width: 3rem;
    height: 3rem;
    border-radius: 0.9rem;
    font-size: 1.6rem;
  }

  .brand-name {
    font-size: 2rem;
  }

  .auth-card {
    padding: 1.35rem;
    border-radius: 1.15rem;
  }

  h1 {
    font-size: 1.9rem;
  }
}
</style>
