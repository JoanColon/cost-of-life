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

      <q-form v-if="workspace" class="settings-form" @submit.prevent="save">
        <section class="settings-card">
          <div class="section-heading">
            <span class="section-icon"><q-icon name="group" /></span>
            <div>
              <h2>{{ t('setup.members.title') }}</h2>
              <p>{{ t('setup.members.description') }}</p>
            </div>
          </div>

          <div class="member-list">
            <label v-for="member in members" :key="member.id" class="member-field">
              <span class="member-avatar">{{ memberInitial(member.name) }}</span>
              <span class="member-input">
                <span>{{ t('setup.members.name') }}</span>
                <q-input
                  v-model.trim="memberNames[member.id]"
                  outlined
                  dense
                  hide-bottom-space
                  maxlength="80"
                  :rules="[
                    (value) =>
                      Boolean(String(value || '').trim()) || t('setup.members.nameRequired'),
                  ]"
                />
              </span>
            </label>
          </div>
        </section>

        <section class="settings-card">
          <div class="section-heading">
            <span class="section-icon"><q-icon name="payments" /></span>
            <div>
              <h2>{{ t('setup.currency.title') }}</h2>
              <p>{{ t('setup.currency.description') }}</p>
            </div>
          </div>

          <div class="currency-field">
            <label>{{ t('setup.currency.label') }}</label>
            <q-select
              v-model="currency"
              outlined
              dense
              emit-value
              map-options
              :options="currencyOptions"
            />
            <small>{{ t('setup.currency.noConversion') }}</small>
          </div>
        </section>

        <div class="form-actions">
          <q-btn
            unelevated
            no-caps
            color="primary"
            type="submit"
            icon="save"
            :label="t('common.save')"
            :loading="saving"
            :disable="!hasChanges"
          />
        </div>
      </q-form>
    </main>
  </q-page>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useWorkspaceStore } from '@/stores/workspace-store'

const currencies = [
  'EUR',
  'USD',
  'GBP',
  'CHF',
  'CAD',
  'AUD',
  'NZD',
  'JPY',
  'SEK',
  'NOK',
  'DKK',
  'PLN',
]

const $q = useQuasar()
const { t } = useI18n()
const route = useRoute()
const workspaceStore = useWorkspaceStore()
const saving = ref(false)
const currency = ref('EUR')
const memberNames = ref({})

const workspaceId = computed(() => String(route.params.workspaceId))
const workspace = computed(
  () => workspaceStore.workspaces.find((candidate) => candidate.id === workspaceId.value) || null,
)
const members = computed(() =>
  (workspace.value?.memberIds || []).map((id) => ({
    id,
    name: workspace.value?.members?.[id]?.displayName || t('setup.members.fallbackName'),
  })),
)
const currencyOptions = computed(() =>
  currencies.map((code) => ({
    value: code,
    label: `${code} · ${currencyName(code)}`,
  })),
)
const homeRoute = computed(() => ({
  name: 'workspace-dashboard',
  params: { workspaceId: workspaceId.value },
}))
const hasChanges = computed(() => {
  if (!workspace.value) return false
  if (currency.value !== (workspace.value.currency || 'EUR')) return true
  return members.value.some(
    (member) => String(memberNames.value[member.id] || '').trim() !== member.name,
  )
})

watch(workspace, reset, { immediate: true })

function reset(value) {
  currency.value = value?.currency || 'EUR'
  memberNames.value = Object.fromEntries(
    (value?.memberIds || []).map((id) => [
      id,
      value?.members?.[id]?.displayName || t('setup.members.fallbackName'),
    ]),
  )
}

async function save() {
  if (saving.value || !hasChanges.value) return
  saving.value = true
  try {
    await workspaceStore.updateSettings(workspaceId.value, {
      currency: currency.value,
      memberNames: Object.fromEntries(
        Object.entries(memberNames.value).map(([id, name]) => [id, String(name).trim()]),
      ),
    })
    $q.notify({ type: 'positive', message: t('setup.saved'), position: 'top' })
  } catch {
    $q.notify({ type: 'negative', message: t('setup.saveError'), position: 'top' })
  } finally {
    saving.value = false
  }
}

function memberInitial(name) {
  return (
    String(name || '?')
      .trim()
      .charAt(0)
      .toUpperCase() || '?'
  )
}

function currencyName(code) {
  try {
    return new Intl.DisplayNames(['en'], { type: 'currency' }).of(code) || code
  } catch {
    return code
  }
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;

.setup-page {
  @include financial-page;
}

.setup-shell {
  @include financial-shell;
  max-width: 50rem;
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

.settings-form {
  display: grid;
  gap: 1rem;
}

.settings-card {
  padding: clamp(1rem, 3vw, 1.5rem);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.section-heading {
  display: flex;
  gap: 0.9rem;
  align-items: flex-start;
}

.section-icon,
.member-avatar {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 50%;
  background: var(--color-blue-soft);
  color: var(--color-primary);
}

.section-icon {
  width: 2.75rem;
  height: 2.75rem;
  font-size: 1.25rem;
}

.section-heading h2 {
  margin: 0;
  font-size: 1.15rem;
}

.section-heading p {
  margin: 0.25rem 0 0;
  color: var(--color-copy);
  font-size: 0.85rem;
}

.member-list {
  display: grid;
  gap: 0.85rem;
  margin-top: 1.25rem;
}

.member-field {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.75rem;
  align-items: center;
}

.member-avatar {
  width: 2.4rem;
  height: 2.4rem;
  font-weight: 750;
}

.member-input > span,
.currency-field > label {
  display: block;
  margin-bottom: 0.35rem;
  color: var(--color-ink-soft);
  font-size: 0.78rem;
  font-weight: 700;
}

.currency-field {
  max-width: 24rem;
  margin-top: 1.25rem;
}

.currency-field small {
  display: block;
  margin-top: 0.5rem;
  color: var(--color-muted);
  font-size: 0.75rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 699px) {
  .settings-card {
    border-radius: var(--radius-md);
  }
}
</style>
