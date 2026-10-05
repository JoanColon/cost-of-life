import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/firebase/firebase'

export async function getUserWorkspaces(user) {
  await migrateOwnedLegacyWorkspaces(user)

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

export async function createFinancialWorkspace({ name, inviteEmail, user }) {
  const workspaceRef = doc(collection(db, 'workspaces'))
  const normalizedInviteEmail = inviteEmail?.trim().toLowerCase() || null
  const batch = writeBatch(db)
  const displayName = user.displayName || user.email || ''

  batch.set(workspaceRef, {
    name: name.trim(),
    type: normalizedInviteEmail ? 'shared' : 'personal',
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

  if (normalizedInviteEmail) {
    const inviteRef = doc(collection(db, 'workspaceInvites'))

    batch.set(inviteRef, {
      workspaceId: workspaceRef.id,
      email: normalizedInviteEmail,
      role: 'member',
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      status: 'pending',
    })
  }

  await batch.commit()

  return {
    id: workspaceRef.id,
    name: name.trim(),
    type: normalizedInviteEmail ? 'shared' : 'personal',
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

async function migrateOwnedLegacyWorkspaces(user) {
  const ownedWorkspacesQuery = query(
    collection(db, 'workspaces'),
    where('createdBy', '==', user.uid),
  )
  const ownedWorkspaceSnapshot = await getDocs(ownedWorkspacesQuery)
  const legacyWorkspaces = ownedWorkspaceSnapshot.docs.filter(
    (workspaceDocument) => !Array.isArray(workspaceDocument.data().memberIds),
  )

  if (!legacyWorkspaces.length) return

  const batch = writeBatch(db)
  const displayName = user.displayName || user.email || ''

  legacyWorkspaces.forEach((workspaceDocument) => {
    batch.update(workspaceDocument.ref, {
      memberIds: [user.uid],
      members: {
        [user.uid]: {
          displayName,
          role: 'owner',
          joinedAt: workspaceDocument.data().createdAt || serverTimestamp(),
        },
      },
      updatedAt: serverTimestamp(),
    })
    batch.delete(doc(workspaceDocument.ref, 'members', user.uid))
  })

  await batch.commit()
}
