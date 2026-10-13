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
      return [
        categoryId,
        {
          ...config,
          manualEstimate: category.manualEstimate || { amount: 0, frequency: 'monthly' },
          necessity: category.necessity ?? null,
        },
      ]
    }),
  )
}
