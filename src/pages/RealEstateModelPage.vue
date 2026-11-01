<template>
  <q-page class="model-page">
    <main class="model-shell">
      <div v-if="pageLoading" class="page-state">
        <q-spinner color="primary" size="2rem" />
        <span>{{ t('assets.realEstate.loading') }}</span>
      </div>
      <section
        v-else-if="pageError || assetsStore.error || liabilitiesStore.error"
        class="page-state error-state"
      >
        <q-icon name="cloud_off" />
        <h1>{{ t('assets.errors.loadTitle') }}</h1>
        <q-btn
          color="primary"
          unelevated
          no-caps
          icon="refresh"
          :label="t('common.retry')"
          @click="prepare(true)"
        />
      </section>
      <template v-else-if="asset">
        <header class="model-header">
          <div class="desktop-header">
            <q-btn
              flat
              dense
              no-caps
              color="grey-7"
              icon="arrow_back"
              :label="t('assets.realEstate.back')"
              :to="propertiesRoute"
            />
            <h1>{{ asset.itemName }}</h1>
          </div>
          <div class="mobile-header">
            <q-btn flat round dense icon="arrow_back" :to="propertiesRoute" />
            <strong>{{ t('assets.realEstate.back') }}</strong>
          </div>
        </header>

        <section class="property-identity model-mobile-only">
          <div class="property-icon"><q-icon name="home" /></div>
          <div>
            <h1>{{ asset.itemName }}</h1>
            <span>{{ t('assets.categories.real_estate.name') }}</span>
          </div>
        </section>

        <section class="equity-card">
          <span class="equity-label">{{ t('assets.realEstate.currentHomeEquity') }}</span>
          <div class="equity-main">
            <strong>{{ formatCurrency(currentEquity) }}</strong>
          </div>
          <div class="equity-ratio">
            <b>{{ formatPercentage(currentEquityRatio) }}</b>
            <span>{{ t('assets.realEstate.ofPropertyValue') }}</span>
          </div>
          <div class="equity-breakdown">
            <div>
              <q-icon name="home" />
              <span>
                {{ t('assets.realEstate.propertyValue') }}
                <strong>{{ formatCurrency(asset.currentValue) }}</strong>
              </span>
            </div>
            <div v-if="linkedMortgage">
              <q-icon name="layers" />
              <span>
                {{ t('assets.realEstate.mortgageBalance') }}
                <strong>{{ formatCurrency(linkedMortgage.balance) }}</strong>
              </span>
            </div>
          </div>
        </section>

        <q-banner
          v-if="linkedMortgage && !mortgageProjection.available"
          rounded
          class="warning-banner"
        >
          <template #avatar><q-icon name="warning_amber" color="warning" /></template>
          {{ t('assets.realEstate.missingMortgageModel') }}
          <template #action
            ><q-btn
              flat
              no-caps
              color="primary"
              :label="t('assets.realEstate.openMortgage')"
              :to="mortgageRoute"
          /></template>
        </q-banner>
        <q-banner v-else-if="missingLinkedMortgage" rounded class="warning-banner">
          <template #avatar><q-icon name="link_off" color="warning" /></template>
          {{ t('assets.realEstate.missingMortgage') }}
        </q-banner>

        <section class="panel chart-panel">
          <div class="panel-heading">
            <div>
              <h2 class="model-desktop-only">{{ t('assets.realEstate.chartTitle') }}</h2>
              <h2 class="model-mobile-only">{{ t('assets.realEstate.projection') }}</h2>
              <p>{{ chartDescription }}</p>
            </div>
            <q-select
              v-model="horizonYears"
              class="horizon-select"
              outlined
              dense
              emit-value
              map-options
              :options="horizonSelectOptions"
            />
            <q-btn
              v-if="linkedMortgage"
              class="model-desktop-only"
              flat
              no-caps
              color="primary"
              icon-right="open_in_new"
              :label="linkedMortgage.itemName"
              :to="mortgageRoute"
            />
          </div>
          <RealEstateProjectionChart
            :projection="projection"
            :show-mortgage="mortgageProjection.available"
            :show-equity="equityAvailable"
            :aria-label="t('assets.realEstate.chartAria')"
          />
        </section>

        <section class="model-parameters">
          <q-expansion-item expand-icon="chevron_right" expanded-icon="expand_more">
            <template #header>
              <q-item-section avatar>
                <div class="parameters-icon"><q-icon name="trending_up" /></div>
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ t('assets.realEstate.parameters') }}</q-item-label>
                <q-item-label caption>{{ parametersSummary }}</q-item-label>
              </q-item-section>
            </template>
            <div class="model-parameters-form">
              <div class="parameter-field">
                <label>{{ t('assets.realEstate.purchasePrice') }}</label>
                <q-input
                  v-model="purchasePrice"
                  outlined
                  dense
                  type="number"
                  min="0"
                  step="0.01"
                  prefix="€"
                  :rules="[purchasePriceRule]"
                />
              </div>
              <div class="parameter-field">
                <label>{{ t('assets.realEstate.purchaseDate') }}</label>
                <q-input
                  v-model="purchaseDate"
                  outlined
                  dense
                  type="date"
                  :max="today"
                  :rules="[purchaseDateRule]"
                />
              </div>
              <div class="parameter-field">
                <label>{{ t('assets.realEstate.appreciationRate') }}</label>
                <q-input
                  v-model.number="appreciationRate"
                  outlined
                  dense
                  type="number"
                  min="-100"
                  max="100"
                  step="0.1"
                  suffix="%"
                  :rules="[rateRule]"
                />
              </div>
              <small>{{ t('assets.realEstate.estimateNotice') }}</small>
              <q-btn
                unelevated
                no-caps
                color="primary"
                :label="t('common.save')"
                :loading="saving"
                @click="saveRealEstateModel"
              />
            </div>
          </q-expansion-item>
        </section>
      </template>
    </main>
  </q-page>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import RealEstateProjectionChart from '@/components/assets/RealEstateProjectionChart.vue'
