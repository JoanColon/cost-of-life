import { collection, doc, getDocs, query, serverTimestamp, where, setDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { auth, db, functions } from '@/firebase/firebase'

export async function getUserWorkspaces() {
  const user = auth.currentUser
  if (!user) throw new Error('Authentication is required')
  const workspacesQuery = query(
    collection(db, 'workspaces'),
    where('memberIds', 'array-contains', user.uid),
  )
  const workspaceSnapshot = await getDocs(workspacesQuery)

  return workspaceSnapshot.docs.map((workspaceDocument) => ({
    id: workspaceDocument.id,
    ...workspaceDocument.data(),
  }))
}

export async function createWorkspace({ name }) {
  const user = auth.currentUser
  if (!user) throw new Error('Authentication is required')
  const workspaceRef = doc(collection(db, 'workspaces'))
  const displayName = user.displayName || user.email || ''

  await setDoc(workspaceRef, {
    name: name.trim(),
    type: 'personal',
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    memberIds: [user.uid],
    members: {
      [user.uid]: {
        displayName,
        role: 'owner',
        joinedAt: serverTimestamp(),
      },
    },
  })

  return {
    id: workspaceRef.id,
    name: name.trim(),
    type: 'personal',
    createdBy: user.uid,
    memberIds: [user.uid],
    members: {
      [user.uid]: {
        displayName,
        role: 'owner',
      },
    },
  }
}

export async function deleteWorkspace(workspaceId) {
  await httpsCallable(functions, 'deleteWorkspace')({ workspaceId })
}

export async function createWorkspaceInvite(workspaceId) {
  const result = await httpsCallable(functions, 'createWorkspaceInvite')({ workspaceId })
  return result.data
}

export async function getWorkspaceInvite(token) {
  const result = await httpsCallable(functions, 'getWorkspaceInvite')({ token })
  return result.data
}

export async function acceptWorkspaceInvite(token) {
  const result = await httpsCallable(functions, 'acceptWorkspaceInvite')({ token })
  return result.data
}
