import { buildModelCategories } from './model-categories'

export function buildExpenseModelCategories(
  categoryIds,
  selectedCategoryIds,
  existingCategories,
  memberIds,
) {
  const categories = buildModelCategories(
    categoryIds,
    selectedCategoryIds,
    existingCategories,
    memberIds,
  )

  return Object.fromEntries(
    Object.entries(categories).map(([categoryId, category]) => {
      const config = { ...category }
      delete config.manualValue
      delete config.manualEstimate
      delete config.monthlyAmounts
      delete config.necessity
      delete config.ownership
      delete config.subcategories
      return [categoryId, config]
    }),
  )
}
