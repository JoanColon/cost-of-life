<template>
  <q-page class="portfolio-page">
    <main class="portfolio-shell">
      <div v-if="loading" class="page-state">
        <q-spinner color="primary" size="2rem" />
        <span>{{ t('assets.portfolio.loading') }}</span>
      </div>

      <section v-else-if="error" class="page-state error-state">
        <q-icon name="cloud_off" />
        <h1>{{ t('assets.portfolio.errors.loadTitle') }}</h1>
        <p>{{ t('assets.portfolio.errors.load') }}</p>
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon="refresh"
          :label="t('common.retry')"
          @click="prepare(true)"
        />
      </section>

      <template v-else-if="investment">
        <header class="portfolio-header">
          <div>
            <q-btn
              flat
              dense
              no-caps
              color="grey-7"
              icon="arrow_back"
              :label="t('assets.portfolio.backToInvestments')"
              :to="investmentsRoute"
              class="back-button"
            />
            <span class="eyebrow">{{ t('assets.portfolio.eyebrow') }}</span>
            <h1>{{ investment.itemName }}</h1>
          </div>
        </header>

        <section v-if="!configured || editing" class="setup-card">
          <span class="setup-icon"><q-icon name="table_view" /></span>
          <div class="setup-copy">
            <h2>
              {{ t(configured ? 'assets.portfolio.changeTitle' : 'assets.portfolio.connectTitle') }}
            </h2>
            <p>{{ t('assets.portfolio.connectDescription') }}</p>
          </div>

          <q-btn
            outline
            no-caps
            color="primary"
            icon="content_copy"
            :label="t('assets.portfolio.copyTemplate')"
            :href="templateCopyUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="template-button"
          />

          <div class="form-separator">
            <span>{{ t('assets.portfolio.thenConnect') }}</span>
          </div>

          <q-form class="sheet-form" @submit="save">
            <q-input
              v-model="spreadsheetUrl"
              outlined
              type="url"
              :label="t('assets.portfolio.sheetUrl')"
              :placeholder="t('assets.portfolio.sheetUrlPlaceholder')"
              :rules="sheetUrlRules"
              lazy-rules
              hide-bottom-space
              autocomplete="url"
            >
              <template #prepend><q-icon name="link" /></template>
            </q-input>
            <div class="form-actions">
              <q-btn
                v-if="configured"
                flat
                no-caps
                :label="t('common.cancel')"
                @click="cancelEditing"
              />
              <q-btn
                unelevated
                no-caps
                color="primary"
                icon-right="arrow_forward"
                :label="t('assets.portfolio.connect')"
                type="submit"
                :loading="saving"
              />
            </div>
          </q-form>
        </section>

        <template v-else>
          <section class="source-card">
            <div class="source-main">
              <span class="source-icon"><q-icon name="table_view" /></span>
              <div>
                <span class="connected-label">
                  <q-icon name="check_circle" />
                  {{ t('assets.portfolio.connected') }}
                </span>
                <h2>{{ t('assets.portfolio.sourceTitle') }}</h2>
                <p>{{ sheetDisplayUrl }}</p>
              </div>
            </div>
            <q-btn
              unelevated
              no-caps
              color="primary"
              :label="t('assets.portfolio.openSheet')"
              :href="portfolio.spreadsheetUrl"
              target="_blank"
              rel="noopener noreferrer"
            />
          </section>

          <section class="portfolio-placeholder">
            <span class="placeholder-icon"><q-icon name="query_stats" /></span>
            <h2>{{ t('assets.portfolio.portfolioTitle') }}</h2>
            <p>{{ t('assets.portfolio.comingSoon') }}</p>
            <q-btn
              outline
              no-caps
              color="primary"
              icon="grid_on"
              :label="t('assets.portfolio.readA1')"
              :loading="readingA1"
              class="read-cell-button"
              @click="readA1"
            />
            <output v-if="cellA1 !== null" class="cell-result">
              <small>{{ t('assets.portfolio.cellA1') }}</small>
              <strong>{{ cellA1 || t('assets.portfolio.emptyCell') }}</strong>
            </output>
            <p v-if="cellError" class="cell-error">{{ t('assets.portfolio.errors.readCell') }}</p>
          </section>

          <div class="secondary-actions">
            <q-btn
              flat
              no-caps
              color="primary"
              icon="edit"
              :label="t('assets.portfolio.changeSheet')"
              @click="startEditing"
            />
            <q-btn
              flat
              no-caps
              color="negative"
              icon="link_off"
              :label="t('assets.portfolio.disconnect')"
              @click="confirmDisconnect = true"
            />
          </div>
        </template>
      </template>
    </main>

    <q-dialog v-model="confirmDisconnect">
      <q-card class="confirm-card">
        <q-card-section>
          <h2>{{ t('assets.portfolio.disconnectTitle') }}</h2>
          <p>{{ t('assets.portfolio.disconnectDescription') }}</p>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps :label="t('common.cancel')" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="negative"
            :label="t('assets.portfolio.disconnect')"
            :loading="saving"
            @click="disconnect"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import {
  isGoogleSheetsUrl,
  readInvestmentPortfolioA1,
} from '@/services/firebase/investment-portfolios.service'
import { useAssetsStore } from '@/stores/assets-store'

