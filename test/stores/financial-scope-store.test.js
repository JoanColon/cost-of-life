import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useFinancialScopeStore } from '../../src/stores/financial-scope-store'

describe('financial scope', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('defaults to all in a workspace with multiple members', () => {
    const store = useFinancialScopeStore()

    expect(store.get('workspace', ['owner', 'member'], 'owner')).toBe('all')
  })

  it('defaults to the only member in a single-member workspace', () => {
    const store = useFinancialScopeStore()

    expect(store.get('workspace', ['owner'], 'owner')).toBe('owner')
  })

  it('preserves a valid manual selection', () => {
    const store = useFinancialScopeStore()
    store.select('workspace', 'member')

    expect(store.get('workspace', ['owner', 'member'], 'owner')).toBe('member')
  })

  it('falls back to all when a previous selection is no longer valid', () => {
    const store = useFinancialScopeStore()
    store.select('workspace', 'removed-member')

    expect(store.get('workspace', ['owner', 'member'], 'owner')).toBe('all')
  })
})
