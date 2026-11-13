/**
 * Allocates monetary values across workspace ownership shares and validates, clones, or scopes canonical ownership structures.
 */
import { normalizeNonNegativeMoneyOrNull, roundMoneyOrZero } from './money.js'

/**
 * Allocates a non-negative amount across ownership shares in integer cents.
 * The last positive share receives the rounding remainder so member amounts sum exactly to total.
 */
export function allocateMoneyByOwnership(value, ownership, memberIds = []) {
  const amountInCents = Math.round(Math.max(0, roundMoneyOrZero(value)) * 100)
  const shares = (ownership?.shares || []).filter((share) => Number(share.percentage) > 0)
  const values = Object.fromEntries(memberIds.filter(Boolean).map((memberId) => [memberId, 0]))
  let assignedCents = 0

  shares.forEach((share, index) => {
    const cents =
      index === shares.length - 1 ?
        amountInCents - assignedCents :
        Math.round((amountInCents * Number(share.percentage)) / 100)
    assignedCents += cents
    values[share.memberId] = roundMoneyOrZero((values[share.memberId] || 0) + cents / 100)
  })

  return values
}

/** Creates a complete ownership allocation for one member. */
export function createSingleMemberOwnership(memberId) {
  return { mode: 'single', shares: memberId ? [{ memberId, percentage: 100 }] : [] }
}

/** Creates an equal allocation whose percentages sum exactly to 100 at three-decimal precision. */
export function createEqualMemberOwnership(memberIds) {
  const uniqueMemberIds = [...new Set(memberIds.filter(Boolean))]
  if (uniqueMemberIds.length <= 1) return createSingleMemberOwnership(uniqueMemberIds[0])
  const basePercentage = Math.floor(100000 / uniqueMemberIds.length) / 1000
  let assigned = 0
  return {
    mode: 'shared',
    shares: uniqueMemberIds.map((memberId, index) => {
      const percentage =
        index === uniqueMemberIds.length - 1 ?
          Math.round((100 - assigned) * 1000) / 1000 :
          basePercentage
      assigned += percentage
      return { memberId, percentage }
    }),
  }
}

/** Returns a detached, numerically normalized ownership value. */
export function cloneOwnershipAllocation(ownership) {
  const shares = (ownership?.shares || []).map((share) => ({
    memberId: share.memberId,
    percentage: Number(share.percentage),
  }))
  return { mode: ownership?.mode || (shares.length > 1 ? 'shared' : 'single'), shares }
}

/** Returns the single owner ID, `all` for shared ownership, or null for an empty allocation. */
export function ownershipScopeId(ownership) {
  const shares = (ownership?.shares || []).filter(
    ({ memberId, percentage }) => memberId && Number(percentage) > 0,
  )
  if (ownership?.mode === 'shared' || shares.length > 1) return 'all'
  return shares[0]?.memberId || null
}

/** Validates unique, allowed member shares that total 100 percent. */
export function isValidOwnershipAllocation(ownership, memberIds = []) {
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
    ) return NaN
    uniqueMembers.add(share.memberId)
    return sum + percentage
  }, 0)
  return Number.isFinite(total) && Math.abs(total - 100) < 0.001
}

/** Applies ownership to one member, or returns the full amount for aggregate scope. */
export function moneyForOwnershipScope(value, ownership, memberId) {
  const amount = normalizeNonNegativeMoneyOrNull(value) || 0
  if (!memberId || memberId === 'all') return amount
  return allocateMoneyByOwnership(amount, ownership)[memberId] || 0
}
