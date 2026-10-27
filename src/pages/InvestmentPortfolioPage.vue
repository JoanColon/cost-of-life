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
          <section
            v-if="portfolioRows !== null"
            class="portfolio-kpis"
            :aria-label="t('assets.portfolio.kpis.label')"
          >
            <article class="portfolio-kpi portfolio-kpi--value">
              <div class="portfolio-kpi-copy">
                <div class="portfolio-kpi-heading">
                  <span class="portfolio-kpi-icon"><q-icon name="account_balance_wallet" /></span>
                  <span>{{ t('assets.portfolio.kpis.portfolioValue') }}</span>
                </div>
                <strong>{{ portfolioMetrics.totalPortfolioValue }}</strong>
                <small>{{ t('assets.portfolio.kpis.portfolioValueDescription') }}</small>
              </div>
              <div v-if="portfolioHistoryPoints.length" class="portfolio-history">
                <svg
                  viewBox="0 0 320 100"
                  preserveAspectRatio="none"
                  role="img"
                  :aria-label="t('assets.portfolio.kpis.annualHistory')"
                >
                  <path
                    v-if="portfolioChart.area"
                    class="portfolio-history-area"
                    :d="portfolioChart.area"
                  />
                  <path class="portfolio-history-line" :d="portfolioChart.line" />
                  <circle
                    :cx="portfolioChart.last.x"
                    :cy="portfolioChart.last.y"
                    r="4"
                    class="portfolio-history-point"
                  />
                </svg>
                <div class="portfolio-history-years">
                  <span>{{ portfolioHistoryPoints[0].year }}</span>
                  <span v-if="portfolioHistoryPoints.length > 1">{{
                    portfolioHistoryPoints.at(-1).year
                  }}</span>
                </div>
              </div>
              <div v-else-if="historyLoading" class="portfolio-history-state">
                <q-spinner color="primary" size="1.5rem" />
              </div>
            </article>

            <div class="portfolio-kpi-pair">
              <article class="portfolio-kpi">
                <div class="portfolio-kpi-heading">
                  <span class="portfolio-kpi-icon portfolio-kpi-icon--income">
                    <q-icon name="payments" />
                  </span>
                  <span>{{ t('assets.portfolio.kpis.annualIncome') }}</span>
                </div>
                <strong>{{ portfolioMetrics.annualDividendIncome }}</strong>
                <small>
                  {{
                    t('assets.portfolio.kpis.grossIncome', {
                      value: portfolioMetrics.grossDividendIncome,
                    })
                  }}
                </small>
              </article>

              <article class="portfolio-kpi">
                <div class="portfolio-kpi-heading">
                  <span class="portfolio-kpi-icon portfolio-kpi-icon--yield">
                    <q-icon name="percent" />
                  </span>
                  <span>{{ t('assets.portfolio.kpis.dividendYield') }}</span>
                </div>
                <strong>{{ portfolioMetrics.dividendYield }}</strong>
                <small>{{ t('assets.portfolio.kpis.dividendYieldDescription') }}</small>
              </article>
            </div>
          </section>

          <section class="portfolio-table-card">
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
              :loading="readingSheet"
              :rows-per-page-options="[10, 25, 50, 0]"
              :no-data-label="t('assets.portfolio.emptyPortfolio')"
            >
              <template #top>
                <q-input
                  v-model="tableFilter"
                  outlined
                  dense
                  debounce="250"
                  :placeholder="t('assets.portfolio.search')"
                  class="portfolio-search"
                >
                  <template #prepend><q-icon name="search" /></template>
                </q-input>
              </template>

              <template #body-cell-ticker="props">
                <q-td :props="props"
                  ><strong>{{ props.value }}</strong></q-td
                >
              </template>

              <template #body-cell-country="props">
                <q-td :props="props">
                  <span class="country-value">
                    <span v-if="countryFlag(props.value)" class="country-flag" aria-hidden="true">
                      {{ countryFlag(props.value) }}
                    </span>
                    <span>{{ props.value || '—' }}</span>
                  </span>
                </q-td>
              </template>

              <template #header-cell-marketValueBase="props">
                <q-th :props="props">
                  <span class="combined-heading">
                    <span>{{ t('assets.portfolio.columns.marketValue') }}</span>
                    <span>{{ t('assets.portfolio.columns.portfolioWeight') }}</span>
                  </span>
                </q-th>
              </template>

              <template #header-cell-annualDividendBase="props">
                <q-th :props="props">
                  <span class="combined-heading">
                    <span>{{
                      t(
                        mobileTable
                          ? 'assets.portfolio.columns.annualIncome'
                          : 'assets.portfolio.columns.annualDividend',
                      )
                    }}</span>
                    <span>{{ t('assets.portfolio.columns.incomeWeight') }}</span>
                  </span>
                </q-th>
              </template>

              <template #body-cell-dayChange="props">
                <q-td :props="props">
                  <span class="daily-change" :class="`daily-change--${changeTone(props.value)}`">
                    {{ props.value || '—' }}
                  </span>
                </q-td>
              </template>

              <template #body-cell-marketValueBase="props">
                <q-td :props="props">
                  <span class="combined-value">
                    <strong>{{ props.value || '—' }}</strong>
                    <small>{{ props.row.portfolioWeight || '—' }}</small>
                  </span>
                </q-td>
              </template>

              <template #body-cell-annualDividendBase="props">
                <q-td :props="props">
                  <span class="combined-value">
                    <strong>{{ props.value || '—' }}</strong>
                    <small>{{ props.row.incomeWeight || '—' }}</small>
                  </span>
                </q-td>
              </template>
            </q-table>

            <div v-else class="portfolio-table-empty">
              <q-spinner v-if="readingSheet" color="primary" size="2rem" />
              <q-icon v-else-if="!sheetError" name="table_view" />
              <p v-if="readingSheet">{{ t('assets.portfolio.loadingPositions') }}</p>
              <p v-else-if="!sheetError">{{ t('assets.portfolio.emptyPortfolio') }}</p>
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
              class="portfolio-action portfolio-action--open"
            />
            <div class="portfolio-management-actions">
              <q-btn
                flat
                no-caps
                color="primary"
                icon="edit"
                :label="t('assets.portfolio.changeSheet')"
                class="portfolio-action"
                @click="startEditing"
              />
              <q-btn
                flat
                no-caps
                color="negative"
                icon="link_off"
                :label="t('assets.portfolio.disconnect')"
                class="portfolio-action"
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
  investmentPortfolioSnapshot,
  isGoogleSheetsUrl,
  readInvestmentPortfolioSheet,
} from '@/services/firebase/investment-portfolios.service'
import {
  changeTone,
  countryFlag,
  portfolioKpis,
  portfolioTableRows,
} from '@/domain/financial/investment-portfolio'
import { buildAssetAnnualSeries } from '@/domain/financial/history'
import { getFinancialHistory } from '@/services/firebase/history.service'
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
const portfolioSummary = ref(null)
const sheetError = ref(false)
const tableFilter = ref('')
const tablePagination = ref({ sortBy: 'ticker', descending: false, page: 1, rowsPerPage: 25 })
const historyDocuments = ref([])
const historyLoading = ref(false)
let preparationId = 0
let sheetReadId = 0
let historyRequestId = 0

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
const activePortfolioSummary = computed(
  () => portfolioSummary.value || portfolio.value?.summary || {},
)
const mobileTable = computed(() => $q.screen.lt.sm)
const portfolioMetrics = computed(() => portfolioKpis(activePortfolioSummary.value))
const portfolioHistoryPoints = computed(() =>
  buildAssetAnnualSeries(historyDocuments.value, { assetId: assetId.value }),
)
const portfolioChart = computed(() => buildPortfolioChart(portfolioHistoryPoints.value))
const tableRows = computed(() =>
  portfolioTableRows(portfolioRows.value, activePortfolioSummary.value.baseCurrency),
)
const tableColumns = computed(() => {
  if (mobileTable.value) {
    return [
      tableColumn('ticker', t('assets.portfolio.columns.ticker'), 'left', '24%'),
      tableColumn('country', t('assets.portfolio.columns.country'), 'center', '18%'),
      tableColumn('marketValueBase', t('assets.portfolio.columns.marketValue'), 'center', '29%'),
      tableColumn(
        'annualDividendBase',
        t('assets.portfolio.columns.annualIncome'),
        'center',
        '29%',
      ),
    ]
  }

  return [
    tableColumn('ticker', t('assets.portfolio.columns.ticker'), 'left', '11%'),
    tableColumn('country', t('assets.portfolio.columns.country'), 'center', '9%'),
    tableColumn('shares', t('assets.portfolio.columns.shares'), 'center', '10%'),
    tableColumn('priceLocal', t('assets.portfolio.columns.priceLocal'), 'center', '13%'),
    tableColumn('dayChange', t('assets.portfolio.columns.dayChange'), 'center', '12%'),
    tableColumn('dividendYield', t('assets.portfolio.columns.dividendYield'), 'center', '13%'),
    tableColumn('marketValueBase', t('assets.portfolio.columns.marketValue'), 'center', '16%'),
    tableColumn(
      'annualDividendBase',
      t('assets.portfolio.columns.annualDividend'),
      'center',
      '16%',
    ),
  ]
})
const sheetUrlRules = [
  (value) => Boolean(String(value || '').trim()) || t('assets.portfolio.errors.urlRequired'),
  (value) => isGoogleSheetsUrl(value) || t('assets.portfolio.errors.urlInvalid'),
]

