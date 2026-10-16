export function getWorkspaceMembers(workspace, fallbackUser = null) {
  const memberIds = [...new Set((workspace?.memberIds || []).filter(Boolean))]
  const entries = memberIds.map((id) => {
    const member = workspace?.members?.[id] || {}
    return {
      id,
      name: member.displayName?.split('@')[0] || 'Member',
      photoURL: member.photoURL || '',
    }
  })

  if (entries.length) return entries
  if (!fallbackUser) return []

  return [
    {
      id: fallbackUser.uid,
      name: fallbackUser.displayName || fallbackUser.email?.split('@')[0] || 'Member',
      photoURL: fallbackUser.photoURL || '',
    },
  ]
}
