<template>
  <section class="scrutiny-report">
    <h1>SCRUTINY</h1>
    <p>
      The prosecution has reviewed
      <strong>{{ stats.crimesCommitted }}</strong>
      incidents involving
      <strong>{{ formatMoney(stats.totalDamages, currency) }}</strong>
      .
    </p>

    <div class="scrutiny-stat-grid">
      <div v-for="item in statCards" :key="item.label" class="scrutiny-stat">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </div>
    </div>

    <section class="wanted-panel">
      <div class="court-chart-heading">
        <div class="section-heading">MOST WANTED</div>
        <q-btn
          class="court-chart-info-button"
          flat
          round
          dense
          color="warning"
          icon="info"
          aria-label="More information about Most Wanted"
          @click="openChartInfo('wanted')"
        />
      </div>
      <div v-if="wantedRows.length" class="wanted-chart-list">
        <div
          v-for="row in wantedRows"
          :key="row.category.id"
          class="wanted-chart-row"
          role="button"
          tabindex="0"
          @click="openCategoryDetails(row)"
          @keydown.enter.prevent="openCategoryDetails(row)"
          @keydown.space.prevent="openCategoryDetails(row)"
        >
          <div class="wanted-chart-rank">{{ row.rank }}</div>
          <div class="wanted-chart-name">
            <span>{{ row.category.emoji }}</span>
            <strong>{{ row.category.shortLabel || row.category.label }}</strong>
          </div>
          <BasicChart
            class="wanted-chart-bar"
            height="24px"
            renderer="svg"
            :options="row.options"
          />
          <div class="wanted-chart-amount">{{ formatMoney(row.category.amount, currency) }}</div>
        </div>
      </div>
    </section>

    <section v-if="stats.preventedCategoryTotals.length" class="wanted-panel prevented-panel">
      <div class="court-chart-heading">
        <div class="section-heading">CRIMES PREVENTED</div>
        <q-btn
          class="court-chart-info-button"
          flat
          round
          dense
          color="warning"
          icon="info"
          aria-label="More information about Crimes Prevented"
          @click="openChartInfo('prevented')"
        />
      </div>
      <div class="wanted-chart-list">
        <div
          v-for="row in preventedRows"
          :key="row.category.id"
          class="wanted-chart-row"
          role="button"
          tabindex="0"
          @click="openCategoryDetails(row)"
          @keydown.enter.prevent="openCategoryDetails(row)"
          @keydown.space.prevent="openCategoryDetails(row)"
        >
          <div class="wanted-chart-rank wanted-chart-rank--prevented">{{ row.rank }}</div>
          <div class="wanted-chart-name">
            <span>🍃</span>
            <strong>{{ row.category.shortLabel || row.category.label }}</strong>
          </div>
          <BasicChart
            class="wanted-chart-bar"
            height="24px"
            renderer="svg"
            :options="row.options"
          />
          <div class="wanted-chart-amount wanted-chart-amount--prevented">
            {{ formatMoney(row.category.amount, currency) }}
          </div>
        </div>
      </div>
    </section>

    <section v-if="timeline.length" class="wanted-panel criminal-timeline-panel">
      <div class="criminal-timeline-header">
        <div class="court-chart-heading">
          <div class="section-heading">CRIMINAL TIMELINE</div>
          <q-btn
            class="court-chart-info-button"
            flat
            round
            dense
            color="warning"
            icon="info"
            aria-label="More information about Criminal Timeline"
            @click="openChartInfo('timeline')"
          />
        </div>
        <span>{{ timelineMode === 'year' ? 'ALL RECORDED YEARS' : '12-MONTH RECORD' }}</span>
      </div>
      <div v-if="behaviourInsight" class="criminal-timeline-insight">
        <div class="criminal-timeline-insight__copy">
          <strong>{{ behaviourInsight.title.toLowerCase() }}</strong>
          <p>{{ behaviourInsight.text }}</p>
        </div>
        <div class="criminal-timeline-insight__numbers">
          <span>{{ previousDamageLabel }}</span>
          <q-icon name="arrow_forward" />
          <strong>{{ formatMoney(stats.totalDamages, currency) }}</strong>
        </div>
      </div>
      <div class="criminal-timeline-legend" aria-hidden="true">
        <span><i class="criminal-timeline-legend__damage" />Damages</span>
        <span><i class="criminal-timeline-legend__law" />Line of the Law</span>
      </div>
      <div class="criminal-timeline-chart-shell">
        <BasicChart
          class="criminal-timeline-chart"
          height="230px"
          renderer="svg"
          :options="timelineChartOptions"
          @chart-click="openTimelineDetails"
        />
        <div class="criminal-timeline-hotspots" :style="{ '--timeline-columns': timeline.length }">
          <button
            v-for="(entry, index) in timeline"
            :key="entry.key"
            class="criminal-timeline-hotspot"
            type="button"
            :aria-label="`Open criminal record for ${entry.label}`"
            @click="openTimelineDetails({ dataIndex: index })"
          />
        </div>
      </div>
    </section>

    <q-dialog v-model="categoryDetailDialog" position="bottom">
      <q-card v-if="selectedCategoryDetail" class="category-detail-sheet">
        <q-card-section class="category-detail-sheet__header">
          <div>
            <div class="section-kicker">{{ selectedCategoryDetail.title }}</div>
            <h2>
              <span>{{ selectedCategoryDetail.icon }}</span>
              {{
                selectedCategoryDetail.category.shortLabel || selectedCategoryDetail.category.label
              }}
            </h2>
          </div>
          <q-btn flat round dense color="white" icon="close" aria-label="Close" v-close-popup />
        </q-card-section>

        <q-card-section class="category-detail-sheet__summary">
          <div>
            <span>Total</span>
            <strong>{{ formatMoney(selectedCategoryDetail.category.amount, currency) }}</strong>
          </div>
          <div>
            <span>Cases</span>
            <strong>{{ selectedCategoryDetail.category.count }}</strong>
          </div>
          <div v-if="selectedCategoryDetail.category.pendingCount">
            <span>Unreported</span>
            <strong>{{ selectedCategoryDetail.category.pendingCount }}</strong>
          </div>
        </q-card-section>

        <q-card-section class="category-detail-sheet__list">
          <div
            v-for="crime in selectedCategoryDetail.category.crimes"
            :key="crime.id"
            class="category-detail-crime"
          >
            <div>
              <strong>{{ crime.title || crime.crimeName || 'Untitled crime' }}</strong>
              <span>{{ formatDetailDate(crime.occurredAt || crime.createdAt) }}</span>
            </div>
            <strong
              class="category-detail-crime__amount"
              :class="{
                'category-detail-crime__amount--prevented': selectedCategoryDetail.isPrevented,
              }"
            >
              {{ crime.amount == null ? 'Unreported' : formatMoney(crime.amount, currency) }}
            </strong>
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="timelineDetailDialog" position="bottom">
      <q-card v-if="selectedTimelineEntry" class="category-detail-sheet">
        <q-card-section class="category-detail-sheet__header">
          <div>
            <div class="section-kicker">
              {{ timelineMode === 'year' ? 'ANNUAL CRIMINAL RECORD' : 'MONTHLY CRIMINAL RECORD' }}
            </div>
            <h2>{{ selectedTimelineEntry.label }}</h2>
          </div>
          <q-btn flat round dense color="white" icon="close" aria-label="Close" v-close-popup />
        </q-card-section>

        <q-card-section class="category-detail-sheet__summary timeline-detail-summary">
          <div>
            <span>Damages</span>
            <strong>{{ formatMoney(selectedTimelineEntry.amount, currency) }}</strong>
          </div>
          <div>
            <span>Line of the Law</span>
            <strong>{{ timelineAllowanceLabel }}</strong>
          </div>
          <div>
            <span>Cases</span>
            <strong>{{ selectedTimelineEntry.count }}</strong>
          </div>
        </q-card-section>

        <q-card-section class="timeline-detail-verdict">
          <div class="section-kicker">COURT NOTE</div>
          <strong>{{ timelineDifferenceLabel }}</strong>
          <p>{{ timelineVerdict }}</p>
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="chartInfoDialog" position="bottom">
      <q-card v-if="activeChartInfo" class="category-detail-sheet court-chart-info-sheet">
        <q-card-section class="category-detail-sheet__header">
          <div>
            <div class="section-kicker">CASE NOTES</div>
            <h2>{{ activeChartInfo.title }}</h2>
          </div>
          <q-btn flat round dense color="white" icon="close" aria-label="Close" v-close-popup />
        </q-card-section>

        <q-card-section class="court-chart-info-sheet__body">
          <p>{{ activeChartInfo.copy }}</p>
          <p class="court-chart-info-sheet__note">{{ activeChartInfo.note }}</p>
        </q-card-section>
      </q-card>
    </q-dialog>
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
  timeline: {
    type: Array,
    required: true,
  },
  timelineMode: {
    type: String,
    required: true,
  },
  statCards: {
    type: Array,
    required: true,
  },
  behaviourInsight: {
    type: Object,
    default: null,
  },
  previousDamageLabel: {
    type: String,
    required: true,
  },
})

