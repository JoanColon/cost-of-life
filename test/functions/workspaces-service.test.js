import { describe, expect, it } from 'vitest'
import workspaceService from '../../functions/services/workspaces.js'

const {
  acceptWorkspaceInvite,
  createWorkspaceInvite,
  deleteWorkspaceData,
  getWorkspaceInvite,
  inviteDocumentId,
  isWorkspaceMember,
  isWorkspaceOwner,
} = workspaceService

const validToken = 'a'.repeat(43)

function snapshot(id, data) {
  return { id, exists: data != null, data: () => data }
}

function createInviteFirestore({ workspace, invite = null } = {}) {
  const records = new Map()
  const writes = []
  records.set('workspaces/workspace-a', workspace)
  if (invite) records.set(`workspaceInvites/${inviteDocumentId(validToken)}`, invite)

  function reference(path) {
    return {
      id: path.split('/').at(-1),
      path,
      async get() {
        return snapshot(this.id, records.get(path))
      },
    }
  }

  const firestore = {
    collection(name) {
      return { doc: (id) => reference(`${name}/${id}`) }
    },
    async runTransaction(callback) {
      return callback({
        get: (target) => target.get(),
        create(target, data) {
          if (records.has(target.path)) throw new Error('already exists')
          records.set(target.path, data)
          writes.push({ type: 'create', path: target.path, data })
        },
        update(target, data) {
          records.set(target.path, { ...records.get(target.path), ...data })
          writes.push({ type: 'update', path: target.path, data })
        },
      })
    },
  }

  return { firestore, records, writes }
}

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

  it('recognizes every user listed as a workspace member', () => {
    const workspace = { memberIds: ['owner', 'member'] }

    expect(isWorkspaceMember(workspace, 'owner')).toBe(true)
    expect(isWorkspaceMember(workspace, 'member')).toBe(true)
    expect(isWorkspaceMember(workspace, 'someone-else')).toBe(false)
  })
})

describe('workspace invitations', () => {
  it('creates a seven-day invite for a member without storing the raw token', async () => {
    const now = Date.UTC(2026, 9, 17)
    const { firestore, records, writes } = createInviteFirestore({
      workspace: {
        memberIds: ['owner', 'member'],
        members: { owner: { role: 'owner' }, member: { role: 'member' } },
      },
    })

    const result = await createWorkspaceInvite(firestore, {
      workspaceId: 'workspace-a',
      userId: 'member',
      now,
    })

    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(result.expiresAt).toBe(now + 7 * 24 * 60 * 60 * 1000)
    expect(writes).toHaveLength(1)
    expect(writes[0].path).toBe(`workspaceInvites/${inviteDocumentId(result.token)}`)
    expect(writes[0].path).not.toContain(result.token)
    expect(records.get(writes[0].path)).not.toHaveProperty('token')
  })

  it('does not let a non-member create an invite', async () => {
    const { firestore } = createInviteFirestore({
      workspace: {
        memberIds: ['member'],
        members: { member: { role: 'member' } },
      },
    })

    await expect(
      createWorkspaceInvite(firestore, { workspaceId: 'workspace-a', userId: 'someone-else' }),
    ).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('returns only the workspace metadata needed by the public invite page', async () => {
    const now = Date.UTC(2026, 9, 17)
    const { firestore } = createInviteFirestore({
      workspace: { name: 'Family' },
      invite: {
        workspaceId: 'workspace-a',
        status: 'pending',
        expiresAt: { toMillis: () => now + 1000 },
      },
    })

    await expect(getWorkspaceInvite(firestore, { token: validToken, now })).resolves.toEqual({
      workspaceId: 'workspace-a',
      workspaceName: 'Family',
      status: 'pending',
      expiresAt: now + 1000,
    })
  })

  it('atomically adds the member, consumes the invite, and allows a same-user retry', async () => {
    const now = Date.UTC(2026, 9, 17)
    const { firestore, records, writes } = createInviteFirestore({
      workspace: {
        name: 'Family',
        type: 'personal',
        memberIds: ['owner'],
        members: { owner: { displayName: 'Owner', role: 'owner' } },
      },
      invite: {
        workspaceId: 'workspace-a',
        status: 'pending',
        expiresAt: { toMillis: () => now + 1000 },
      },
    })

    const payload = {
      token: validToken,
      userId: 'member',
      displayName: 'New Member',
      photoURL: 'photo',
      now,
    }
    await expect(acceptWorkspaceInvite(firestore, payload)).resolves.toEqual({
      status: 'joined',
      workspaceId: 'workspace-a',
    })

    const workspace = records.get('workspaces/workspace-a')
    const invite = records.get(`workspaceInvites/${inviteDocumentId(validToken)}`)
    expect(workspace.memberIds).toEqual(['owner', 'member'])
    expect(workspace.members.member).toMatchObject({
      displayName: 'New Member',
      photoURL: 'photo',
      role: 'member',
    })
    expect(workspace.type).toBe('shared')
    expect(invite).toMatchObject({ status: 'accepted', acceptedBy: 'member' })
    expect(writes).toHaveLength(2)

    await expect(acceptWorkspaceInvite(firestore, payload)).resolves.toEqual({
      status: 'joined',
      workspaceId: 'workspace-a',
    })
    expect(writes).toHaveLength(2)

    await expect(
      acceptWorkspaceInvite(firestore, { ...payload, userId: 'someone-else' }),
    ).rejects.toMatchObject({ code: 'failed-precondition' })
  })

  it('does not accept an expired invitation', async () => {
    const now = Date.UTC(2026, 9, 17)
    const { firestore, writes } = createInviteFirestore({
      workspace: { memberIds: ['owner'], members: { owner: { role: 'owner' } } },
      invite: {
        workspaceId: 'workspace-a',
        status: 'pending',
        expiresAt: { toMillis: () => now },
      },
    })

    await expect(
      acceptWorkspaceInvite(firestore, { token: validToken, userId: 'member', now }),
    ).rejects.toMatchObject({ code: 'deadline-exceeded' })
    expect(writes).toEqual([])
  })
})
