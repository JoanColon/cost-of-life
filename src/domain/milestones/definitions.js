import { liabilityCategoryIds } from '@/config/liability-categories'

export const INVESTABLE_ASSET_CATEGORY_IDS = Object.freeze(['investment'])

const consumerDebtCategoryIds = Object.freeze(['personal_loan', 'credit_card_debt', 'other_debt'])

export const milestoneDefinitions = Object.freeze([
  ...[1, 3, 6, 12].map((target) => ({
    id: `safety_${target}_month${target === 1 ? '' : 's'}`,
    family: 'safety',
    target,
  })),
  { id: 'net_worth_positive', family: 'netWorth', target: 0, positive: true },
  ...[100_000, 250_000, 500_000, 1_000_000].map((target) => ({
    id: `net_worth_${target}`,
    family: 'netWorth',
    target,
  })),
  {
    id: 'debt_consumer_free',
    family: 'debt',
    target: 0,
    liabilityCategoryIds: consumerDebtCategoryIds,
  },
  {
    id: 'debt_car_free',
    family: 'debt',
    target: 0,
    liabilityCategoryIds: Object.freeze(['car_loan']),
  },
  {
    id: 'debt_student_free',
    family: 'debt',
    target: 0,
    liabilityCategoryIds: Object.freeze(['student_loan']),
  },
  {
    id: 'debt_mortgage_free',
    family: 'debt',
    target: 0,
    liabilityCategoryIds: Object.freeze(['mortgage']),
  },
  {
    id: 'debt_free',
    family: 'debt',
    target: 0,
    liabilityCategoryIds: Object.freeze([...liabilityCategoryIds]),
  },
  ...[5, 10, 15, 20, 25].map((target) => ({
    id: `freedom_${target}_year${target === 1 ? '' : 's'}`,
    family: 'freedom',
    target,
  })),
])

export const milestoneIds = Object.freeze(milestoneDefinitions.map(({ id }) => id))
