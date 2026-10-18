const crypto = require('node:crypto')
const { FieldValue, Timestamp } = require('firebase-admin/firestore')

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

function workspaceError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function createInviteToken() {
  return crypto.randomBytes(32).toString('base64url')
}

function inviteDocumentId(token) {
  const normalizedToken = String(token || '').trim()
  if (!INVITE_TOKEN_PATTERN.test(normalizedToken)) {
    throw workspaceError('invalid-argument', 'A valid invitation token is required')
  }
  return crypto.createHash('sha256').update(normalizedToken).digest('hex')
}

function inviteHasExpired(invite, now) {
  return !invite?.expiresAt || invite.expiresAt.toMillis() <= now
}

async function createWorkspaceInvite(firestore, { workspaceId, userId, now = Date.now() }) {
  const token = createInviteToken()
  const inviteReference = firestore.collection('workspaceInvites').doc(inviteDocumentId(token))
  const workspaceReference = firestore.collection('workspaces').doc(workspaceId)
  const expiresAt = Timestamp.fromMillis(now + INVITE_TTL_MS)

  await firestore.runTransaction(async (transaction) => {
    const workspaceSnapshot = await transaction.get(workspaceReference)
    const workspace = workspaceSnapshot.data()

    if (!workspaceSnapshot.exists || workspace?.deletionPendingAt) {
      throw workspaceError('not-found', 'The workspace does not exist')
    }
    if (!isWorkspaceMember(workspace, userId)) {
      throw workspaceError('permission-denied', 'Workspace membership is required')
    }

    transaction.create(inviteReference, {
      workspaceId,
      role: 'member',
      createdBy: userId,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt,
      status: 'pending',
    })
  })

  return { token, expiresAt: expiresAt.toMillis() }
}

async function getWorkspaceInvite(firestore, { token, userId = null, now = Date.now() }) {
  const inviteReference = firestore.collection('workspaceInvites').doc(inviteDocumentId(token))
  const inviteSnapshot = await inviteReference.get()

  if (!inviteSnapshot.exists) {
    throw workspaceError('not-found', 'The invitation does not exist')
  }

  const invite = inviteSnapshot.data()
  if (invite.status === 'accepted') {
    if (!userId || invite.acceptedBy !== userId) {
      throw workspaceError('failed-precondition', 'The invitation has already been used')
    }
  } else if (invite.status !== 'pending') {
    throw workspaceError('failed-precondition', 'The invitation is no longer available')
  } else if (inviteHasExpired(invite, now)) {
    throw workspaceError('deadline-exceeded', 'The invitation has expired')
  }

  const workspaceSnapshot = await firestore.collection('workspaces').doc(invite.workspaceId).get()
  const workspace = workspaceSnapshot.data()
  if (!workspaceSnapshot.exists || workspace?.deletionPendingAt) {
    throw workspaceError('not-found', 'The workspace does not exist')
  }

  return {
    workspaceId: workspaceSnapshot.id,
    workspaceName: workspace.name || '',
    status: invite.status,
    expiresAt: invite.expiresAt?.toMillis() || null,
  }
}

async function acceptWorkspaceInvite(
  firestore,
  { token, userId, displayName = '', photoURL = '', now = Date.now() },
) {
  const inviteReference = firestore.collection('workspaceInvites').doc(inviteDocumentId(token))

  return firestore.runTransaction(async (transaction) => {
    const inviteSnapshot = await transaction.get(inviteReference)
    if (!inviteSnapshot.exists) {
      throw workspaceError('not-found', 'The invitation does not exist')
    }

    const invite = inviteSnapshot.data()
    if (invite.status === 'accepted') {
      if (invite.acceptedBy === userId) {
        return { status: 'joined', workspaceId: invite.workspaceId }
      }
      throw workspaceError('failed-precondition', 'The invitation has already been used')
    }
    if (invite.status !== 'pending') {
      throw workspaceError('failed-precondition', 'The invitation is no longer available')
    }
    if (inviteHasExpired(invite, now)) {
      throw workspaceError('deadline-exceeded', 'The invitation has expired')
    }

    const workspaceReference = firestore.collection('workspaces').doc(invite.workspaceId)
    const workspaceSnapshot = await transaction.get(workspaceReference)
    const workspace = workspaceSnapshot.data()
    if (!workspaceSnapshot.exists || workspace?.deletionPendingAt) {
      throw workspaceError('not-found', 'The workspace does not exist')
    }

    const existingMember = workspace.members?.[userId]
    const member = existingMember || {
      displayName,
      photoURL,
      role: 'member',
      joinedAt: FieldValue.serverTimestamp(),
    }
    const memberIds = [...new Set([...(workspace.memberIds || []), userId])]

    transaction.update(workspaceReference, {
      memberIds,
      members: { ...(workspace.members || {}), [userId]: member },
      type: memberIds.length > 1 ? 'shared' : workspace.type || 'personal',
      updatedAt: FieldValue.serverTimestamp(),
    })
    transaction.update(inviteReference, {
      status: 'accepted',
      acceptedBy: userId,
      acceptedAt: FieldValue.serverTimestamp(),
    })

    return { status: 'joined', workspaceId: workspaceReference.id }
  })
}

async function deleteWorkspaceData(firestore, workspaceReference) {
  await workspaceReference.update({
    deletionPendingAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })

  const invites = await firestore
    .collection('workspaceInvites')
    .where('workspaceId', '==', workspaceReference.id)
    .get()

  for (const invite of invites.docs) {
    await firestore.recursiveDelete(invite.ref)
  }

  await firestore.recursiveDelete(workspaceReference)

  return {
    status: 'deleted',
    workspaceId: workspaceReference.id,
    deletedInvites: invites.size,
  }
}

function isWorkspaceOwner(workspace, userId) {
  return workspace?.members?.[userId]?.role === 'owner'
}

function isWorkspaceMember(workspace, userId) {
  return workspace?.memberIds?.includes(userId) === true
}

module.exports = {
  acceptWorkspaceInvite,
  createWorkspaceInvite,
  deleteWorkspaceData,
  getWorkspaceInvite,
  inviteDocumentId,
  isWorkspaceMember,
  isWorkspaceOwner,
}