const templateCopyUrl =
  'https://docs.google.com/spreadsheets/d/1YZKLerZRbcNDryHZs-Zs5YeybJKSGVEoyb_4bKpnysg/copy'

const $q = useQuasar()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const assetsStore = useAssetsStore()
const preparing = ref(false)
const pageError = ref(null)
const saving = ref(false)
const editing = ref(false)
const spreadsheetUrl = ref('')
const confirmDisconnect = ref(false)
const readingA1 = ref(false)
const cellA1 = ref(null)
const cellError = ref(false)
let preparationId = 0

const workspaceId = computed(() => String(route.params.workspaceId))
const assetId = computed(() => String(route.params.assetId))
const investmentsRoute = computed(() => ({
  name: 'asset-category',
  params: { workspaceId: workspaceId.value, category: 'investment' },
}))
const investment = computed(() =>
  assetsStore.itemsForCategory('investment').find((asset) => asset.id === assetId.value),
)
const portfolio = computed(() => investment.value?.detail?.portfolio || null)
const configured = computed(() => Boolean(portfolio.value?.spreadsheetUrl))
const loading = computed(
  () => preparing.value || assetsStore.loading || assetsStore.categoryLoading,
)
const error = computed(() => pageError.value || assetsStore.error)
const sheetDisplayUrl = computed(() => {
  try {
    const url = new URL(portfolio.value.spreadsheetUrl)
    return `${url.hostname}${url.pathname}`
  } catch {
    return portfolio.value?.spreadsheetUrl || ''
  }
})
const sheetUrlRules = [
  (value) => Boolean(String(value || '').trim()) || t('assets.portfolio.errors.urlRequired'),
  (value) => isGoogleSheetsUrl(value) || t('assets.portfolio.errors.urlInvalid'),
]

watch([workspaceId, assetId], () => prepare(), { immediate: true })

async function prepare(force = false) {
  const currentPreparation = ++preparationId
  preparing.value = true
  pageError.value = null

  try {
    await assetsStore.loadConfig(workspaceId.value, force)
    if (currentPreparation !== preparationId) return

    const investmentConfig = assetsStore.config?.categories?.investment
    if (!assetsStore.setupCompleted || !investmentConfig?.enabled) {
      await router.replace({ name: 'assets', params: { workspaceId: workspaceId.value } })
      return
    }

    await assetsStore.loadCategory(workspaceId.value, 'investment', force)
    if (currentPreparation !== preparationId) return
    if (!investment.value) await router.replace(investmentsRoute.value)
  } catch (loadError) {
    pageError.value = loadError
  } finally {
    if (currentPreparation === preparationId) preparing.value = false
  }
}

function startEditing() {
  clearCellResult()
  spreadsheetUrl.value = portfolio.value?.spreadsheetUrl || ''
  editing.value = true
}

function cancelEditing() {
  spreadsheetUrl.value = ''
  editing.value = false
}

async function save() {
  if (saving.value || !isGoogleSheetsUrl(spreadsheetUrl.value)) return
  saving.value = true
  try {
    await assetsStore.saveInvestmentPortfolio(
      workspaceId.value,
      assetId.value,
      spreadsheetUrl.value,
    )
    editing.value = false
    spreadsheetUrl.value = ''
    $q.notify({ type: 'positive', message: t('assets.portfolio.saved'), position: 'top' })
  } catch {
    $q.notify({ type: 'negative', message: t('assets.portfolio.errors.save'), position: 'top' })
  } finally {
    saving.value = false
  }
}

async function disconnect() {
  if (saving.value) return
  saving.value = true
  try {
    await assetsStore.disconnectInvestmentPortfolio(workspaceId.value, assetId.value)
    clearCellResult()
    confirmDisconnect.value = false
    spreadsheetUrl.value = ''
    $q.notify({ type: 'positive', message: t('assets.portfolio.disconnected'), position: 'top' })
  } catch {
    $q.notify({ type: 'negative', message: t('assets.portfolio.errors.save'), position: 'top' })
  } finally {
    saving.value = false
  }
}

