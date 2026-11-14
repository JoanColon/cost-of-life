<template>
  <q-page class="cash-model-page">
    <main class="cash-model-shell">
      <div v-if="pageLoading" class="page-state">
        <q-spinner color="primary" size="2rem" />
        <span>{{ t('assets.cashModel.loading') }}</span>
      </div>
      <section v-else-if="pageError || assetsStore.error" class="page-state">
        <q-icon name="cloud_off" size="2rem" />
        <h1>{{ t('assets.errors.loadTitle') }}</h1>
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon="refresh"
          :label="t('common.retry')"
          @click="prepare(true)"
        />
      </section>

      <template v-else-if="asset">
        <AppPageHeader
          :title="asset.itemName"
          :subtitle="t('assets.cashModel.subtitle')"
          :back-label="t('assets.cashModel.back')"
          :back-to="cashRoute"
        />

        <section class="balance-card">
          <span><q-icon name="account_balance" /></span>
          <div>
            <small>{{ t('assets.cashModel.currentBalance') }}</small>
            <strong>{{ formatCurrency(asset.currentValue) }}</strong>
            <p>{{ t('assets.cashModel.balanceNotice') }}</p>
          </div>
        </section>

        <section class="panel chart-panel">
          <div class="chart-heading">
            <div>
              <h2>{{ t('assets.cashModel.projection') }}</h2>
              <p>{{ t('assets.cashModel.projectionDescription') }}</p>
            </div>
            <q-select
              v-model="horizonYears"
              class="horizon-select"
              outlined
              dense
              emit-value
              map-options
              :options="horizonOptions"
            />
          </div>
          <CashProjectionChart
            :projection="projection"
            :aria-label="t('assets.cashModel.chartAria')"
          />
        </section>

        <section class="model-parameters">
          <q-expansion-item expand-icon="chevron_right" expanded-icon="expand_more">
            <template #header>
              <q-item-section avatar>
                <div class="parameters-icon"><q-icon name="percent" /></div>
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ t('assets.cashModel.parameters') }}</q-item-label>
                <q-item-label caption>{{ parametersSummary }}</q-item-label>
              </q-item-section>
            </template>
            <div class="model-parameters-form">
              <div class="parameter-field">
                <label>{{ t('assets.cashModel.annualReturn') }}</label>
                <q-input
                  v-model.number="annualReturnPercent"
                  outlined
                  dense
                  type="number"
                  min="-100"
                  max="100"
                  step="0.1"
                  suffix="%"
                  :rules="[returnRule]"
                />
              </div>
              <small>{{ t('assets.cashModel.parametersDescription') }}</small>
              <div class="model-actions">
                <q-btn
                  v-if="hasModel"
                  flat
                  no-caps
                  color="negative"
                  :label="t('assets.cashModel.remove')"
                  :disable="saving"
                  @click="removeModel"
                />
                <q-btn
                  unelevated
                  no-caps
                  color="primary"
                  :label="t('common.save')"
                  :loading="saving"
                  @click="saveModel"
                />
              </div>
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
import CashProjectionChart from '@/components/assets/CashProjectionChart.vue'
import AppPageHeader from '@/components/layout/AppPageHeader.vue'
import { projectCashValue } from '../../functions/shared/assets/cash.js'
import { normalizeAnnualReturnPercent } from '../../functions/shared/core/rates.js'
import { authUser } from '@/services/auth'
import { useAssetsStore } from '@/stores/assets-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { formatCurrency } from '@/utils/formatters'
import { getWorkspaceMembers } from '@/utils/workspace-members'

const $q = useQuasar()
const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const assetsStore = useAssetsStore()
const workspaceStore = useWorkspaceStore()
const preparing = ref(false)
const pageError = ref(null)
const saving = ref(false)
const annualReturnPercent = ref(0)
const horizonYears = ref(10)
let preparationId = 0

const workspaceId = computed(() => String(route.params.workspaceId))
const assetId = computed(() => String(route.params.assetId))
const asset = computed(
  () => assetsStore.itemsForCategory('cash').find(({ id }) => id === assetId.value) || null,
)
const workspace = computed(
  () => workspaceStore.workspaces.find(({ id }) => id === workspaceId.value) || null,
)
const memberIds = computed(() =>
  getWorkspaceMembers(workspace.value, authUser.value).map(({ id }) => id),
)
const cashRoute = computed(() => ({
  name: 'asset-category',
  params: { workspaceId: workspaceId.value, category: 'cash' },
}))
const pageLoading = computed(
  () => preparing.value || assetsStore.loading || assetsStore.categoryLoading,
)
const hasModel = computed(() => asset.value?.detail?.cash?.schemaVersion === 1)
const horizonOptions = computed(() =>
  [5, 10, 20].map((years) => ({
    label: t('assets.cashModel.horizonYears', { count: years }),
    value: years,
  })),
)
const projection = computed(() =>
  Array.from({ length: horizonYears.value + 1 }, (_, years) => ({
    years,
    value: projectCashValue({
      currentBalance: asset.value?.currentValue || 0,
      annualReturnPercent: normalizeAnnualReturnPercent(annualReturnPercent.value, 0),
      months: years * 12,
    }),
  })),
)
const parametersSummary = computed(() =>
  t('assets.cashModel.parametersSummary', {
    rate: Number(annualReturnPercent.value || 0).toLocaleString(locale.value, {
      maximumFractionDigits: 1,
    }),
    years: horizonYears.value,
  }),
)

