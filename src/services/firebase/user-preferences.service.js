import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '@/firebase/firebase'
import { currentUserId } from '@/services/firebase/current-user'

export async function getActiveWorkspaceId() {
  const userId = currentUserId()
  const snapshot = await getDoc(doc(db, 'users', userId))
  const workspaceId = snapshot.data()?.activeWorkspaceId

  return typeof workspaceId === 'string' && workspaceId ? workspaceId : null
}

export async function saveActiveWorkspaceId(workspaceId) {
  const userId = currentUserId()
  await setDoc(
    doc(db, 'users', userId),
    {
      activeWorkspaceId: workspaceId || null,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}
