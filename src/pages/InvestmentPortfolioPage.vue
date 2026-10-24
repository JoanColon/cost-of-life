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
          <section class="portfolio-table-card">
            <header class="portfolio-table-header">
              <span class="placeholder-icon"><q-icon name="query_stats" /></span>
              <div>
                <h2>{{ t('assets.portfolio.portfolioTitle') }}</h2>
                <p>{{ t('assets.portfolio.tableDescription') }}</p>
              </div>
              <q-btn
                outline
                no-caps
                color="primary"
                icon="sync"
                :label="t('assets.portfolio.readSheet')"
                :loading="readingSheet"
                @click="readSheet"
              />
            </header>

            <q-table
              v-if="portfolioRows !== null"
              v-model:pagination="tablePagination"
              class="portfolio-table"
              flat
              dense
              row-key="id"
              :rows="tableRows"
              :columns="tableColumns"
              :filter="tableFilter"
              :rows-per-page-options="[10, 25, 50, 0]"
              :no-data-label="t('assets.portfolio.emptyPortfolio')"
            >
              <template #top-right>
                <q-input
                  v-model="tableFilter"
                  borderless
                  dense
                  debounce="250"
                  :placeholder="t('assets.portfolio.search')"
                >
                  <template #append><q-icon name="search" /></template>
                </q-input>
              </template>

              <template #body-cell-ticker="props">
                <q-td :props="props"
                  ><strong>{{ props.value }}</strong></q-td
                >
              </template>

              <template #body-cell-dayChange="props">
                <q-td :props="props">
                  <span class="daily-change" :class="`daily-change--${changeTone(props.value)}`">
                    {{ props.value || '—' }}
                  </span>
                </q-td>
              </template>
            </q-table>

            <div v-else class="portfolio-table-empty">
              <q-icon name="table_view" />
              <p>{{ t('assets.portfolio.loadTablePrompt') }}</p>
            </div>

            <p v-if="sheetError" class="sheet-error">
              {{ t('assets.portfolio.errors.readSheet') }}
            </p>
          </section>

          <div class="portfolio-actions">
            <q-btn
              flat
              no-caps
              color="primary"
              icon="open_in_new"
              :label="t('assets.portfolio.openSheet')"
              :href="portfolio.spreadsheetUrl"
              target="_blank"
              rel="noopener noreferrer"
            />
            <div class="portfolio-management-actions">
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
  readInvestmentPortfolioSheet,
} from '@/services/firebase/investment-portfolios.service'
import { changeTone, portfolioTableRows } from '@/domain/financial/investment-portfolio'
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
const readingSheet = ref(false)
const portfolioRows = ref(null)
const sheetError = ref(false)
const tableFilter = ref('')
const tablePagination = ref({ sortBy: 'ticker', descending: false, page: 1, rowsPerPage: 25 })
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
const tableRows = computed(() => portfolioTableRows(portfolioRows.value))
const tableColumns = computed(() => [
  tableColumn('ticker', t('assets.portfolio.columns.ticker'), 'left'),
  tableColumn('country', t('assets.portfolio.columns.country'), 'left'),
  tableColumn('shares', t('assets.portfolio.columns.shares')),
  tableColumn('priceLocal', t('assets.portfolio.columns.priceLocal')),
  tableColumn('dayChange', t('assets.portfolio.columns.dayChange')),
  tableColumn('dividendYield', t('assets.portfolio.columns.dividendYield')),
  tableColumn('marketValueBase', t('assets.portfolio.columns.marketValueBase')),
  tableColumn('portfolioWeight', t('assets.portfolio.columns.portfolioWeight')),
  tableColumn('annualDividendBase', t('assets.portfolio.columns.annualDividendBase')),
  tableColumn('incomeWeight', t('assets.portfolio.columns.incomeWeight')),
])
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
  clearSheetResult()
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
    clearSheetResult()
    confirmDisconnect.value = false
    spreadsheetUrl.value = ''
    $q.notify({ type: 'positive', message: t('assets.portfolio.disconnected'), position: 'top' })
  } catch {
    $q.notify({ type: 'negative', message: t('assets.portfolio.errors.save'), position: 'top' })
  } finally {
    saving.value = false
  }
}

