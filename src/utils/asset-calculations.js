export function normalizeMoney(value) {
  if (value === '' || value == null) return null
  const amount = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(amount) || amount < 0) return null
  return Math.round((amount + Number.EPSILON) * 100) / 100
}

export function createSingleOwnership(memberId) {
  return {
    mode: 'single',
    shares: memberId ? [{ memberId, percentage: 100 }] : [],
  }
}

export function createEqualOwnership(memberIds) {
  const uniqueMemberIds = [...new Set(memberIds.filter(Boolean))]
  if (uniqueMemberIds.length <= 1) return createSingleOwnership(uniqueMemberIds[0])

  const basePercentage = Math.floor(100000 / uniqueMemberIds.length) / 1000
  let assigned = 0

  return {
    mode: 'shared',
    shares: uniqueMemberIds.map((memberId, index) => {
      const percentage =
        index === uniqueMemberIds.length - 1
          ? Math.round((100 - assigned) * 1000) / 1000
          : basePercentage
      assigned += percentage
      return { memberId, percentage }
    }),
  }
}

export function cloneOwnership(ownership) {
  const shares = (ownership?.shares || []).map((share) => ({
    memberId: share.memberId,
    percentage: Number(share.percentage),
  }))

  return {
    mode: ownership?.mode || (shares.length > 1 ? 'shared' : 'single'),
    shares,
  }
}

export function isValidOwnership(ownership, memberIds = []) {
  if (!ownership?.shares?.length) return false

  const allowedMembers = new Set(memberIds)
  const uniqueMembers = new Set()
  const total = ownership.shares.reduce((sum, share) => {
    const percentage = Number(share.percentage)
    if (
      !allowedMembers.has(share.memberId) ||
      uniqueMembers.has(share.memberId) ||
      !Number.isFinite(percentage) ||
      percentage < 0 ||
      percentage > 100
    ) {
      return NaN
    }
    uniqueMembers.add(share.memberId)
    return sum + percentage
  }, 0)

  return Number.isFinite(total) && Math.abs(total - 100) < 0.001
}

export function ownershipPercentage(ownership, memberId) {
  if (!memberId || memberId === 'all') return 100
  return Number(ownership?.shares?.find((share) => share.memberId === memberId)?.percentage || 0)
}

export function applyOwnership(value, ownership, memberId) {
  const amount = normalizeMoney(value) || 0
  if (!memberId || memberId === 'all') return amount
  return Math.round(amount * ownershipPercentage(ownership, memberId)) / 100
}

export function allocateValueByOwnership(value, ownership, memberIds = []) {
  const amountInCents = Math.round((normalizeMoney(value) || 0) * 100)
  const shares = (ownership?.shares || []).filter((share) => Number(share.percentage) > 0)
  const values = Object.fromEntries(memberIds.filter(Boolean).map((memberId) => [memberId, 0]))
  let assignedCents = 0

  shares.forEach((share, index) => {
    const cents =
      index === shares.length - 1
        ? amountInCents - assignedCents
        : Math.round((amountInCents * Number(share.percentage)) / 100)
    assignedCents += cents
    values[share.memberId] = Math.round(((values[share.memberId] || 0) + cents / 100) * 100) / 100
  })

  return values
}

export function addMemberValues(base = {}, delta = {}, multiplier = 1) {
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

export function totalAssets(summary, memberId = 'all') {
  return normalizeMoney(
    Object.values(summary?.categories || {}).reduce(
      (total, category) => total + categoryEffectiveValue(category, memberId),
      0,
    ),
  )
}
