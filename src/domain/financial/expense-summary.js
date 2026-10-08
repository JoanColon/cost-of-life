import { buildSummaryCategories, totalCategories } from './category-summary'
import { normalizeMoney } from './money'

export function buildExpenseSummaryCategories(
  categoryIds,
  selectedCategoryIds,
  existingCategories,
  memberIds,
) {
  const categories = buildSummaryCategories(
    categoryIds,
    selectedCategoryIds,
    existingCategories,
    memberIds,
  )

  return Object.fromEntries(
    Object.entries(categories).map(([categoryId, category]) => [
      categoryId,
      {
        ...category,
        manualEstimate: category.manualEstimate || { amount: 0, frequency: 'monthly' },
        necessity: category.necessity ?? null,
      },
    ]),
  )
}

export function costOfLifeTotals(summary, memberId = 'all') {
  const annualCostOfLife = totalCategories(summary, memberId) || 0
  return {
    annualCostOfLife,
    monthlyCostOfLife: normalizeMoney(annualCostOfLife / 12) || 0,
  }
}
