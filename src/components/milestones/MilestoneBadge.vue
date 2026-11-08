<template>
  <span
    class="milestone-badge"
    :class="[
      `milestone-badge--${family}`,
      `milestone-badge--level-${badgeLevel}`,
      {
        'milestone-badge--asset': badgeAsset,
        'milestone-badge--final': final,
        'milestone-badge--locked': locked,
      },
    ]"
    aria-hidden="true"
  >
    <img v-if="badgeAsset" :src="badgeAsset" alt="" class="badge-asset" />
    <svg v-else-if="family === 'safety'" viewBox="0 0 64 64">
      <path
        class="badge-frame"
        d="M32 5 51 12v14c0 13-7.7 24.8-19 31C20.7 50.8 13 39 13 26V12L32 5Z"
      />
      <g class="badge-detail">
        <ellipse cx="32" cy="36" rx="8" ry="3" />
        <path d="M24 36v5c0 1.8 3.6 3 8 3s8-1.2 8-3v-5" />
      </g>
      <g v-if="badgeLevel >= 1" class="badge-detail">
        <ellipse cx="32" cy="30" rx="8" ry="3" />
        <path d="M24 30v5c0 1.8 3.6 3 8 3s8-1.2 8-3v-5" />
      </g>
      <g v-if="badgeLevel >= 2" class="badge-detail">
        <ellipse cx="32" cy="24" rx="8" ry="3" />
        <path d="M24 24v5c0 1.8 3.6 3 8 3s8-1.2 8-3v-5M18 22l-3-3m31 3 3-3" />
      </g>
      <path
        v-if="badgeLevel >= 3"
        class="badge-accent"
        d="m32 12 2 4 4 .6-3 3 .7 4.2-3.7-2-3.7 2 .7-4.2-3-3 4-.6 2-4Z"
      />
    </svg>
    <svg v-else-if="family === 'freedom'" viewBox="0 0 64 64">
      <circle v-if="badgeLevel >= 2" class="badge-sun" cx="47" cy="14" r="5" />
      <path class="badge-fill" d="m7 50 17-29 17 29H7Z" />
      <path class="badge-detail" d="m7 50 17-29 17 29m-24-17 7 5 6-7" />
      <path
        v-if="badgeLevel >= 1"
        class="badge-fill badge-fill--secondary"
        d="m27 50 14-23 16 23H27Z"
      />
      <path v-if="badgeLevel >= 1" class="badge-detail" d="m27 50 14-23 16 23m-21-15 5 4 5-5" />
      <path v-if="badgeLevel >= 3" class="badge-route" d="M14 49c7-6 11-3 17-8 5-4 6-9 10-14" />
      <path v-if="badgeLevel >= 2" class="badge-detail" d="M41 27V10m0 1h11l-4 4 4 4H41" />
    </svg>
    <svg v-else-if="family === 'debt'" viewBox="0 0 64 64">
      <g v-if="milestoneId === 'debt_consumer_free'">
        <rect class="badge-fill" x="10" y="17" width="44" height="30" rx="5" />
        <path class="badge-detail" d="M10 27h44M18 38h12M16 50 49 14" />
      </g>
      <g v-else-if="milestoneId === 'debt_car_free'">
        <path class="badge-fill" d="m13 35 5-13h28l5 13v11H13V35Z" />
        <path class="badge-detail" d="M17 35h30M22 46v5m20-5v5M21 29h22M18 40h4m20 0h4" />
      </g>
      <g v-else-if="milestoneId === 'debt_student_free'">
        <path class="badge-fill" d="m7 25 25-13 25 13-25 13L7 25Z" />
        <path class="badge-detail" d="M17 31v12c8 7 22 7 30 0V31M53 27v14" />
      </g>
      <g v-else-if="milestoneId === 'debt_mortgage_free'">
        <path class="badge-fill" d="M10 31 32 12l22 19v22H10V31Z" />
        <path class="badge-detail" d="M25 53V37h14v16M17 28v-9h8v2M13 52l38-38" />
      </g>
      <g v-else>
        <path class="badge-fill" d="m32 9 20 11-20 11L12 20 32 9Zm0 18 20 11-20 11-20-11 20-11Z" />
        <path class="badge-detail" d="m12 29 20 11 20-11M10 52 54 8" />
      </g>
    </svg>
    <svg v-else viewBox="0 0 64 64">
      <circle class="badge-fill" cx="32" cy="32" r="23" />
      <path class="badge-detail" d="M15 45V36m10 9V30m10 15V23" />
      <path v-if="badgeLevel >= 1" class="badge-detail" d="M45 45V17" />
      <path v-if="badgeLevel >= 2" class="badge-detail" d="m13 36 12-7 10 3 14-15" />
      <path v-if="badgeLevel >= 2" class="badge-accent" d="m44 16 6 1-1 6" />
      <circle v-if="badgeLevel >= 3" class="badge-ring" cx="32" cy="32" r="27" />
    </svg>

    <svg v-if="final && !badgeAsset" class="badge-laurel badge-laurel--left" viewBox="0 0 24 64">
      <path d="M20 57C5 47 3 25 16 8M11 43l-8-2m12-9-9-5m11-5-6-7" />
    </svg>
    <svg v-if="final && !badgeAsset" class="badge-laurel badge-laurel--right" viewBox="0 0 24 64">
      <path d="M4 57c15-10 17-32 4-49m5 35 8-2m-12-9 9-5M7 22l6-7" />
    </svg>
    <q-icon v-if="locked" name="lock_outline" class="badge-lock" />
  </span>
