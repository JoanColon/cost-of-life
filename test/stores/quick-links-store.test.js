import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { getQuickLinks, saveQuickLinks } = vi.hoisted(() => ({
  getQuickLinks: vi.fn(),
  saveQuickLinks: vi.fn(),
}))

vi.mock('@/services/firebase/user-preferences.service', () => ({
  getQuickLinks,
  saveQuickLinks,
}))

import { useQuickLinksStore } from '../../src/stores/quick-links-store'

describe('quick links store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    getQuickLinks.mockReset().mockResolvedValue([])
    saveQuickLinks.mockReset().mockImplementation(async (_, links) => links)
  })

  it('loads preferences once per workspace', async () => {
    getQuickLinks.mockResolvedValueOnce(['route:expense-tracker'])
    const store = useQuickLinksStore()

    await store.load('workspace-a')
    await store.load('workspace-a')

    expect(getQuickLinks).toHaveBeenCalledTimes(1)
    expect(store.linksFor('workspace-a')).toEqual(['route:expense-tracker'])
  })

  it('keeps each workspace configuration separate', async () => {
    getQuickLinks
      .mockResolvedValueOnce(['route:assets'])
      .mockResolvedValueOnce(['route:liabilities'])
    const store = useQuickLinksStore()

    await store.load('workspace-a')
    await store.load('workspace-b')

    expect(store.linksFor('workspace-a')).toEqual(['route:assets'])
    expect(store.linksFor('workspace-b')).toEqual(['route:liabilities'])
  })

  it('persists and exposes a new selection', async () => {
    const store = useQuickLinksStore()
    const links = ['investment-portfolio:portfolio-a', 'mortgage-detail:mortgage-a']

    await store.save('workspace-a', links)

    expect(saveQuickLinks).toHaveBeenCalledWith('workspace-a', links)
    expect(store.linksFor('workspace-a')).toEqual(links)
  })
})
