const { FieldValue } = require('firebase-admin/firestore')

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

module.exports = {
  deleteWorkspaceData,
  isWorkspaceOwner,
}