const wantedCategories = computed(() => props.stats.categoryTotals.slice(0, 5))
const preventedCategories = computed(() => props.stats.preventedCategoryTotals.slice(0, 5))
const wantedRows = computed(() =>
  buildCategoryRows({
    categories: wantedCategories.value,
    barColors: ['#24d6c3', '#42b6f5', '#ff8a4c'],
    detailTitle: 'Most Wanted',
  }),
)
const preventedRows = computed(() =>
  buildCategoryRows({
    categories: preventedCategories.value,
    barColors: ['#39d98a', '#8eea74'],
    detailTitle: 'Crimes Prevented',
    iconFallback: '🍃',
    isPrevented: true,
  }),
)
const timelineChartOptions = computed(() => {
  const amounts = props.timeline.map((entry) => entry.amount)
  const allowances = props.timeline
    .map((entry) => entry.allowance)
    .filter((allowance) => allowance != null)
  const maxValue = Math.max(...amounts, ...allowances, 1)

  return {
    animationDuration: 650,
    backgroundColor: 'transparent',
    grid: {
      top: 30,
      right: 8,
      bottom: props.timelineMode === 'year' && props.timeline.length > 8 ? 52 : 38,
      left: 8,
      containLabel: false,
    },
    tooltip: { show: false },
    xAxis: {
      type: 'category',
      data: props.timeline.map((entry) => entry.axisLabel),
      axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.18)' } },
      axisTick: { show: false },
      axisLabel: {
        color: '#a8a8a8',
        fontSize: 9,
        interval: 0,
        rotate: props.timelineMode === 'year' && props.timeline.length > 8 ? 45 : 0,
        formatter: (value) => value.replace(' ', '\n'),
      },
    },
    yAxis: {
      type: 'value',
      show: false,
      max: maxValue * 1.16,
    },
    series: [
      {
        name: 'Damages',
        type: 'bar',
        data: props.timeline.map((entry) => ({
          value: entry.amount,
          itemStyle: {
            color: entry.exceeded ? '#ff5252' : '#f5b800',
            borderRadius: [5, 5, 0, 0],
          },
        })),
        barMaxWidth: props.timelineMode === 'year' ? 44 : 22,
        label: {
          show: true,
          position: 'top',
          distance: 5,
          color: '#ff6b6b',
          fontSize: 12,
          formatter: ({ dataIndex }) => (props.timeline[dataIndex]?.exceeded ? '🚨' : ''),
        },
        emphasis: {
          itemStyle: {
            opacity: 0.78,
          },
        },
      },
      {
        name: 'Line of the Law',
        type: 'line',
        data: props.timeline.map((entry) => entry.allowance),
        connectNulls: false,
        ...(props.timelineMode === 'month' ? { step: 'middle' } : {}),
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: {
          color: '#ff6b6b',
          type: 'dashed',
          width: 2,
        },
        itemStyle: {
          color: '#ff6b6b',
        },
        emphasis: {
          disabled: true,
        },
        z: 3,
      },
    ],
  }
})
const categoryDetailDialog = ref(false)
const selectedCategoryDetail = ref(null)
const timelineDetailDialog = ref(false)
const selectedTimelineEntry = ref(null)
const chartInfoDialog = ref(false)
const activeChartInfo = ref(null)
const timelineAllowanceLabel = computed(() =>
  selectedTimelineEntry.value?.allowance == null
    ? 'Not set'
    : formatMoney(selectedTimelineEntry.value.allowance, props.currency),
)
const timelineDifferenceLabel = computed(() => {
  const entry = selectedTimelineEntry.value
  if (!entry || entry.allowance == null) return 'No allowance was on file.'

  const difference = entry.amount - entry.allowance
  if (difference > 0) return `${formatMoney(difference, props.currency)} over the line.`
  if (difference < 0) return `${formatMoney(Math.abs(difference), props.currency)} under the line.`
  return 'Exactly on the line.'
})
const timelineVerdict = computed(() => getTimelineVerdict(selectedTimelineEntry.value))

