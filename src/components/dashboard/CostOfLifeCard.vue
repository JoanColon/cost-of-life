<template>
  <DashboardCard
    class="cost-card"
    :title="t('dashboard.costOfLife.title')"
    :subtitle="t('dashboard.costOfLife.subtitle')"
    @open="$emit('open')"
  >
    <div class="cost-main">
      <div class="cost-values">
        <div class="annual-value">
          {{ formatCurrency(data.annualCost) }}<span>/ {{ t('dashboard.year') }}</span>
        </div>
        <div class="monthly-value">
          {{ formatCurrency(data.monthlyCost) }} <span>/ {{ t('dashboard.month') }}</span>
        </div>
      </div>

      <div class="cost-ring" :style="{ '--progress': `${Math.min(data.costRatio, 100) * 3.6}deg` }">
        <div class="ring-center">
          <strong>{{ data.costRatio }}%</strong>
          <span>{{ t('dashboard.costOfLife.incomeRatio') }}</span>
        </div>
      </div>
    </div>

    <div class="metric-grid">
      <div v-for="metric in metrics" :key="metric.label" class="metric">
        <div class="metric-icon" :class="metric.tone">
          <q-icon :name="metric.icon" />
        </div>
        <div>
          <div class="metric-label">{{ metric.label }}</div>
          <strong>{{ metric.value }}</strong>
        </div>
      </div>
    </div>
  </DashboardCard>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import DashboardCard from './DashboardCard.vue'
import { formatCurrency } from '@/utils/formatters'

const props = defineProps({ data: { type: Object, required: true } })
defineEmits(['open'])
const { t } = useI18n()

const metrics = computed(() => [
  {
    label: t('dashboard.costOfLife.income'),
    value: formatCurrency(props.data.income),
    icon: 'account_balance_wallet',
    tone: 'green',
  },
  {
    label: t('dashboard.costOfLife.cashFlow'),
    value: formatCurrency(props.data.freeCashFlow),
    icon: 'bar_chart',
    tone: 'blue',
  },
  {
    label: t('dashboard.costOfLife.savingsRate'),
    value: `${props.data.savingsRate}%`,
    icon: 'savings',
    tone: 'purple',
  },
])
</script>

<style scoped lang="scss">
.cost-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 2rem;
}

.annual-value {
  color: var(--color-ink);
  font-size: clamp(2.55rem, 5vw, 4.6rem);
  font-weight: 760;
  line-height: 1;
  letter-spacing: -0.055em;
}

.annual-value span,
.monthly-value span {
  color: var(--color-copy);
  font-size: 0.48em;
  font-weight: 450;
  letter-spacing: -0.02em;
}

.monthly-value {
  margin-top: 0.65rem;
  font-size: clamp(1.4rem, 3vw, 2rem);
  font-weight: 700;
}

.cost-ring {
  display: grid;
  width: clamp(8.5rem, 14vw, 11.5rem);
  aspect-ratio: 1;
  padding: 1rem;
  border-radius: 50%;
  background: conic-gradient(
    var(--color-success) 0deg var(--progress),
    #e9f1ef var(--progress) 360deg
  );
  box-shadow: inset 0 0 0 1px rgb(25 95 75 / 5%);
}

.ring-center {
  display: grid;
  place-content: center;
  padding: 0.5rem;
  border-radius: 50%;
  background: var(--color-surface);
  text-align: center;
}

.ring-center strong {
  font-size: clamp(1.65rem, 3vw, 2.35rem);
}

.ring-center span {
  max-width: 7rem;
  margin-top: 0.25rem;
  color: var(--color-copy);
  font-size: 0.78rem;
  line-height: 1.3;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 1.5rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--color-line);
}

.metric {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  min-width: 0;
  padding: 0 1rem;
  border-right: 1px solid var(--color-line);
}

.metric:first-child {
  padding-left: 0;
}

.metric:last-child {
  padding-right: 0;
  border-right: 0;
}

.metric-icon {
  display: grid;
  place-items: center;
  flex: 0 0 2.8rem;
  width: 2.8rem;
  height: 2.8rem;
  border-radius: 50%;
  font-size: 1.35rem;
}

.metric-icon.green {
  background: var(--color-green-soft);
  color: var(--color-success-dark);
}

.metric-icon.blue {
  background: var(--color-blue-soft);
  color: var(--color-primary);
}

.metric-icon.purple {
  background: var(--color-purple-soft);
  color: var(--color-purple);
}

.metric-label {
  overflow: hidden;
  color: var(--color-copy);
  font-size: 0.78rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric strong {
  display: block;
  margin-top: 0.12rem;
  font-size: clamp(1rem, 1.7vw, 1.3rem);
  white-space: nowrap;
}

@media (max-width: 699px) {
  .cost-main {
    gap: 1rem;
  }

  .cost-ring {
    width: 7.6rem;
    padding: 0.75rem;
  }

  .annual-value {
    font-size: clamp(2.2rem, 11vw, 3.25rem);
  }

  .metric-grid {
    gap: 0;
  }

  .metric {
    gap: 0.45rem;
    padding: 0 0.45rem;
  }

  .metric-icon {
    flex-basis: 2.25rem;
    width: 2.25rem;
    height: 2.25rem;
    font-size: 1.05rem;
  }

  .metric-label {
    font-size: 0.67rem;
  }

  .metric strong {
    font-size: 0.9rem;
  }
}

@media (max-width: 430px) {
  .cost-ring {
    width: 6.7rem;
  }

  .ring-center span {
    font-size: 0.66rem;
  }
}

@media (max-width: 370px) {
  .cost-main {
    gap: 0.4rem;
  }

  .annual-value {
    font-size: 1.9rem;
  }

  .cost-ring {
    width: 5.6rem;
    padding: 0.55rem;
  }

  .ring-center span {
    display: none;
  }
}
</style>
