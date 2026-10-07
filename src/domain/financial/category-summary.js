import { normalizeMoney } from './money'
import {
  allocateValueByOwnership,
  applyOwnership,
  cloneOwnership,
  createEqualOwnership,
} from './ownership'

export function buildSummaryCategories(
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
          itemCount: 0,
          itemizedValue: 0,
          memberValues: allocateValueByOwnership(0, ownership, memberIds),
        },
      ]
    }),
  )
}

function addMemberValues(base = {}, delta = {}, multiplier = 1) {
  const memberIds = new Set([...Object.keys(base || {}), ...Object.keys(delta || {})])
  return Object.fromEntries(
    [...memberIds].map((memberId) => [
      memberId,
      Math.round(
        ((Number(base?.[memberId]) || 0) + multiplier * (Number(delta?.[memberId]) || 0)) * 100,
      ) / 100,
    ]),
  )
}

export function addItemToCategory(category, value, ownership) {
  const normalizedValue = normalizeMoney(value) || 0
  const previousCount = Number(category?.itemCount || 0)
  return {
    ...category,
    itemCount: previousCount + 1,
    itemizedValue:
      Math.round(
        ((previousCount > 0 ? Number(category?.itemizedValue) || 0 : 0) + normalizedValue) * 100,
      ) / 100,
    memberValues: addMemberValues(
      previousCount > 0 ? category?.memberValues : {},
      allocateValueByOwnership(normalizedValue, ownership),
    ),
  }
}

export function updateItemInCategory(
  category,
  previousValue,
  previousOwnership,
  nextValue,
  nextOwnership,
) {
  const oldValue = normalizeMoney(previousValue) || 0
  const newValue = normalizeMoney(nextValue) || 0
  const withoutPrevious = addMemberValues(
    category?.memberValues,
    allocateValueByOwnership(oldValue, previousOwnership),
    -1,
  )

  return {
    ...category,
    itemizedValue:
      Math.round(((Number(category?.itemizedValue) || 0) - oldValue + newValue) * 100) / 100,
    memberValues: addMemberValues(
      withoutPrevious,
      allocateValueByOwnership(newValue, nextOwnership),
    ),
  }
}

export function removeItemFromCategory(
  category,
  value,
  ownership,
  defaultOwnership,
  memberIds = [],
) {
  const nextCount = Math.max(0, Number(category?.itemCount || 0) - 1)
  if (nextCount === 0) {
    return {
      ...category,
      ownership: cloneOwnership(defaultOwnership),
      itemCount: 0,
      itemizedValue: 0,
      memberValues: allocateValueByOwnership(category?.manualValue, defaultOwnership, memberIds),
    }
  }

  return {
    ...category,
    itemCount: nextCount,
    itemizedValue: Math.max(
      0,
      Math.round(((Number(category?.itemizedValue) || 0) - (normalizeMoney(value) || 0)) * 100) /
        100,
    ),
    memberValues: addMemberValues(
      category?.memberValues,
      allocateValueByOwnership(value, ownership),
      -1,
    ),
  }
}

export function isItemizedCategory(category) {
  return Number(category?.itemCount || 0) > 0
}

export function categoryEffectiveValue(category, memberId = 'all') {
  if (!category?.enabled) return 0

  if (isItemizedCategory(category)) {
    if (!memberId || memberId === 'all') return normalizeMoney(category.itemizedValue) || 0
    return normalizeMoney(category.memberValues?.[memberId]) || 0
  }

  return applyOwnership(category.manualValue, category.ownership, memberId)
}

export function totalCategories(summary, memberId = 'all') {
  return normalizeMoney(
    Object.values(summary?.categories || {}).reduce(
      (total, category) => total + categoryEffectiveValue(category, memberId),
      0,
    ),
  )
}
