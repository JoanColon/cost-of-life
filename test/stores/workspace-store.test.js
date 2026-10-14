import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { getUserWorkspaces } = vi.hoisted(() => ({
  getUserWorkspaces: vi.fn(),
}))

vi.mock('@/services/firebase/workspace.service', () => ({
  createWorkspace: vi.fn(),
  deleteWorkspace: vi.fn(),
  getUserWorkspaces,
}))

import { useWorkspaceStore } from '../../src/stores/workspace-store'

describe('workspace store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    getUserWorkspaces.mockReset()
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
})