watch([workspaceId, assetId], () => prepare(), { immediate: true })

async function prepare(force = false) {
  const currentPreparation = ++preparationId
  clearSheetResult()
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
    if (!investment.value) {
      await router.replace(investmentsRoute.value)
      return
    }
    if (configured.value) void readSheet()
  } catch (loadError) {
    pageError.value = loadError
  } finally {
    if (currentPreparation === preparationId) preparing.value = false
  }
}

async function loadHistory() {
  const currentRequest = ++historyRequestId
  historyDocuments.value = []
  historyLoading.value = true
  try {
    const documents = await getFinancialHistory(workspaceId.value)
    if (currentRequest === historyRequestId) historyDocuments.value = documents
  } catch {
    if (currentRequest === historyRequestId) historyDocuments.value = []
  } finally {
    if (currentRequest === historyRequestId) historyLoading.value = false
  }
}

function startEditing() {
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
    clearSheetResult()
    void readSheet()
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
  const currentRead = ++sheetReadId
  const currentWorkspaceId = workspaceId.value
  const currentAssetId = assetId.value
  readingSheet.value = true
  sheetError.value = false

  const snapshot = investmentPortfolioSnapshot(portfolio.value)
  if (snapshot) {
    portfolioRows.value = snapshot.rows
    portfolioSummary.value = snapshot.summary
    assetsStore.applyInvestmentPortfolioSummary(currentAssetId, snapshot.summary)
    void loadHistory()
  }

  try {
    const result = await readInvestmentPortfolioSheet(currentWorkspaceId, currentAssetId)
    if (currentRead !== sheetReadId) return
    portfolioRows.value = Array.isArray(result.rows) ? result.rows : []
    portfolioSummary.value = result.summary || null
    assetsStore.applyInvestmentPortfolioSummary(currentAssetId, result.summary, result)
    void loadHistory()
  } catch {
    if (currentRead !== sheetReadId) return
    sheetError.value = true
  } finally {
    if (currentRead === sheetReadId) readingSheet.value = false
  }
}

