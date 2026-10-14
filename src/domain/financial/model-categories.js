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
  delete value.itemCount
  delete value.itemizedValue
  delete value.memberValues
  delete value.updatedAt
  delete value.updatedBy
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
