import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const {
  createWorkspace,
  deleteWorkspace,
  getActiveWorkspaceId,
  getUserWorkspaces,
  saveActiveWorkspaceId,
} = vi.hoisted(() => ({
  createWorkspace: vi.fn(),
  deleteWorkspace: vi.fn(),
  getActiveWorkspaceId: vi.fn(),
  getUserWorkspaces: vi.fn(),
  saveActiveWorkspaceId: vi.fn(),
}))

vi.mock('@/services/firebase/workspace.service', () => ({
  createWorkspace,
  deleteWorkspace,
  getUserWorkspaces,
}))

vi.mock('@/services/firebase/user-preferences.service', () => ({
  getActiveWorkspaceId,
  saveActiveWorkspaceId,
}))

import { useWorkspaceStore } from '../../src/stores/workspace-store'

describe('workspace store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    createWorkspace.mockReset()
    deleteWorkspace.mockReset()
    getActiveWorkspaceId.mockReset().mockResolvedValue(null)
    getUserWorkspaces.mockReset()
    saveActiveWorkspaceId.mockReset().mockResolvedValue()
  })

  it('distinguishes a failed load from a successfully empty workspace list', async () => {
    const store = useWorkspaceStore()
    const failure = new Error('permission denied')
    getUserWorkspaces.mockRejectedValueOnce(failure)

    await expect(store.load({ uid: 'user-a' })).rejects.toThrow('permission denied')
    expect(store.ready).toBe(false)
    expect(store.error).toBe(failure)

    getUserWorkspaces.mockResolvedValueOnce([])
    await store.load({ uid: 'user-a' }, true)

    expect(store.ready).toBe(true)
    expect(store.error).toBeNull()
    expect(store.workspaces).toEqual([])
  })

  it('automatically activates and persists the only workspace', async () => {
    getUserWorkspaces.mockResolvedValueOnce([{ id: 'workspace-a', name: 'Family' }])
    const store = useWorkspaceStore()

    await store.load({ uid: 'user-a' })

    expect(store.activeWorkspaceId).toBe('workspace-a')
    expect(saveActiveWorkspaceId).toHaveBeenCalledWith('workspace-a')
  })

  it('restores a valid active workspace for the current user', async () => {
    getActiveWorkspaceId.mockResolvedValueOnce('workspace-b')
    getUserWorkspaces.mockResolvedValueOnce([
      { id: 'workspace-a', name: 'Personal' },
      { id: 'workspace-b', name: 'Family' },
    ])
    const store = useWorkspaceStore()

    await store.load({ uid: 'user-a' })

    expect(store.activeWorkspaceId).toBe('workspace-b')
    expect(store.activeWorkspace?.name).toBe('Family')
    expect(saveActiveWorkspaceId).not.toHaveBeenCalled()
  })

  it('keeps workspace selection open when multiple workspaces have no active selection', async () => {
    getUserWorkspaces.mockResolvedValueOnce([
      { id: 'workspace-a', name: 'Personal' },
      { id: 'workspace-b', name: 'Family' },
    ])
    const store = useWorkspaceStore()

    await store.load({ uid: 'user-a' })

    expect(store.activeWorkspaceId).toBeNull()
  })

  it('clears an inaccessible stored workspace and safely selects the only remaining one', async () => {
    getActiveWorkspaceId.mockResolvedValueOnce('workspace-removed')
    getUserWorkspaces.mockResolvedValueOnce([{ id: 'workspace-a', name: 'Personal' }])
    const store = useWorkspaceStore()

    await store.load({ uid: 'user-a' })

    expect(store.activeWorkspaceId).toBe('workspace-a')
    expect(saveActiveWorkspaceId).toHaveBeenCalledWith('workspace-a')
  })

  it('falls back to selection when an inaccessible stored workspace has multiple alternatives', async () => {
    getActiveWorkspaceId.mockResolvedValueOnce('workspace-removed')
    getUserWorkspaces.mockResolvedValueOnce([
      { id: 'workspace-a', name: 'Personal' },
      { id: 'workspace-b', name: 'Family' },
    ])
    const store = useWorkspaceStore()

    await store.load({ uid: 'user-a' })

    expect(store.activeWorkspaceId).toBeNull()
    expect(saveActiveWorkspaceId).toHaveBeenCalledWith(null)
  })

  it('activates newly created workspaces and clears a deleted active workspace', async () => {
    getUserWorkspaces.mockResolvedValueOnce([
      { id: 'workspace-a', name: 'Personal' },
      { id: 'workspace-b', name: 'Family' },
    ])
    createWorkspace.mockResolvedValueOnce({
      id: 'workspace-c',
      name: 'Business',
      createdBy: 'user-a',
    })
    deleteWorkspace.mockResolvedValueOnce()
    const store = useWorkspaceStore()
    await store.load({ uid: 'user-a' })

    await store.create({ name: 'Business' })
    expect(store.activeWorkspaceId).toBe('workspace-c')

    await store.deleteWorkspace('workspace-c')
    expect(store.activeWorkspaceId).toBeNull()
    expect(saveActiveWorkspaceId).toHaveBeenLastCalledWith(null)
  })
})
