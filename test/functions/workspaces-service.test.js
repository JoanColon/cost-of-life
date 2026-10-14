import { describe, expect, it } from 'vitest'
import workspaceService from '../../functions/services/workspaces.js'

const { deleteWorkspaceData, isWorkspaceOwner } = workspaceService

function createFirestore(inviteIds = []) {
  const operations = []
  const workspaceReference = {
    id: 'workspace-a',
    async update(data) {
      operations.push({ type: 'update', id: this.id, data })
    },
  }
  const invites = inviteIds.map((id) => ({ ref: { id } }))
  const firestore = {
    collection(name) {
      expect(name).toBe('workspaceInvites')
      return {
        where(field, operator, value) {
          expect([field, operator, value]).toEqual(['workspaceId', '==', workspaceReference.id])
          return {
            async get() {
              return { docs: invites, size: invites.length }
            },
          }
        },
      }
    },
    async recursiveDelete(reference) {
      operations.push({ type: 'delete', id: reference.id })
    },
  }

  return { firestore, operations, workspaceReference }
}

describe('workspace deletion', () => {
  it('marks the workspace, removes its invitations, then recursively deletes all workspace data', async () => {
    const { firestore, operations, workspaceReference } = createFirestore(['invite-a', 'invite-b'])

    const result = await deleteWorkspaceData(firestore, workspaceReference)

    expect(result).toEqual({
      status: 'deleted',
      workspaceId: 'workspace-a',
      deletedInvites: 2,
    })
    expect(operations.map(({ type, id }) => `${type}:${id}`)).toEqual([
      'update:workspace-a',
      'delete:invite-a',
      'delete:invite-b',
      'delete:workspace-a',
    ])
    expect(operations[0].data).toHaveProperty('deletionPendingAt')
  })

  it('only recognizes an explicit owner role', () => {
    const workspace = {
      createdBy: 'legacy-owner',
      members: {
        owner: { role: 'owner' },
        member: { role: 'member' },
      },
    }

    expect(isWorkspaceOwner(workspace, 'owner')).toBe(true)
    expect(isWorkspaceOwner(workspace, 'member')).toBe(false)
    expect(isWorkspaceOwner(workspace, 'legacy-owner')).toBe(false)
  })
})