async function readSheet() {
  if (readingSheet.value) return
  readingSheet.value = true
  sheetError.value = false
  try {
    const result = await readInvestmentPortfolioSheet(workspaceId.value, assetId.value)
    portfolioRows.value = Array.isArray(result.rows) ? result.rows : []
  } catch {
    portfolioRows.value = null
    sheetError.value = true
  } finally {
    readingSheet.value = false
  }
}

function clearSheetResult() {
  portfolioRows.value = null
  sheetError.value = false
  tableFilter.value = ''
}

function tableColumn(name, label, align = 'right') {
  return { name, label, field: name, align, sortable: true }
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;

.portfolio-page {
  @include financial-page;
}
.portfolio-shell {
  @include financial-shell;
  max-width: 76rem;
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
.portfolio-table-card {
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
.portfolio-table-card h2,
.confirm-card h2 {
  margin: 0;
  color: var(--color-ink);
}
.setup-copy h2 {
  margin-top: 1rem;
  font-size: 1.65rem;
}
.setup-copy p,
.portfolio-table-card p,
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
.portfolio-table-card {
  overflow: hidden;
}
.placeholder-icon {
  display: grid;
  width: 3.5rem;
  height: 3.5rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 1rem;
  background: var(--color-blue-soft);
  color: var(--color-primary);
  font-size: 1.65rem;
}
.portfolio-table-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
  padding: 1.4rem 1.5rem;
  border-bottom: 1px solid var(--color-line);
}
.portfolio-table-header h2 {
  font-size: 1.25rem;
}
.portfolio-table-header p {
  margin: 0.2rem 0 0;
  font-size: 0.86rem;
}
.portfolio-table {
  color: var(--color-ink);
}
.portfolio-table :deep(.q-table__top) {
  min-height: 3.5rem;
  padding: 0 1rem;
  border-bottom: 1px solid var(--color-line);
}
.portfolio-table :deep(.q-table__middle) {
  max-width: 100%;
}
.portfolio-table :deep(table) {
  min-width: 76rem;
}
.portfolio-table :deep(th) {
  background: var(--color-surface-soft);
  color: var(--color-copy);
  font-size: 0.72rem;
  font-weight: 750;
  letter-spacing: 0.025em;
  white-space: normal;
}
.portfolio-table :deep(td) {
  height: 2.8rem;
  border-color: var(--color-line);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.portfolio-table :deep(tbody tr:hover td) {
  background: var(--color-surface-soft);
}
.daily-change {
  font-weight: 700;
}
.daily-change--positive {
  color: var(--color-success-dark);
}
.daily-change--negative {
  color: var(--color-danger);
}
.daily-change--neutral {
  color: var(--color-copy);
}
.portfolio-table-empty {
  display: grid;
  min-height: 13rem;
  padding: 2rem;
  place-content: center;
  justify-items: center;
  color: var(--color-copy);
  text-align: center;
}
.portfolio-table-empty .q-icon {
  color: var(--color-muted);
  font-size: 2.4rem;
}
.portfolio-table-empty p {
  margin: 0.65rem 0 0;
}
.portfolio-table-card .sheet-error {
  margin: 0;
  padding: 0.8rem 1.5rem;
  border-top: 1px solid color-mix(in srgb, var(--color-danger) 25%, transparent);
  background: color-mix(in srgb, var(--color-danger) 7%, white);
  color: var(--color-danger);
}
.portfolio-actions,
.portfolio-management-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.portfolio-actions {
  justify-content: space-between;
  margin-top: 0.75rem;
}
.confirm-card {
  @include financial-simple-dialog(28rem);
}

@media (max-width: 760px) {
  .portfolio-table-header {
    grid-template-columns: auto minmax(0, 1fr);
  }
  .portfolio-table-header > .q-btn {
    grid-column: 1 / -1;
    width: 100%;
  }
  .portfolio-actions,
  .portfolio-management-actions {
    align-items: stretch;
    flex-direction: column;
  }
  .portfolio-actions > .q-btn,
  .portfolio-management-actions,
  .portfolio-management-actions > .q-btn {
    width: 100%;
  }
}
</style>