function clearSheetResult() {
  sheetReadId += 1
  readingSheet.value = false
  portfolioRows.value = null
  portfolioSummary.value = null
  sheetError.value = false
  tableFilter.value = ''
}

function tableColumn(name, label, align, width) {
  const size = `width: ${width}`
  return { name, label, field: name, align, sortable: true, style: size, headerStyle: size }
}

function buildPortfolioChart(points) {
  if (!points.length) return { line: '', area: '', last: { x: 0, y: 0 } }
  if (points.length === 1) {
    return { line: 'M 16 50 L 304 50', area: '', last: { x: 304, y: 50 } }
  }

  const width = 320
  const height = 100
  const padding = 6
  const values = points.map(({ value }) => value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const coordinates = values.map((value, index) => ({
    x: padding + (index / (values.length - 1)) * (width - padding * 2),
    y: padding + ((max - value) / range) * (height - padding * 2),
  }))
  const line = coordinates
    .map(({ x, y }, index) => `${index ? 'L' : 'M'} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(' ')
  const first = coordinates[0]
  const last = coordinates.at(-1)

  return {
    line,
    area: `${line} L ${last.x.toFixed(2)} ${height} L ${first.x.toFixed(2)} ${height} Z`,
    last,
  }
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
.setup-icon {
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
.confirm-card h2 {
  margin: 0;
  color: var(--color-ink);
}
.setup-copy h2 {
  margin-top: 1rem;
  font-size: 1.65rem;
}
.setup-copy p,
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
.portfolio-kpis {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  margin-top: 1.5rem;
}
.portfolio-kpi {
  display: flex;
  min-width: 0;
  min-height: 9rem;
  flex-direction: column;
  padding: 1.25rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}
.portfolio-kpi--value {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(16rem, 1.2fr);
  align-items: center;
  gap: 2rem;
  min-height: 12rem;
}
.portfolio-kpi-copy {
  display: flex;
  min-width: 0;
  height: 100%;
  flex-direction: column;
}
.portfolio-kpi-pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}
.portfolio-kpi-pair .portfolio-kpi {
  border: 0;
  border-radius: 0;
  box-shadow: none;
}
.portfolio-kpi-pair .portfolio-kpi + .portfolio-kpi {
  border-left: 1px solid var(--color-line);
}
.portfolio-kpi-heading {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  color: var(--color-copy);
  font-size: 0.82rem;
  font-weight: 700;
}
.portfolio-kpi-icon {
  display: grid;
  width: 2.35rem;
  height: 2.35rem;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--color-blue-soft);
  color: var(--color-primary);
  font-size: 1.05rem;
}
.portfolio-kpi-icon--income {
  background: var(--color-green-soft);
  color: var(--color-success-dark);
}
.portfolio-kpi-icon--yield {
  background: var(--color-purple-soft);
  color: var(--color-purple);
}
.portfolio-kpi strong {
  margin-top: 0.9rem;
  overflow: hidden;
  color: var(--color-ink);
  font-size: clamp(1.7rem, 3vw, 2.35rem);
  line-height: 1;
  letter-spacing: -0.04em;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.portfolio-kpi small {
  margin-top: auto;
  padding-top: 0.65rem;
  color: var(--color-copy);
  font-size: 0.76rem;
  line-height: 1.35;
}
.portfolio-history {
  display: grid;
  align-self: stretch;
  min-width: 0;
}
.portfolio-history svg {
  width: 100%;
  height: 7rem;
  overflow: visible;
}
.portfolio-history-area {
  fill: var(--color-primary);
  opacity: 0.1;
}
.portfolio-history-line {
  fill: none;
  stroke: var(--color-primary);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 3;
  vector-effect: non-scaling-stroke;
}
.portfolio-history-point {
  fill: var(--color-primary);
  stroke: var(--color-surface);
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}
.portfolio-history-years {
  display: flex;
  justify-content: space-between;
  color: var(--color-copy);
  font-size: 0.7rem;
  font-weight: 650;
}
.portfolio-history-state {
  display: grid;
  min-height: 7rem;
  place-items: center;
}
.portfolio-kpis + .portfolio-table-card {
  margin-top: 1rem;
}
.portfolio-table {
  width: calc(100% - 2rem);
  margin: 1rem;
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  color: var(--color-ink);
}
.portfolio-table :deep(.q-table__top) {
  min-height: 4.25rem;
  padding: 0.65rem;
  border-bottom: 1px solid var(--color-line);
}
.portfolio-search {
  width: 100%;
}
.portfolio-search :deep(.q-field__control) {
  min-height: 2.9rem;
  border-radius: 999px;
  background: var(--color-surface);
}
.portfolio-search :deep(.q-field__prepend) {
  padding-right: 0.6rem;
  color: var(--color-copy);
}
.portfolio-search :deep(.q-field__native) {
  color: var(--color-ink);
  font-size: 0.85rem;
}
.portfolio-table :deep(.q-table__middle) {
  max-width: 100%;
}
.portfolio-table :deep(table) {
  width: 100%;
  table-layout: fixed;
}
.portfolio-table :deep(th) {
  height: 3.5rem;
  padding-top: 0.65rem;
  padding-bottom: 0.35rem;
  background: var(--color-surface-soft);
  color: var(--color-copy);
  font-size: 0.72rem;
  font-weight: 750;
  letter-spacing: 0.025em;
  line-height: 1.25;
  text-align: center !important;
  vertical-align: top;
  white-space: normal;
}
.portfolio-table :deep(th .q-table__sort-icon) {
  flex: 0 0 auto;
}
.combined-heading {
  display: inline-grid;
  gap: 0.08rem;
  place-items: center;
  line-height: 1.15;
  text-align: center;
}
.combined-heading > span {
  white-space: nowrap;
}
.portfolio-table :deep(td) {
  height: 3.2rem;
  padding-right: 0.85rem;
  padding-left: 0.85rem;
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
.combined-value {
  display: grid;
  gap: 0.05rem;
}
.country-value {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
}
.country-flag {
  font-size: 1.15rem;
  line-height: 1;
}
.combined-value strong {
  color: var(--color-ink);
  font-weight: 700;
}
.combined-value small {
  color: var(--color-copy);
  font-size: 0.72rem;
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
.portfolio-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 0.75rem;
  padding: 0.25rem 0.5rem;
}
.portfolio-management-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.portfolio-action {
  min-height: 2.75rem;
}
.confirm-card {
  @include financial-simple-dialog(28rem);
}

@media (max-width: 760px) {
  .portfolio-table :deep(th) {
    padding-right: 0.2rem;
    padding-left: 0.2rem;
    font-size: 0.62rem;
  }
  .portfolio-kpis {
    gap: 0.75rem;
    margin-top: 1rem;
  }
  .portfolio-kpi--value {
    grid-template-columns: minmax(0, 0.9fr) minmax(7.5rem, 1.1fr);
    gap: 0.65rem;
    min-height: 9.5rem;
    padding: 0.9rem;
  }
  .portfolio-kpi-pair .portfolio-kpi {
    min-height: 8.75rem;
    padding: 0.9rem;
  }
  .portfolio-kpi-heading {
    gap: 0.45rem;
    font-size: 0.7rem;
    line-height: 1.2;
  }
  .portfolio-kpi-icon {
    width: 2rem;
    height: 2rem;
    font-size: 0.9rem;
  }
  .portfolio-kpi strong {
    margin-top: 0.75rem;
    font-size: clamp(1.35rem, 6vw, 2rem);
  }
  .portfolio-kpi small {
    padding-top: 0.45rem;
    font-size: 0.64rem;
  }
  .portfolio-history svg {
    height: 5.5rem;
  }
  .portfolio-history-years {
    font-size: 0.6rem;
  }
  .portfolio-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.35rem;
    padding: 0;
  }
  .portfolio-action--open {
    grid-column: 1 / -1;
    border: 1px solid var(--color-line);
    border-radius: 0.75rem;
    background: var(--color-surface);
  }
  .portfolio-management-actions {
    display: grid;
    grid-column: 1 / -1;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.35rem;
  }
  .portfolio-actions > .q-btn,
  .portfolio-management-actions > .q-btn {
    width: 100%;
    min-width: 0;
    padding-inline: 0.35rem;
    font-size: 0.72rem;
  }
}
</style>
