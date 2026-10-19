import { beforeEach, describe, expect, it, vi } from 'vitest'

const { firestore, transaction } = vi.hoisted(() => {
  const transaction = {
    delete: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    update: vi.fn(),
  }
  return {
    firestore: {
      getDocs: vi.fn(),
      runTransaction: vi.fn(async (_db, callback) => callback(transaction)),
      serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
    },
    transaction,
  }
})

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, ...segments) => ({ path: segments.join('/') })),
  doc: vi.fn((_db, ...segments) => ({ id: segments.at(-1), path: segments.join('/') })),
  getDoc: vi.fn(),
  getDocs: firestore.getDocs,
  runTransaction: firestore.runTransaction,
  serverTimestamp: firestore.serverTimestamp,
}))
vi.mock('@/firebase/firebase', () => ({ db: {} }))

import {
  confirmationIsDue,
  MILESTONE_CONFIRMATION_DELAY_MS,
  syncMilestoneAchievements,
} from '@/services/firebase/achievements.service'

describe('achievements service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    firestore.getDocs.mockResolvedValue({ docs: [] })
    transaction.get.mockResolvedValue({
      exists: () => false,
      ref: { id: 'safety_3_months' },
    })
  })

  it('only confirms a pending milestone after 24 hours', () => {
    const qualifiedAt = Date.UTC(2026, 9, 18, 10)

    expect(confirmationIsDue(qualifiedAt, qualifiedAt + MILESTONE_CONFIRMATION_DELAY_MS - 1)).toBe(
      false,
    )
    expect(confirmationIsDue(qualifiedAt, qualifiedAt + MILESTONE_CONFIRMATION_DELAY_MS)).toBe(true)
  })

  it('supports Firestore timestamps when checking confirmation time', () => {
    const qualifiedAt = Date.UTC(2026, 9, 18, 10)
    const timestamp = { toMillis: () => qualifiedAt }

    expect(confirmationIsDue(timestamp, qualifiedAt + MILESTONE_CONFIRMATION_DELAY_MS)).toBe(true)
  })

  it('creates a pending candidate instead of immediately awarding a milestone', async () => {
    await syncMilestoneAchievements('workspace-a', [
      {
        id: 'safety_3_months',
        family: 'safety',
        reached: true,
        currentValue: 4,
      },
    ])

    expect(transaction.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'safety_3_months' }),
      expect.objectContaining({
        milestoneId: 'safety_3_months',
        status: 'pending',
        qualifiedAt: 'SERVER_TIMESTAMP',
        qualifiedValue: 4,
      }),
    )
    expect(transaction.update).not.toHaveBeenCalled()
  })

  it('cancels a pending candidate when the milestone is no longer reached', async () => {
    const reference = { id: 'safety_3_months' }
    transaction.get.mockResolvedValue({
      exists: () => true,
      data: () => ({ status: 'pending' }),
      ref: reference,
    })

    await syncMilestoneAchievements(
      'workspace-a',
      [{ id: 'safety_3_months', reached: false }],
      [
        {
          milestoneId: 'safety_3_months',
          status: 'pending',
          qualifiedAt: Date.now(),
        },
      ],
    )

    expect(transaction.delete).toHaveBeenCalledWith(reference)
    expect(transaction.update).not.toHaveBeenCalled()
  })

  it('promotes a candidate that remains reached for 24 hours', async () => {
    const now = Date.UTC(2026, 9, 19, 10)
    const qualifiedAt = now - MILESTONE_CONFIRMATION_DELAY_MS
    const reference = { id: 'safety_3_months' }
    transaction.get.mockResolvedValue({
      exists: () => true,
      data: () => ({ status: 'pending', qualifiedAt }),
      ref: reference,
    })

    await syncMilestoneAchievements(
      'workspace-a',
      [{ id: 'safety_3_months', reached: true, currentValue: 5 }],
      [{ milestoneId: 'safety_3_months', status: 'pending', qualifiedAt }],
      now,
    )

    expect(transaction.update).toHaveBeenCalledWith(reference, {
      status: 'achieved',
      achievedAt: 'SERVER_TIMESTAMP',
      achievedValue: 5,
    })
  })
})