import {
  buildFrenchAmortizationSchedule,
  mortgageDetailFromLiability,
} from '@/domain/financial/mortgage-amortization'
import {
  DEFAULT_APPRECIATION_RATE,
  projectRealEstate,
} from '@/domain/financial/real-estate-projection'
import { normalizeNonNegativeMoney } from '@/domain/financial/money'
import { currentFinancialYear } from '@/domain/financial/financial-year'
import { authUser } from '@/services/auth'
import { useAssetsStore } from '@/stores/assets-store'
import { useLiabilitiesStore } from '@/stores/liabilities-store'
import { useFinancialYearsStore } from '@/stores/financial-years-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { formatCurrency } from '@/utils/formatters'
import { getWorkspaceMembers } from '@/utils/workspace-members'

const $q = useQuasar()
const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const assetsStore = useAssetsStore()
const liabilitiesStore = useLiabilitiesStore()
const workspaceStore = useWorkspaceStore()
const financialYearsStore = useFinancialYearsStore()
const preparing = ref(false)
const pageError = ref(null)
const purchasePrice = ref('')
const purchaseDate = ref('')
const appreciationRate = ref(DEFAULT_APPRECIATION_RATE)
const horizonYears = ref(20)
const saving = ref(false)
let preparationId = 0

const workspaceId = computed(() => String(route.params.workspaceId))
const assetId = computed(() => String(route.params.assetId))
const asset = computed(
  () => assetsStore.itemsForCategory('real_estate').find(({ id }) => id === assetId.value) || null,
)
const linkedMortgage = computed(
  () =>
    liabilitiesStore
      .itemsForCategory('mortgage')
      .find(({ id }) => id === asset.value?.mortgageLiabilityId) || null,
)
const missingLinkedMortgage = computed(() =>
  Boolean(asset.value?.mortgageLiabilityId && !linkedMortgage.value),
)
const mortgageModel = computed(() => mortgageDetailFromLiability(linkedMortgage.value))
const mortgageProjection = computed(() => {
  if (!mortgageModel.value) return { available: false, schedule: [] }
  if (mortgageModel.value.currentBalance === 0) return { available: true, schedule: [] }
  try {
    return {
      available: true,
      schedule: buildFrenchAmortizationSchedule({ ...mortgageModel.value, asOfDate: today }),
    }
  } catch {
    return { available: false, schedule: [] }
  }
})
const originalMortgageSchedule = computed(() => {
  if (!mortgageModel.value) return []
  try {
    return buildFrenchAmortizationSchedule({
      currentBalance: mortgageModel.value.originalPrincipal,
      annualInterestRate: mortgageModel.value.annualInterestRate,
      monthlyPayment: mortgageModel.value.monthlyPayment,
      asOfDate: mortgageModel.value.startDate,
    })
  } catch {
    return []
  }
})
const mortgageTimeline = computed(() => {
  if (!mortgageProjection.value.available || !mortgageModel.value) return []
  return [
    { date: mortgageModel.value.startDate, balance: mortgageModel.value.originalPrincipal },
    ...originalMortgageSchedule.value
      .filter(({ date }) => date < today)
      .map(({ date, remainingBalance }) => ({ date, balance: remainingBalance })),
    { date: today, balance: mortgageModel.value.currentBalance },
    ...mortgageProjection.value.schedule.map(({ date, remainingBalance }) => ({
      date,
      balance: remainingBalance,
    })),
  ]
})
const equityAvailable = computed(
  () => !asset.value?.mortgageLiabilityId || mortgageProjection.value.available,
)
const currentEquity = computed(
  () => Number(asset.value?.currentValue || 0) - Number(linkedMortgage.value?.balance || 0),
)
const currentEquityRatio = computed(() => {
  const value = Number(asset.value?.currentValue || 0)
  return value > 0 ? (currentEquity.value / value) * 100 : 0
})
const workspace = computed(
  () => workspaceStore.workspaces.find(({ id }) => id === workspaceId.value) || null,
)
const memberIds = computed(() =>
  getWorkspaceMembers(workspace.value, authUser.value).map(({ id }) => id),
)
const propertiesRoute = computed(() => ({
  name: 'asset-category',
  params: { workspaceId: workspaceId.value, category: 'real_estate' },
}))
const mortgageRoute = computed(() => ({
  name: 'mortgage-detail',
  params: { workspaceId: workspaceId.value, liabilityId: linkedMortgage.value?.id },
}))
const today = localToday()
const projection = computed(() => {
  if (
    normalizeNonNegativeMoney(purchasePrice.value) === null ||
    !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate.value)
  ) {
    return []
  }
  return projectRealEstate({
    purchasePrice: normalizeNonNegativeMoney(purchasePrice.value),
    purchaseDate: purchaseDate.value,
    currentDate: today,
    annualAppreciationRate: appreciationRate.value,
    hasMortgage: mortgageProjection.value.available,
    mortgageTimeline: mortgageTimeline.value,
    horizonMonths: horizonYears.value * 12,
  })
})
const horizonSelectOptions = [5, 10, 15, 20, 30].map((value) => ({
  label: t('assets.realEstate.horizonYears', { count: value }),
  value,
}))
const parametersSummary = computed(() =>
  t('assets.realEstate.parameterSummary', {
    rate: Number(appreciationRate.value || 0).toLocaleString(locale.value, {
      maximumFractionDigits: 2,
    }),
    years: horizonYears.value,
  }),
)
const chartDescription = computed(() =>
  equityAvailable.value
    ? t('assets.realEstate.chartDescription')
    : t('assets.realEstate.propertyOnlyDescription'),
)
const pageLoading = computed(
  () =>
    preparing.value ||
    assetsStore.loading ||
    assetsStore.categoryLoading ||
    liabilitiesStore.loading ||
    liabilitiesStore.categoryLoading,
)