watch([workspaceId, assetId], () => prepare(), { immediate: true })
watch(asset, resetFields, { immediate: true })

async function prepare(force = false) {
  const current = ++preparationId
  preparing.value = true
  pageError.value = null
  try {
    await assetsStore.loadConfig(workspaceId.value, force)
    if (current !== preparationId) return
    await assetsStore.loadCategory(workspaceId.value, 'cash', force)
    if (current !== preparationId) return
    if (!asset.value) await router.replace(cashRoute.value)
  } catch (error) {
    pageError.value = error
  } finally {
    if (current === preparationId) preparing.value = false
  }
}

async function saveModel() {
  const rate = normalizeAnnualReturnPercent(annualReturnPercent.value)
  if (saving.value || !asset.value || rate == null) return
  await persist({
    ...(asset.value.detail || {}),
    cash: { schemaVersion: 1, annualReturnPercent: rate },
  })
}

async function removeModel() {
  if (saving.value || !asset.value) return
  const detail = { ...(asset.value.detail || {}) }
  delete detail.cash
  const saved = await persist(detail)
  if (saved) annualReturnPercent.value = 0
}

async function persist(detail) {
  saving.value = true
  try {
    await assetsStore.editAsset(
      workspaceId.value,
      asset.value.id,
      { ...asset.value, detail },
      memberIds.value,
    )
    $q.notify({ type: 'positive', message: t('assets.cashModel.saved'), position: 'top' })
    return true
  } catch {
    $q.notify({ type: 'negative', message: t('assets.errors.save'), position: 'top' })
    return false
  } finally {
    saving.value = false
  }
}

function resetFields() {
  annualReturnPercent.value = asset.value?.detail?.cash?.annualReturnPercent ?? 0
}

function returnRule(value) {
  return normalizeAnnualReturnPercent(value) != null || t('assets.cashModel.invalidReturn')
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;

.cash-model-page {
  @include financial-page;
}

.cash-model-shell {
  @include financial-shell(wide);
  display: grid;
  gap: 1rem;
}

.page-state {
  display: grid;
  justify-items: center;
  gap: 0.8rem;
  padding: 4rem 1rem;
  color: var(--color-copy);
  text-align: center;
}

.balance-card {
  @include financial-model-surface;
  display: flex;
  gap: 1rem;
  align-items: center;
  min-height: 7.25rem;
  padding: 1.25rem;
}

.balance-card > span {
  display: grid;
  width: 2.8rem;
  height: 2.8rem;
  place-items: center;
  border-radius: 50%;
  background: var(--color-green-soft);
  color: var(--color-success-dark);
  font-size: 1.3rem;
}

.balance-card div {
  display: grid;
  gap: 0.15rem;
}

.balance-card strong {
  color: var(--color-ink);
  font-size: clamp(2rem, 5vw, 2.8rem);
  letter-spacing: -0.04em;
  line-height: 1;
}

.balance-card p {
  margin: 0;
  color: var(--color-copy);
}

.panel {
  min-width: 0;
  padding: 1.2rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.chart-heading {
  @include financial-chart-heading;
}

.horizon-select {
  width: 8.2rem;
}

.horizon-select :deep(.q-field__control) {
  border-radius: 999px;
}

.model-parameters {
  @include financial-model-parameters-card;
}

.parameters-icon {
  display: grid;
  width: 2.8rem;
  height: 2.8rem;
  place-items: center;
  border-radius: 0.8rem;
  background: linear-gradient(145deg, #eaf8f3, #dcf3ea);
  color: var(--color-success-dark);
  font-size: 1.4rem;
}

.model-parameters-form {
  display: grid;
  grid-template-columns: minmax(12rem, 20rem) minmax(0, 1fr) auto;
  gap: 0.8rem 1rem;
  align-items: end;
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
  grid-column: 1 / 3;
  color: var(--color-muted);
}

.model-actions {
  display: flex;
  grid-column: 3;
  grid-row: 1;
  justify-content: flex-end;
  gap: 0.6rem;
}

@media (max-width: 760px) {
  .cash-model-page {
    padding-inline: 0.9rem;
    background: linear-gradient(180deg, #f9fbfe 0%, #f3f7fb 100%);
  }

  .chart-panel {
    padding: 1rem 0.75rem 0.8rem;
  }

  .chart-heading p {
    display: none;
  }

  .model-parameters-form {
    grid-template-columns: 1fr;
  }

  .model-parameters-form > small {
    grid-column: 1;
  }

  .model-actions {
    grid-column: 1;
    grid-row: auto;
    flex-wrap: wrap;
  }
}
</style>
