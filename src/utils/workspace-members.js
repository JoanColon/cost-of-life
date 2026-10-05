export function getWorkspaceMembers(workspace, fallbackUser = null) {
  const entries = Object.entries(workspace?.members || {}).map(([id, member]) => ({
    id,
    name: member.displayName?.split('@')[0] || 'Member',
    photoURL: member.photoURL || '',
  }))

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