watch([workspaceId, assetId], () => prepare(), { immediate: true })
watch([asset, mortgageModel], resetModelFields, { immediate: true })

async function prepare(force = false) {
  const current = ++preparationId
  preparing.value = true
  pageError.value = null
  try {
    await Promise.all([
      assetsStore.loadConfig(workspaceId.value, force),
      liabilitiesStore.loadConfig(workspaceId.value, force),
      financialYearsStore.load(workspaceId.value, currentFinancialYear(), force),
    ])
    if (current !== preparationId) return
    await Promise.all([
      assetsStore.loadCategory(workspaceId.value, 'real_estate', force),
      liabilitiesStore.config?.categories?.mortgage
        ? liabilitiesStore.loadCategory(workspaceId.value, 'mortgage', force)
        : Promise.resolve(),
    ])
    if (current !== preparationId) return
    if (!asset.value) await router.replace(propertiesRoute.value)
  } catch (error) {
    pageError.value = error
  } finally {
    if (current === preparationId) preparing.value = false
  }
}

async function saveRealEstateModel() {
  if (
    saving.value ||
    !asset.value ||
    purchasePriceRule(purchasePrice.value) !== true ||
    purchaseDateRule(purchaseDate.value) !== true ||
    rateRule(appreciationRate.value) !== true
  ) {
    return
  }
  saving.value = true
  try {
    await assetsStore.editAsset(
      workspaceId.value,
      asset.value.id,
      {
        ...asset.value,
        detail: {
          ...(asset.value.detail || {}),
          realEstate: {
            schemaVersion: 2,
            purchasePrice: normalizeNonNegativeMoney(purchasePrice.value),
            purchaseDate: purchaseDate.value,
            annualAppreciationRate: Number(appreciationRate.value),
          },
        },
      },
      memberIds.value,
    )
    $q.notify({ type: 'positive', message: t('assets.realEstate.saved'), position: 'top' })
  } catch {
    $q.notify({ type: 'negative', message: t('assets.errors.save'), position: 'top' })
  } finally {
    saving.value = false
  }
}

