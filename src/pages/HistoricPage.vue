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
          />
          <div class="eyebrow">{{ t('historic.eyebrow') }}</div>
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
          <strong>{{
            financialYear.totals ? formatCurrency(financialYear.totals.income || 0) : '—'
          }}</strong>
        </article>
        <article>
          <span>{{ t('dashboard.costOfLife.lifeCosts') }}</span>
          <strong>{{
            financialYear.totals ? formatCurrency(financialYear.totals.expenses || 0) : '—'
          }}</strong>
        </article>
        <article>
          <span>{{ t('dashboard.costOfLife.savingsCapacity') }}</span>
          <strong>{{
            financialYear.totals ? formatCurrency(financialYear.totals.savings || 0) : '—'
          }}</strong>
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
import { currentFinancialYear } from '@/domain/financial/financial-year'
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
const latestNetWorth = computed(() => {
  const months = Object.entries(financialYear.value?.months || {}).sort(([first], [second]) =>
    second.localeCompare(first),
  )
  const month = months.find(([, value]) => value?.netWorth != null)
  return month ? Number(month[1].netWorth) : null
})
const loading = computed(() => financialYearsStore.loading)
const error = computed(() => financialYearsStore.error)

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
.eyebrow {
  @include financial-eyebrow;
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
