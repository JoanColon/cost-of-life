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

export async function getQuickLinks(workspaceId) {
  const userId = currentUserId()
  const snapshot = await getDoc(doc(db, 'users', userId))
  const links = snapshot.data()?.quickLinksByWorkspace?.[workspaceId]

  return normalizeQuickLinks(links)
}

export async function saveQuickLinks(workspaceId, links) {
  const userId = currentUserId()
  const normalized = normalizeQuickLinks(links)

  await setDoc(
    doc(db, 'users', userId),
    {
      quickLinksByWorkspace: { [workspaceId]: normalized },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )

  return normalized
}

function normalizeQuickLinks(links) {
  if (!Array.isArray(links)) return []
  return [...new Set(links.filter((link) => typeof link === 'string' && link.trim()))]
}