function resetModelFields() {
  const model = asset.value?.detail?.realEstate
  purchasePrice.value =
    model?.schemaVersion === 2 ? model.purchasePrice : (asset.value?.currentValue ?? '')
  purchaseDate.value =
    model?.schemaVersion === 2 ? model.purchaseDate : mortgageModel.value?.startDate || ''
  appreciationRate.value = model?.annualAppreciationRate ?? DEFAULT_APPRECIATION_RATE
}

function purchasePriceRule(value) {
  return normalizeNonNegativeMoney(value) !== null || t('assets.realEstate.invalidPurchasePrice')
}

function purchaseDateRule(value) {
  const date = String(value || '')
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match || date > today) return t('assets.realEstate.invalidPurchaseDate')
  const parsed = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return (
    (parsed.getUTCFullYear() === Number(match[1]) &&
      parsed.getUTCMonth() === Number(match[2]) - 1 &&
      parsed.getUTCDate() === Number(match[3])) ||
    t('assets.realEstate.invalidPurchaseDate')
  )
}

function rateRule(value) {
  const number = Number(value)
  return (
    (Number.isFinite(number) && number >= -100 && number <= 100) ||
    t('assets.realEstate.invalidRate')
  )
}
function formatPercentage(value) {
  return `${Number(value || 0).toLocaleString(locale.value, { maximumFractionDigits: 1 })}%`
}
function localToday() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;
.model-page {
  @include financial-page;
}
.model-shell {
  @include financial-shell;
  display: grid;
  gap: 1.2rem;
}
.model-mobile-only,
.mobile-header {
  display: none;
}
.page-state {
  min-height: 18rem;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 0.75rem;
  text-align: center;
}
.model-header h1,
.panel h2 {
  margin: 0;
  color: var(--color-ink);
}
.model-header h1 {
  font-size: clamp(1.7rem, 5vw, 2.4rem);
}
.panel {
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: #fff;
  padding: 1.2rem;
}
.panel p {
  color: var(--color-muted);
}
.panel-heading {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}
.equity-card,
.model-parameters {
  border: 1px solid var(--color-line);
  border-radius: 1.35rem;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 0.4rem 1.3rem rgba(42, 67, 101, 0.07);
}
.equity-card {
  display: grid;
  grid-template-areas:
    'label breakdown ratio'
    'value breakdown ratio';
  grid-template-columns: minmax(13rem, 0.8fr) minmax(20rem, 1.2fr) auto;
  gap: 0.35rem 2rem;
  align-items: center;
  padding: 1.25rem;
}
.equity-label {
  grid-area: label;
  color: var(--color-ink);
  font-size: 1.05rem;
}
.equity-main {
  grid-area: value;
}
.equity-main > strong {
  color: var(--color-ink);
  font-size: clamp(2.3rem, 6vw, 3.5rem);
  letter-spacing: -0.04em;
  line-height: 1;
}
.equity-ratio {
  grid-area: ratio;
  display: grid;
  flex: 0 0 auto;
  gap: 0.1rem;
  padding: 0.7rem 1rem;
  border-radius: 0.8rem;
  color: #075b3d;
  background: #dcf7e8;
  text-align: center;
}
.equity-ratio b {
  font-size: 1.2rem;
}
.equity-ratio span {
  font-size: 0.75rem;
}
.equity-breakdown {
  grid-area: breakdown;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}
