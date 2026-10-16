import { describe, expect, it } from 'vitest'
import { getWorkspaceMembers } from '../../src/utils/workspace-members.js'

describe('workspace members', () => {
  it('uses memberIds as the source of membership and members only as profile data', () => {
    expect(
      getWorkspaceMembers({
        memberIds: ['current-user'],
        members: {
          'current-user': { displayName: 'Joan' },
          'stale-user': { displayName: 'Stale' },
        },
      }),
    ).toEqual([{ id: 'current-user', name: 'Joan', photoURL: '' }])
  })
})
