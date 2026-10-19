import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'
import { milestoneDefinitions } from '@/domain/milestones/definitions'
import { db } from '@/firebase/firebase'

export const MILESTONE_CONFIRMATION_DELAY_MS = 24 * 60 * 60 * 1000

const definitionsById = new Map(
  milestoneDefinitions.map((definition) => [definition.id, definition]),
)

export async function getAchievements(workspaceId) {
  const snapshot = await getDocs(collection(db, 'workspaces', workspaceId, 'achievements'))
  return snapshot.docs.map((achievement) => ({ id: achievement.id, ...achievement.data() }))
}

export async function activateMilestoneTracking(
  workspaceId,
  milestoneProgress,
  existingAchievements = [],
) {
  const workspaceReference = doc(db, 'workspaces', workspaceId)
  const baseline = milestoneProgress.filter(({ id, reached }) => definitionsById.has(id) && reached)
  const achievementIds = new Set([
    ...existingAchievements.map(({ milestoneId, id }) => milestoneId || id),
    ...baseline.map(({ id }) => id),
  ])
  const achievementReferences = [...achievementIds]
    .filter(Boolean)
    .map((id) => doc(db, 'workspaces', workspaceId, 'achievements', id))
  const baselineIds = new Set(baseline.map(({ id }) => id))

  await runTransaction(db, async (transaction) => {
    const workspaceSnapshot = await transaction.get(workspaceReference)
    const achievementSnapshots = await Promise.all(
      achievementReferences.map((reference) => transaction.get(reference)),
    )
    if (!workspaceSnapshot.exists()) throw new Error('Workspace not found')
    if (workspaceSnapshot.data()?.milestoneTracking?.status === 'active') return

    achievementSnapshots.forEach((snapshot) => {
      if (snapshot.exists() && !baselineIds.has(snapshot.id)) transaction.delete(snapshot.ref)
    })
    baseline.forEach((milestone) => {
      const definition = definitionsById.get(milestone.id)
      transaction.set(doc(db, 'workspaces', workspaceId, 'achievements', milestone.id), {
        milestoneId: milestone.id,
        family: definition.family,
        status: 'achieved',
        achievedAt: serverTimestamp(),
        achievedValue: Number(milestone.currentValue || 0),
      })
    })
    transaction.update(workspaceReference, {
      milestoneTracking: {
        status: 'active',
        activatedAt: serverTimestamp(),
      },
      updatedAt: serverTimestamp(),
    })
  })

  const [workspaceSnapshot, achievements] = await Promise.all([
    getDoc(workspaceReference),
    getAchievements(workspaceId),
  ])
  return {
    achievements,
    milestoneTracking: workspaceSnapshot.data()?.milestoneTracking || { status: 'active' },
  }
}

export async function syncMilestoneAchievements(
  workspaceId,
  milestoneProgress,
  existingAchievements = [],
  now = Date.now(),
) {
  const progressById = new Map(milestoneProgress.map((milestone) => [milestone.id, milestone]))
  const existingById = new Map(
    existingAchievements.map((achievement) => [achievement.milestoneId, achievement]),
  )
  const newCandidateIds = milestoneProgress
    .filter(({ id, reached }) => definitionsById.has(id) && reached && !existingById.has(id))
    .map(({ id }) => id)
  const pendingActionIds = existingAchievements
    .filter(({ milestoneId, status, qualifiedAt }) => {
      if (status !== 'pending' || !definitionsById.has(milestoneId)) return false
      const progress = progressById.get(milestoneId)
      return !progress?.reached || confirmationIsDue(qualifiedAt, now)
    })
    .map(({ milestoneId }) => milestoneId)
  const actionIds = [...new Set([...newCandidateIds, ...pendingActionIds])]
  if (!actionIds.length) return existingAchievements

  const references = actionIds.map((id) => doc(db, 'workspaces', workspaceId, 'achievements', id))

  await runTransaction(db, async (transaction) => {
    const snapshots = await Promise.all(references.map((reference) => transaction.get(reference)))

    snapshots.forEach((snapshot, index) => {
      const milestoneId = actionIds[index]
      const progress = progressById.get(milestoneId)
      const definition = definitionsById.get(milestoneId)

      if (!snapshot.exists()) {
        if (!progress?.reached || !definition) return
        transaction.set(snapshot.ref, {
          milestoneId,
          family: definition.family,
          status: 'pending',
          qualifiedAt: serverTimestamp(),
          qualifiedValue: Number(progress.currentValue || 0),
        })
        return
      }

      const achievement = snapshot.data()
      if (achievement.status !== 'pending') return
      if (!progress?.reached) {
        transaction.delete(snapshot.ref)
        return
      }
      if (!confirmationIsDue(achievement.qualifiedAt, now)) return

      transaction.update(snapshot.ref, {
        status: 'achieved',
        achievedAt: serverTimestamp(),
        achievedValue: Number(progress.currentValue || 0),
      })
    })
  })

  return getAchievements(workspaceId)
}

export function confirmationIsDue(qualifiedAt, now = Date.now()) {
  const qualifiedAtMs = timestampMilliseconds(qualifiedAt)
  return qualifiedAtMs !== null && now - qualifiedAtMs >= MILESTONE_CONFIRMATION_DELAY_MS
}

function timestampMilliseconds(value) {
  if (typeof value?.toMillis === 'function') return value.toMillis()
  if (typeof value?.toDate === 'function') return value.toDate().getTime()
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = new Date(value).getTime()
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}
