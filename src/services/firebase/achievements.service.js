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

const definitionsById = new Map(
  milestoneDefinitions.map((definition) => [definition.id, definition]),
)

export async function getAchievements(workspaceId) {
  const snapshot = await getDocs(collection(db, 'workspaces', workspaceId, 'achievements'))
  return snapshot.docs.map((achievement) => ({ id: achievement.id, ...achievement.data() }))
}

export async function createMissingAchievements(workspaceId, milestoneProgress) {
  const candidates = milestoneProgress
    .filter(({ id, reached, previouslyAchieved }) =>
      Boolean(definitionsById.has(id) && reached && !previouslyAchieved),
    )
    .map((milestone) => ({
      definition: definitionsById.get(milestone.id),
      currentValue: Number(milestone.currentValue || 0),
    }))

  if (!candidates.length) return []

  const references = candidates.map(({ definition }) =>
    doc(db, 'workspaces', workspaceId, 'achievements', definition.id),
  )

  await runTransaction(db, async (transaction) => {
    const snapshots = await Promise.all(references.map((reference) => transaction.get(reference)))

    snapshots.forEach((snapshot, index) => {
      if (snapshot.exists()) return
      const { definition, currentValue } = candidates[index]
      transaction.set(references[index], {
        milestoneId: definition.id,
        family: definition.family,
        achievedAt: serverTimestamp(),
        achievedValue: currentValue,
      })
    })
  })

  const resolved = await Promise.all(references.map((reference) => getDoc(reference)))
  return resolved.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }))
}
