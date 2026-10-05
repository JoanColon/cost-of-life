<template>
  <DashboardCard
    :title="t('dashboard.financialPosition.title')"
    :subtitle="t('dashboard.financialPosition.subtitle')"
    @open="$emit('open')"
  >
    <div class="position-content">
      <div class="net-worth">
        <strong>{{ formatCurrency(data.netWorth) }}</strong>
        <span>{{ t('dashboard.financialPosition.netWorth') }}</span>
      </div>

      <div class="position-breakdown">
        <button class="breakdown-row breakdown-action" type="button" @click="$emit('open-assets')">
          <div class="breakdown-icon assets">
            <q-icon name="account_balance_wallet" />
          </div>
          <div class="breakdown-value">
            <span>{{ t('dashboard.financialPosition.assets') }}</span>
            <strong>{{ formatCurrency(data.assets) }}</strong>
          </div>
          <q-icon name="chevron_right" class="breakdown-chevron" />
        </button>
        <div class="breakdown-row">
          <div class="breakdown-icon liabilities">
            <q-icon name="credit_card" />
          </div>
          <div class="breakdown-value">
            <span>{{ t('dashboard.financialPosition.liabilities') }}</span>
            <strong>{{ formatCurrency(data.liabilities) }}</strong>
          </div>
        </div>
      </div>
    </div>
  </DashboardCard>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import DashboardCard from './DashboardCard.vue'
import { formatCurrency } from '@/utils/formatters'

defineProps({ data: { type: Object, required: true } })
defineEmits(['open', 'open-assets'])
const { t } = useI18n()
</script>

<style scoped lang="scss">
.position-card {
  display: flex;
  flex-direction: column;
}

.position-content {
  display: flex;
  flex: 1;
  flex-direction: column;
}

.net-worth {
  display: block;
}

.net-worth strong,
.net-worth span {
  display: block;
}

.net-worth strong {
  color: var(--color-ink);
  font-size: clamp(2.55rem, 5vw, 4.6rem);
  font-weight: 760;
  line-height: 1;
  letter-spacing: -0.055em;
  white-space: nowrap;
}

.net-worth span {
  margin-top: 0.4rem;
  color: var(--color-copy);
}

.position-breakdown {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: auto;
  padding-top: 1.25rem;
  border-top: 1px solid var(--color-line);
}

.breakdown-row {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  min-width: 0;
  padding: 0 1rem;
  border-right: 1px solid var(--color-line);
  background: transparent;
  color: var(--color-ink);
  text-align: left;
}

.breakdown-row:first-child {
  padding-left: 0;
}

.breakdown-row:last-child {
  padding-right: 0;
  border-right: 0;
}

.breakdown-action {
  border-top: 0;
  border-bottom: 0;
  border-left: 0;
  cursor: pointer;
}

.breakdown-action:hover .breakdown-value strong,
.breakdown-action:focus-visible .breakdown-value strong {
  color: var(--color-primary);
}

.breakdown-action:focus-visible {
  border-radius: 0.5rem;
  outline: 3px solid rgb(22 136 248 / 22%);
  outline-offset: 3px;
}

.breakdown-chevron {
  margin-left: auto;
  color: var(--color-copy);
}

.breakdown-icon {
  display: grid;
  place-items: center;
  flex: 0 0 2.8rem;
  width: 2.8rem;
  height: 2.8rem;
  border-radius: 50%;
  font-size: 1.35rem;
}

.breakdown-icon.assets {
  background: var(--color-green-soft);
  color: var(--color-success-dark);
}

.breakdown-icon.liabilities {
  background: var(--color-red-soft, #fdebed);
  color: var(--color-danger);
}

.breakdown-value {
  min-width: 0;
}

.breakdown-value span {
  display: block;
  overflow: hidden;
  color: var(--color-copy);
  font-size: 0.78rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.breakdown-value strong {
  display: block;
  margin-top: 0.12rem;
  font-size: clamp(1rem, 1.7vw, 1.3rem);
  white-space: nowrap;
}

@media (max-width: 699px) {
  .position-content {
    min-height: 14rem;
  }

  .net-worth strong {
    font-size: clamp(2.2rem, 11vw, 3.25rem);
  }

  .breakdown-row {
    gap: 0.45rem;
    padding: 0 0.45rem;
  }

  .breakdown-icon {
    flex-basis: 2.25rem;
    width: 2.25rem;
    height: 2.25rem;
    font-size: 1.05rem;
  }

  .breakdown-value span {
    font-size: 0.67rem;
  }

  .breakdown-value strong {
    font-size: 0.9rem;
  }
}

@media (max-width: 370px) {
  .net-worth strong {
    font-size: 1.9rem;
  }
}
</style>
