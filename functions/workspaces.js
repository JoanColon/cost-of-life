const { getFirestore } = require('firebase-admin/firestore')
const { HttpsError, onCall } = require('firebase-functions/https')
const {
  acceptWorkspaceInvite: acceptWorkspaceInviteData,
  createWorkspaceInvite: createWorkspaceInviteData,
  deleteWorkspaceData,
  getWorkspaceInvite: getWorkspaceInviteData,
  isWorkspaceOwner,
} = require('./services/workspaces')

function callableError(error) {
  if (error instanceof HttpsError) return error
  const supportedCodes = new Set([
    'deadline-exceeded',
    'failed-precondition',
    'invalid-argument',
    'not-found',
    'permission-denied',
  ])
  return new HttpsError(
    supportedCodes.has(error?.code) ? error.code : 'internal',
    error?.message || 'The operation could not be completed',
  )
}

const createWorkspaceInvite = onCall({ region: 'europe-west1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication is required')

  const workspaceId = String(request.data?.workspaceId || '').trim()
  if (!workspaceId) throw new HttpsError('invalid-argument', 'A workspace is required')

  try {
    return await createWorkspaceInviteData(getFirestore(), {
      workspaceId,
      userId: request.auth.uid,
    })
  } catch (error) {
    throw callableError(error)
  }
})

const getWorkspaceInvite = onCall({ region: 'europe-west1' }, async (request) => {
  try {
    return await getWorkspaceInviteData(getFirestore(), {
      token: request.data?.token,
      userId: request.auth?.uid || null,
    })
  } catch (error) {
    throw callableError(error)
  }
})

const acceptWorkspaceInvite = onCall({ region: 'europe-west1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication is required')

  try {
    return await acceptWorkspaceInviteData(getFirestore(), {
      token: request.data?.token,
      userId: request.auth.uid,
      displayName: request.auth.token.name || request.auth.token.email || '',
      photoURL: request.auth.token.picture || '',
    })
  } catch (error) {
    throw callableError(error)
  }
})

const deleteWorkspace = onCall({ region: 'europe-west1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication is required')

  const workspaceId = String(request.data?.workspaceId || '').trim()
  if (!workspaceId) throw new HttpsError('invalid-argument', 'A workspace is required')

  const firestore = getFirestore()
  const workspaceReference = firestore.collection('workspaces').doc(workspaceId)
  const workspaceSnapshot = await workspaceReference.get()

  if (!workspaceSnapshot.exists) {
    throw new HttpsError('not-found', 'The workspace does not exist')
  }
  if (!isWorkspaceOwner(workspaceSnapshot.data(), request.auth.uid)) {
    throw new HttpsError('permission-denied', 'Workspace ownership is required')
  }

  return deleteWorkspaceData(firestore, workspaceReference)
})

module.exports = {
  acceptWorkspaceInvite,
  createWorkspaceInvite,
  deleteWorkspace,
  getWorkspaceInvite,
}
