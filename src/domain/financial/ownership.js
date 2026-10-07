import { normalizeMoney } from './money'

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

export function allocateValueByOwnership(value, ownership, memberIds = []) {
  const amountInCents = Math.round((normalizeMoney(value) || 0) * 100)
  const shares = (ownership?.shares || []).filter((share) => Number(share.percentage) > 0)
  const values = Object.fromEntries(memberIds.filter(Boolean).map((memberId) => [memberId, 0]))
  let assignedCents = 0

  shares.forEach((share, index) => {
    // The final positive share receives any remaining cent so allocations always match the total.
    const cents =
      index === shares.length - 1
        ? amountInCents - assignedCents
        : Math.round((amountInCents * Number(share.percentage)) / 100)
    assignedCents += cents
    values[share.memberId] = Math.round(((values[share.memberId] || 0) + cents / 100) * 100) / 100
  })

  return values
}

export function applyOwnership(value, ownership, memberId) {
  const amount = normalizeMoney(value) || 0
  if (!memberId || memberId === 'all') return amount
  return allocateValueByOwnership(amount, ownership)[memberId] || 0
}