function buildCategoryRows({
  categories,
  barColors,
  detailTitle,
  iconFallback,
  isPrevented = false,
}) {
  const maxAmount = Math.max(...categories.map((category) => category.amount), 1)

  return categories.map((category, index) => ({
    category,
    rank: index + 1,
    options: buildSingleCategoryBarOptions({
      category,
      maxAmount,
      barColors,
    }),
    title: detailTitle,
    icon: iconFallback || category.emoji || '',
    isPrevented,
  }))
}

function buildSingleCategoryBarOptions({ category, maxAmount, barColors }) {
  return {
    animationDuration: 650,
    backgroundColor: 'transparent',
    grid: {
      top: 5,
      right: 0,
      bottom: 5,
      left: 0,
      containLabel: false,
    },
    tooltip: { show: false },
    xAxis: {
      type: 'value',
      show: false,
      max: maxAmount,
    },
    yAxis: {
      type: 'category',
      show: false,
      data: [category.id],
    },
    series: [
      {
        type: 'bar',
        data: [
          {
            value: maxAmount,
            category,
          },
        ],
        barWidth: 24,
        barGap: '-100%',
        itemStyle: {
          color: 'rgba(255, 255, 255, 0)',
          borderRadius: 999,
        },
        emphasis: {
          disabled: true,
        },
      },
      {
        type: 'bar',
        data: [
          {
            value: category.amount,
            category,
            itemStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 1,
                y2: 0,
                colorStops: barColors.map((color, index) => ({
                  offset: index / Math.max(barColors.length - 1, 1),
                  color,
                })),
              },
              borderRadius: 999,
            },
          },
        ],
        barWidth: 14,
        barMinWidth: 18,
        backgroundStyle: {
          color: 'rgba(255, 255, 255, 0.13)',
          borderRadius: 999,
        },
        emphasis: {
          disabled: true,
        },
        showBackground: true,
      },
    ],
  }
}