</template>

<script setup>
import { computed } from 'vue'
import safety1Month from '@/assets/milestones/01-safety-1-month.svg'
import safety3Months from '@/assets/milestones/02-safety-3-months.svg'
import safety6Months from '@/assets/milestones/03-safety-6-months.svg'
import safety12Months from '@/assets/milestones/04-safety-12-months.svg'
import freedom5Years from '@/assets/milestones/05-freedom-5-years.svg'
import freedom10Years from '@/assets/milestones/06-freedom-10-years.svg'
import freedom15Years from '@/assets/milestones/07-freedom-15-years.svg'
import freedom20Years from '@/assets/milestones/08-freedom-20-years.svg'
import freedom25Years from '@/assets/milestones/09-freedom-25-years.svg'
import debtMortgageFree from '@/assets/milestones/10-debt-mortgage-free.svg'
import debtFree from '@/assets/milestones/11-debt-free.svg'
import netWorthPositive from '@/assets/milestones/12-net-worth-positive.svg'
import netWorth100k from '@/assets/milestones/13-net-worth-100k.svg'
import netWorth250k from '@/assets/milestones/14-net-worth-250k.svg'
import netWorth500k from '@/assets/milestones/15-net-worth-500k.svg'
import netWorth1m from '@/assets/milestones/16-net-worth-1m.svg'

const badgeAssets = Object.freeze({
  safety_1_month: safety1Month,
  safety_3_months: safety3Months,
  safety_6_months: safety6Months,
  safety_12_months: safety12Months,
  freedom_5_years: freedom5Years,
  freedom_10_years: freedom10Years,
  freedom_15_years: freedom15Years,
  freedom_20_years: freedom20Years,
  freedom_25_years: freedom25Years,
  debt_mortgage_free: debtMortgageFree,
  debt_free: debtFree,
  net_worth_positive: netWorthPositive,
  net_worth_100000: netWorth100k,
  net_worth_250000: netWorth250k,
  net_worth_500000: netWorth500k,
  net_worth_1000000: netWorth1m,
})

const props = defineProps({
  family: { type: String, required: true },
  milestoneId: { type: String, required: true },
  level: { type: Number, default: 0 },
  final: { type: Boolean, default: false },
  locked: { type: Boolean, default: false },
})

const badgeLevel = computed(() => Math.max(0, Math.min(3, Number(props.level) || 0)))
const badgeAsset = computed(() => badgeAssets[props.milestoneId] || null)
</script>

<style scoped lang="scss">
.milestone-badge {
  position: relative;
  display: grid;
  width: 4.2rem;
  height: 4.2rem;
  place-items: center;
  color: var(--badge-color, var(--color-primary));
}

.milestone-badge > svg:not(.badge-laurel) {
  width: 3.8rem;
  height: 3.8rem;
  overflow: visible;
}

.badge-asset {
  display: block;
  width: 4.75rem;
  height: 4.75rem;
  object-fit: contain;
}

.badge-frame,
.badge-detail,
.badge-ring {
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.4;
}

.badge-fill {
  fill: color-mix(in srgb, currentColor 14%, transparent);
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.4;
}

.badge-fill--secondary {
  fill: color-mix(in srgb, currentColor 8%, transparent);
}

.badge-accent {
  fill: currentColor;
  stroke: currentColor;
  stroke-linejoin: round;
  stroke-width: 1.5;
}

.badge-sun {
  fill: color-mix(in srgb, currentColor 20%, white);
  stroke: currentColor;
  stroke-width: 2;
}

.badge-route {
  fill: none;
  stroke: currentColor;
  stroke-dasharray: 3 4;
  stroke-linecap: round;
  stroke-width: 2;
}

.milestone-badge--safety {
  --badge-color: var(--color-success);
}

.milestone-badge--freedom {
  --badge-color: var(--color-purple);
}

.milestone-badge--debt {
  --badge-color: var(--color-danger);
}

.milestone-badge--netWorth {
  --badge-color: var(--color-primary);
}

.milestone-badge--level-0:not(.milestone-badge--asset) {
  opacity: 0.82;
}

.milestone-badge--level-1:not(.milestone-badge--asset) {
  filter: saturate(0.9);
}

.milestone-badge--level-2:not(.milestone-badge--asset),
.milestone-badge--level-3:not(.milestone-badge--asset) {
  filter: saturate(1.12);
}

.milestone-badge--final {
  width: 5rem;
}

.badge-laurel {
  position: absolute;
  top: 0.1rem;
  width: 1.45rem;
  height: 4rem;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.2;
}

.badge-laurel--left {
  left: 0;
}

.badge-laurel--right {
  right: 0;
}

.milestone-badge--locked {
  color: #8c98aa;
  filter: saturate(0.1);
}

.badge-lock {
  position: absolute;
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 50%;
  background: rgb(255 255 255 / 92%);
  box-shadow: 0 0.2rem 0.7rem rgb(23 42 72 / 14%);
  font-size: 1.15rem;
}
</style>
