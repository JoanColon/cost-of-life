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

export function createSharedOwnership(memberIds) {
  if (memberIds.length <= 1) return createSingleOwnership(memberIds[0])

  const basePercentage = Math.floor(10000 / memberIds.length) / 100
  let assigned = 0

  return {
    mode: 'shared',
    shares: memberIds.map((memberId, index) => {
      const percentage = index === memberIds.length - 1 ? 100 - assigned : basePercentage
      assigned += percentage
      return { memberId, percentage }
    }),
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

export function categoryAssets(assets, categoryId) {
  return assets.filter((asset) => asset.category === categoryId)
}

export function categoryTotal(categoryId, config, assets, memberId = 'all') {
  const category = config?.categories?.[categoryId]
  if (!category?.enabled) return 0

  if (category.mode === 'itemized') {
    return normalizeMoney(
      categoryAssets(assets, categoryId).reduce(
        (total, asset) => total + applyOwnership(asset.currentValue, asset.ownership, memberId),
        0,
      ),
    )
  }

  return applyOwnership(category.manualValue, category.ownership, memberId)
}

export function totalAssets(config, assets, memberId = 'all') {
  return normalizeMoney(
    Object.keys(config?.categories || {}).reduce(
      (total, categoryId) => total + categoryTotal(categoryId, config, assets, memberId),
      0,
    ),
  )
}

export function ownershipFromAssets(assets, memberIds) {
  const totals = new Map(memberIds.map((memberId) => [memberId, 0]))
  let totalValue = 0

  assets.forEach((asset) => {
    const value = normalizeMoney(asset.currentValue) || 0
    totalValue += value
    asset.ownership?.shares?.forEach((share) => {
      if (!totals.has(share.memberId)) return
      totals.set(share.memberId, totals.get(share.memberId) + value * (share.percentage / 100))
    })
  })

  if (!totalValue) return createSingleOwnership(memberIds[0])

  const shares = memberIds
    .map((memberId) => ({
      memberId,
      percentage: Math.round((totals.get(memberId) / totalValue) * 10000) / 100,
    }))
    .filter((share) => share.percentage > 0)

  if (shares.length) {
    const difference = 100 - shares.reduce((sum, share) => sum + share.percentage, 0)
    shares[shares.length - 1].percentage += difference
  }

  return {
    mode: shares.length === 1 ? 'single' : 'shared',
    shares,
  }
}
