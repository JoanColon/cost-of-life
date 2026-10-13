import { cloneOwnership, createEqualOwnership } from './ownership'

export function buildModelCategories(
  categoryIds,
  selectedCategoryIds,
  existingCategories,
  memberIds,
) {
  const selected = new Set(selectedCategoryIds)

  return Object.fromEntries(
    categoryIds.map((categoryId) => {
      const previous = existingCategories[categoryId]
      if (previous) return [categoryId, { ...previous, enabled: selected.has(categoryId) }]

      const ownership = createEqualOwnership(memberIds)
      return [
        categoryId,
        {
          enabled: selected.has(categoryId),
          manualValue: 0,
          ownership: cloneOwnership(ownership),
        },
      ]
    }),
  )
}

export function canonicalCategory(category = {}) {
  const value = { ...category }
  delete value.manualValue
  delete value.manualEstimate
  delete value.monthlyAmounts
  delete value.ownership
  delete value.necessity
  delete value.itemCount
  delete value.itemizedValue
  delete value.memberValues
  return value
}

export function canonicalCategories(categories = {}) {
  return Object.fromEntries(
    Object.entries(categories).map(([categoryId, category]) => [
      categoryId,
      canonicalCategory(category),
    ]),
  )
}

export function hydrateModelConfigWithBaselines(config, baselines, fieldsForBaseline) {
  const byCategory = Object.fromEntries(baselines.map((baseline) => [baseline.category, baseline]))
  return {
    ...config,
    categories: Object.fromEntries(
      Object.entries(config?.categories || {}).map(([categoryId, category]) => [
        categoryId,
        {
          ...category,
          ...(byCategory[categoryId] ? fieldsForBaseline(byCategory[categoryId]) : {}),
        },
      ]),
    ),
  }
}
