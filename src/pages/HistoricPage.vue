<template>
  <q-page class="historic-page">
    <main class="historic-shell">
      <header class="historic-header">
        <div>
          <q-btn
            flat
            dense
            no-caps
            color="grey-7"
            icon="arrow_back"
            :label="t('navigation.backToWorkspaceHome')"
            :to="{ name: 'workspace-dashboard', params: { workspaceId } }"
            class="back-button"
          />
          <h1>{{ t('historic.title') }}</h1>
        </div>
        <q-select
          v-model="selectedYear"
          outlined
          emit-value
          map-options
          :options="yearOptions"
          :label="t('historic.year')"
          class="year-select"
        />
      </header>

      <div v-if="loading" class="state"><q-spinner color="primary" size="2rem" /></div>
      <section v-else-if="error" class="state">
        <q-icon name="cloud_off" size="2rem" />
        <p>{{ t('historic.error') }}</p>
      </section>
      <section v-else-if="financialYear" class="totals-grid">
        <article>
          <span>{{ t('dashboard.costOfLife.income') }}</span>
          <strong>{{ formatCurrency(annualIncome) }}</strong>
        </article>
        <article>
          <span>{{ t('dashboard.costOfLife.lifeCosts') }}</span>
          <strong>{{ formatCurrency(annualExpenses) }}</strong>
        </article>
        <article>
          <span>{{ t('dashboard.costOfLife.savingsCapacity') }}</span>
          <strong>{{ formatCurrency(annualSavings) }}</strong>
        </article>
        <article>
          <span>{{ t('dashboard.financialPosition.netWorth') }}</span>
          <strong>{{ latestNetWorth == null ? '—' : formatCurrency(latestNetWorth) }}</strong>
        </article>
      </section>
      <section v-else class="state">
        <p>{{ t('historic.empty') }}</p>
      </section>
    </main>
  </q-page>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { currentFinancialYear, financialYearValue } from '@/domain/financial/financial-year'
import { useFinancialYearsStore } from '@/stores/financial-years-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { formatCurrency } from '@/utils/formatters'

const { t } = useI18n()
const route = useRoute()
const financialYearsStore = useFinancialYearsStore()
const workspaceStore = useWorkspaceStore()
const selectedYear = ref(currentFinancialYear())
const workspaceId = computed(() => String(route.params.workspaceId))
const workspace = computed(
  () => workspaceStore.workspaces.find((item) => item.id === workspaceId.value) || null,
)
const yearOptions = computed(() =>
  yearsBetween(currentFinancialYear(), workspaceStartYear.value).map((year) => ({
    label: String(year),
    value: year,
  })),
)
const workspaceStartYear = computed(() => {
  const value = workspace.value?.createdAt
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date.getFullYear() : currentFinancialYear() - 10
})
const financialYear = computed(() => financialYearsStore.get(workspaceId.value, selectedYear.value))
const annualIncome = computed(() => financialYearValue(financialYear.value, 'income'))
const annualExpenses = computed(() => financialYearValue(financialYear.value, 'expenses'))
const annualSavings = computed(() => financialYearValue(financialYear.value, 'savings'))
const latestNetWorth = computed(() => financialYearValue(financialYear.value, 'netWorth'))
const loading = computed(() => financialYearsStore.loading)
const error = computed(() => financialYearsStore.errorFor(workspaceId.value, selectedYear.value))

watch([workspaceId, selectedYear], load, { immediate: true })

async function load() {
  try {
    await financialYearsStore.load(workspaceId.value, selectedYear.value)
  } catch {
    return
  }
}

function yearsBetween(latest, earliest) {
  const first = Math.min(latest, earliest)
  return Array.from({ length: latest - first + 1 }, (_, index) => latest - index)
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;

.historic-page {
  @include financial-page;
}
.historic-shell {
  @include financial-shell;
}
.historic-header {
  @include financial-header;
}
.back-button {
  @include financial-back-button;
}
h1 {
  @include financial-title;
}
.year-select {
  width: 9rem;
}
.totals-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}
.totals-grid article {
  display: grid;
  gap: 0.5rem;
  padding: 1.5rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}
.totals-grid span,
.state {
  color: var(--color-copy);
}
.totals-grid strong {
  font-size: clamp(1.5rem, 3vw, 2.4rem);
}
.state {
  display: grid;
  place-items: center;
  min-height: 20rem;
}
@media (max-width: 700px) {
  .totals-grid {
    grid-template-columns: 1fr;
  }
}
</style>