function openCategoryDetails(row) {
  selectedCategoryDetail.value = row
  categoryDetailDialog.value = true
}

function openTimelineDetails({ dataIndex }) {
  const entry = props.timeline[dataIndex]
  if (!entry) return

  selectedTimelineEntry.value = entry
  timelineDetailDialog.value = true
}

function openChartInfo(key) {
  if (key === 'wanted') {
    activeChartInfo.value = {
      title: 'Most Wanted',
      copy: 'The five categories with the highest total damages are ranked for the selected month or year.',
      note: 'Tap a category to review the individual cases behind it.',
    }
  } else if (key === 'prevented') {
    activeChartInfo.value = {
      title: 'Crimes Prevented',
      copy: 'Categories are ranked by the potential damages you avoided during the selected month or year.',
      note: 'Tap a category to review the individual crimes you prevented.',
    }
  } else {
    activeChartInfo.value = {
      title: 'Criminal Timeline',
      copy:
        props.timelineMode === 'year'
          ? 'Each bar represents the total damages recorded in a year. Red bars crossed the annual Line of the Law.'
          : "The chart follows the 12 months ending with the selected month. Red bars crossed that month's Line of the Law.",
      note: 'Tap a bar to review the evidence, allowance and court note.',
    }
  }

  chartInfoDialog.value = true
}

function getTimelineVerdict(entry) {
  if (!entry) return ''
  if (entry.amount === 0) return 'A suspiciously clean record. The court found no damages.'
  if (entry.allowance == null) return 'Evidence recorded, but no Line of the Law was in force.'

  const allowanceRatio = entry.allowance > 0 ? entry.amount / entry.allowance : Infinity
  if (allowanceRatio <= 0.5) return 'Uncharacteristic restraint. The prosecution is disappointed.'
  if (allowanceRatio <= 1) return 'You escaped conviction, but the court is keeping the file open.'
  if (allowanceRatio <= 1.25) return 'The Line of the Law was crossed. Probation seems generous.'
  return 'Repeat-offender territory. The budget never stood a chance.'
}

function formatDetailDate(value) {
  if (!value) return 'Unknown date'

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}
</script>
