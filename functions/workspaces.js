const { getFirestore } = require('firebase-admin/firestore')
const { HttpsError, onCall } = require('firebase-functions/https')
const { deleteWorkspaceData, isWorkspaceOwner } = require('./services/workspaces')

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

module.exports = { deleteWorkspace }