.equity-breakdown > div {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 0.65rem;
}
.equity-breakdown > div + div {
  padding-left: 1rem;
  border-left: 1px solid var(--color-line);
}
.equity-breakdown .q-icon {
  flex: 0 0 auto;
  color: #526987;
  font-size: 1.8rem;
}
.equity-breakdown span {
  display: grid;
  min-width: 0;
  color: var(--color-muted);
  font-size: 0.75rem;
}
.equity-breakdown strong {
  overflow: hidden;
  color: var(--color-ink);
  font-size: 1.05rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.model-parameters {
  overflow: hidden;
}
.model-parameters :deep(.q-item) {
  min-height: 5rem;
  padding: 0.75rem 1rem;
}
.model-parameters :deep(.q-item__label) {
  color: var(--color-ink);
  font-size: 1rem;
  font-weight: 700;
}
.model-parameters :deep(.q-item__label--caption) {
  color: var(--color-muted);
  font-size: 0.82rem;
  font-weight: 400;
}
.parameters-icon {
  display: grid;
  place-items: center;
  width: 2.8rem;
  height: 2.8rem;
  border-radius: 0.8rem;
  color: var(--color-primary);
  background: linear-gradient(145deg, #edf5ff, #e3edf8);
  font-size: 1.55rem;
}
.model-parameters-form {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.8rem 1rem;
  padding: 0 1rem 1rem;
}
.parameter-field {
  display: grid;
  gap: 0.45rem;
}
.parameter-field label {
  color: var(--color-muted);
  font-size: 0.78rem;
  font-weight: 700;
}
.model-parameters-form > small {
  grid-column: 1 / -1;
  color: var(--color-muted);
}
.model-parameters-form > .q-btn {
  grid-column: 3;
}
.horizon-select {
  width: 8.2rem;
}
.horizon-select :deep(.q-field__control) {
  border-radius: 999px;
}
.warning-banner {
  background: #fff8e6;
  color: var(--color-ink);
}
.chart-panel {
  min-width: 0;
}
.panel-heading p {
  margin: 0.25rem 0 0;
}
@media (max-width: 760px) {
  .model-page {
    padding-inline: 0.9rem;
    background: linear-gradient(180deg, #f9fbfe 0%, #f3f7fb 100%);
  }
  .model-shell {
    gap: 1rem;
  }
  .model-desktop-only,
  .desktop-header {
    display: none !important;
  }
  .model-mobile-only {
    display: block;
  }
  .mobile-header {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    min-height: 2.75rem;
    color: var(--color-ink);
  }
  .mobile-header strong {
    font-size: 1.1rem;
    font-weight: 600;
  }
  .property-identity {
    display: flex;
    align-items: center;
    gap: 0.9rem;
    padding: 0.35rem 0.45rem 0.25rem;
  }
  .property-icon {
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    width: 3.55rem;
    height: 3.55rem;
    border-radius: 1rem;
    color: #526987;
    background: linear-gradient(145deg, #edf5ff, #e3edf8);
    font-size: 2rem;
  }
  .property-identity h1 {
    margin: 0;
    color: var(--color-ink);
    font-size: clamp(1.55rem, 7vw, 2rem);
    line-height: 1.1;
  }
  .property-identity span {
    display: block;
    margin-top: 0.25rem;
    color: var(--color-muted);
    font-size: 0.95rem;
  }
  .chart-panel {
    border-radius: 1.35rem;
    box-shadow: 0 0.4rem 1.3rem rgba(42, 67, 101, 0.07);
  }
  .equity-card {
    grid-template-areas:
      'label label'
      'value ratio'
      'breakdown breakdown';
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.7rem 0.75rem;
  }
  .equity-main > strong {
    font-size: clamp(2.15rem, 11vw, 3.3rem);
  }
  .equity-ratio span {
    max-width: 6.5rem;
  }
  .equity-breakdown {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .equity-breakdown > div + div {
    padding-left: 0.8rem;
  }
  .chart-panel {
    padding: 1rem 0.75rem 0.8rem;
  }
  .panel-heading {
    align-items: center;
  }
  .panel-heading h2 {
    font-size: 1.3rem;
  }
  .panel-heading p {
    display: none;
  }
  .model-parameters-form {
    grid-template-columns: 1fr;
  }
  .model-parameters-form > .q-btn {
    grid-column: 1;
  }
  .warning-banner {
    border-radius: 1rem;
  }
  @media (max-width: 390px) {
    .equity-ratio {
      display: flex;
      align-items: baseline;
      gap: 0.35rem;
    }
  }
}
</style>
