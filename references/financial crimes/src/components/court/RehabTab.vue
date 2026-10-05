<template>
  <section class="rehabilitation-report">
    <h1>YOUR REHAB PLAN</h1>
    <p>Same spending. Different future.</p>

    <section class="rehab-current">
      <span>CURRENT FINANCIAL CRIMES</span>
      <strong>{{ currentFinancialCrimesLabel }}</strong>
    </section>

    <section class="rehab-control">
      <div class="section-heading">REDUCE YOUR DAMAGES BY:</div>
      <q-btn-toggle
        :model-value="selectedReduction"
        class="rehab-toggle"
        toggle-color="warning"
        toggle-text-color="black"
        text-color="white"
        unelevated
        spread
        :options="reductionOptions"
        @update:model-value="$emit('update:selectedReduction', $event)"
      />
    </section>

    <section class="rehab-result">
      <strong>{{ rehabilitatedPrimaryLabel }}</strong>
      <span>{{ rehabilitatedSecondaryLabel }}</span>
    </section>

    <section class="investment-panel">
      <div class="investment-panel__header">
        <div>
          <div class="section-heading">WHAT IF YOU INVESTED IT?</div>
          <p>Estimated future value.</p>
        </div>
        <q-btn-toggle
          :model-value="selectedAnnualRate"
          class="rate-toggle"
          toggle-color="secondary"
          toggle-text-color="warning"
          text-color="white"
          unelevated
          :options="rateOptions"
          @update:model-value="$emit('update:selectedAnnualRate', $event)"
        />
      </div>

      <div class="investment-chart-shell">
        <BasicChart
          class="investment-chart"
          height="178px"
          :options="investmentChartOptions"
          @chart-click="openInvestmentDetailsFromChart"
        />
        <button
          v-for="item in futureValues"
          :key="item.years"
          class="investment-chart-hotspot"
          type="button"
          :aria-label="`Open ${item.years} year investment scenario`"
          @click="openInvestmentDetails(item)"
        />
      </div>
      <small>Illustrative scenario. Returns are hypothetical and not guaranteed.</small>

      <q-dialog v-model="investmentDetailDialog" position="bottom">
        <q-card class="category-detail-sheet investment-detail-sheet">
          <q-card-section class="category-detail-sheet__header">
            <div>
              <span class="section-heading">Investment Scenario</span>
              <h2>
                <span>📈</span>
                {{ selectedInvestmentDetail?.years }} years
              </h2>
            </div>
            <q-btn v-close-popup flat round dense icon="close" color="white" aria-label="Close" />
          </q-card-section>

          <q-card-section class="category-detail-sheet__summary">
            <div>
              <span>Rate</span>
              <strong>{{ selectedAnnualRate }}%</strong>
            </div>
            <div>
              <span>{{ monthlyRehabLabel }}</span>
              <strong>{{ formatMoney(rehabilitatedMonthly, currency) }}</strong>
            </div>
            <div>
              <span>Future Value</span>
              <strong>
                {{ formatMoney(selectedInvestmentDetail?.value || 0, currency) }}
              </strong>
            </div>
          </q-card-section>

          <q-card-section class="investment-detail-sheet__note">
            <span>Annual Rehab</span>
            <strong>{{ formatMoney(rehabilitatedYearly, currency) }}</strong>
            <p>Illustrative scenario. Returns are hypothetical and not guaranteed.</p>
          </q-card-section>
        </q-card>
      </q-dialog>
    </section>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import BasicChart from '@/components/charts/BasicChart.vue'
import { formatMoney } from '@/utils/crimeStats'

const props = defineProps({
  stats: {
    type: Object,
    required: true,
  },
  currency: {
    type: String,
    required: true,
  },
  periodMode: {
    type: String,
    required: true,
    validator: (value) => ['month', 'year'].includes(value),
  },
  selectedReduction: {
    type: Number,
    required: true,
  },
  selectedAnnualRate: {
    type: Number,
    required: true,
  },
  reductionOptions: {
    type: Array,
    required: true,
  },
  rateOptions: {
    type: Array,
    required: true,
  },
  rehabilitatedMonthly: {
    type: Number,
    required: true,
  },
  rehabilitatedYearly: {
    type: Number,
    required: true,
  },
  futureValues: {
    type: Array,
    required: true,
  },
})

defineEmits(['update:selectedReduction', 'update:selectedAnnualRate'])

const investmentDetailDialog = ref(false)
const selectedInvestmentYears = ref(null)
const isYearPeriod = computed(() => props.periodMode === 'year')
const currentFinancialCrimesLabel = computed(() =>
  isYearPeriod.value
    ? `${formatMoney(props.stats.totalDamages, props.currency)} / year`
    : `${formatMoney(props.stats.totalDamages, props.currency)} / month`,
)
const rehabilitatedPrimaryLabel = computed(() =>
  isYearPeriod.value
    ? `${formatMoney(props.rehabilitatedYearly, props.currency)} / year could be rehabilitated`
    : `${formatMoney(props.rehabilitatedMonthly, props.currency)} / month could be rehabilitated`,
)
const rehabilitatedSecondaryLabel = computed(() =>
  isYearPeriod.value
    ? `${formatMoney(props.rehabilitatedMonthly, props.currency)} / month average`
    : `${formatMoney(props.rehabilitatedYearly, props.currency)} / year`,
)
const monthlyRehabLabel = computed(() =>
  isYearPeriod.value ? 'Monthly Avg Rehab' : 'Monthly Rehab',
)
const selectedInvestmentDetail = computed(
  () =>
    props.futureValues.find((item) => item.years === selectedInvestmentYears.value) ||
    props.futureValues[0] ||
    null,
)

const investmentChartOptions = computed(() => ({
  animationDuration: 650,
  backgroundColor: 'transparent',
  grid: {
    top: 34,
    right: 10,
    bottom: 26,
    left: 10,
    containLabel: false,
  },
  tooltip: {
    show: false,
  },
  xAxis: {
    type: 'category',
    data: props.futureValues.map((item) => `${item.years} years`),
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      color: '#cfc3ae',
      fontSize: 12,
      fontFamily: 'Roboto, Arial, sans-serif',
      margin: 10,
    },
  },
  yAxis: {
    type: 'value',
    show: false,
    max: Math.max(...props.futureValues.map((item) => item.value), 1),
  },
  series: [
    {
      type: 'bar',
      data: props.futureValues.map((item) => ({
        value: item.value,
        item,
      })),
      barWidth: 58,
      barMinHeight: 8,
      showBackground: true,
      backgroundStyle: {
        color: 'rgba(255, 255, 255, 0.11)',
        borderRadius: [5, 5, 0, 0],
      },
      itemStyle: {
        borderRadius: [5, 5, 0, 0],
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: '#38ffe9' },
            { offset: 1, color: '#2aa5e8' },
          ],
        },
      },
      label: {
        show: true,
        position: 'top',
        distance: 8,
        color: '#38ffe9',
        fontSize: 12,
        fontWeight: 950,
        formatter: ({ data }) => formatMoney(data.item.value, props.currency),
      },
    },
  ],
}))

function openInvestmentDetailsFromChart({ data }) {
  if (!data?.item) return

  openInvestmentDetails(data.item)
}

function openInvestmentDetails(item) {
  if (!item) return

  selectedInvestmentYears.value = item.years
  investmentDetailDialog.value = true
}
</script>