async function readA1() {
  if (readingA1.value) return
  readingA1.value = true
  cellError.value = false
  try {
    const result = await readInvestmentPortfolioA1(workspaceId.value, assetId.value)
    cellA1.value = String(result.value ?? '')
  } catch {
    cellA1.value = null
    cellError.value = true
  } finally {
    readingA1.value = false
  }
}

function clearCellResult() {
  cellA1.value = null
  cellError.value = false
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;

.portfolio-page {
  @include financial-page;
}
.portfolio-shell {
  @include financial-shell;
  max-width: 64rem;
}
.page-state {
  display: grid;
  min-height: 24rem;
  place-content: center;
  justify-items: center;
  gap: 0.75rem;
  color: var(--color-copy);
  text-align: center;
}
.error-state > .q-icon {
  font-size: 3rem;
}
.error-state h1,
.error-state p {
  margin: 0;
}
.portfolio-header {
  @include financial-header;
}
.back-button {
  @include financial-back-button;
}
.eyebrow {
  display: block;
  margin-bottom: 0.35rem;
  color: var(--color-primary);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
h1 {
  @include financial-title;
}
.setup-card,
.source-card,
.portfolio-placeholder {
  @include dashboard-card;
  margin-top: 1.5rem;
}
.setup-card {
  display: grid;
  max-width: 44rem;
  margin-right: auto;
  margin-left: auto;
  padding: clamp(1.4rem, 4vw, 2.5rem);
}
.setup-icon,
.source-icon,
.placeholder-icon {
  display: grid;
  place-items: center;
  border-radius: 1rem;
  background: var(--color-green-soft);
  color: var(--color-success-dark);
}
.setup-icon {
  width: 3.5rem;
  height: 3.5rem;
  font-size: 1.65rem;
}
.setup-copy h2,
.source-card h2,
.portfolio-placeholder h2,
.confirm-card h2 {
  margin: 0;
  color: var(--color-ink);
}
.setup-copy h2 {
  margin-top: 1rem;
  font-size: 1.65rem;
}
.setup-copy p,
.source-card p,
.portfolio-placeholder p,
.confirm-card p {
  color: var(--color-copy);
}
.template-button {
  justify-self: start;
  margin-top: 0.5rem;
}
.form-separator {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  margin: 1.5rem 0;
  color: var(--color-muted);
  font-size: 0.78rem;
}
.form-separator::before,
.form-separator::after {
  height: 1px;
  flex: 1;
  background: var(--color-line);
  content: '';
}
.sheet-form {
  display: grid;
  gap: 1rem;
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
.source-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 1.5rem;
}
.source-main {
  display: flex;
  align-items: center;
  gap: 1rem;
  min-width: 0;
}
.source-icon {
  width: 3.25rem;
  height: 3.25rem;
  flex: 0 0 auto;
  font-size: 1.5rem;
}
.connected-label {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--color-success-dark);
  font-size: 0.74rem;
  font-weight: 750;
  text-transform: uppercase;
}
.source-card h2 {
  margin-top: 0.2rem;
  font-size: 1.2rem;
}
.source-card p {
  max-width: 32rem;
  margin: 0.2rem 0 0;
  overflow: hidden;
  font-size: 0.82rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.portfolio-placeholder {
  display: grid;
  min-height: 19rem;
  padding: 2rem;
  place-content: center;
  justify-items: center;
  text-align: center;
}
.placeholder-icon {
  width: 4.5rem;
  height: 4.5rem;
  margin-bottom: 1rem;
  background: var(--color-blue-soft);
  color: var(--color-primary);
  font-size: 2rem;
}
.portfolio-placeholder p {
  max-width: 28rem;
  margin: 0.5rem 0 0;
}
.read-cell-button {
  margin-top: 1.25rem;
}
.cell-result {
  display: grid;
  min-width: min(24rem, 100%);
  margin-top: 1rem;
  padding: 1rem 1.25rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  background: var(--color-surface-soft);
  text-align: left;
}
.cell-result small {
  color: var(--color-copy);
  font-size: 0.72rem;
  font-weight: 750;
  text-transform: uppercase;
}
.cell-result strong {
  margin-top: 0.25rem;
  overflow-wrap: anywhere;
  color: var(--color-ink);
  font-size: 1.15rem;
}
.portfolio-placeholder .cell-error {
  margin-top: 0.75rem;
  color: var(--color-danger);
}
.secondary-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.75rem;
}
.confirm-card {
  @include financial-simple-dialog(28rem);
}

@media (max-width: 760px) {
  .source-card {
    align-items: stretch;
    flex-direction: column;
  }
  .source-card > .q-btn {
    width: 100%;
  }
  .secondary-actions {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
