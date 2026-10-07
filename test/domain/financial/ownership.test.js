import { describe, expect, it } from 'vitest'
import {
  allocateValueByOwnership,
  applyOwnership,
  createEqualOwnership,
  isValidOwnership,
} from '../../../src/domain/financial/ownership'

describe('ownership', () => {
  it('creates ownership for one member', () => {
    expect(createEqualOwnership(['a'])).toEqual({
      mode: 'single',
      shares: [{ memberId: 'a', percentage: 100 }],
    })
  })

  it('creates equal ownership for two members', () => {
    expect(createEqualOwnership(['a', 'b']).shares).toEqual([
      { memberId: 'a', percentage: 50 },
      { memberId: 'b', percentage: 50 },
    ])
  })

  it('creates equal ownership for three members that adds up to 100%', () => {
    const ownership = createEqualOwnership(['a', 'b', 'c'])

    expect(ownership.shares).toEqual([
      { memberId: 'a', percentage: 33.333 },
      { memberId: 'b', percentage: 33.333 },
      { memberId: 'c', percentage: 33.334 },
    ])
    expect(ownership.shares.reduce((sum, share) => sum + share.percentage, 0)).toBe(100)
  })

  it('accepts valid custom ownership', () => {
    expect(
      isValidOwnership(
        {
          mode: 'shared',
          shares: [
            { memberId: 'a', percentage: 25 },
            { memberId: 'b', percentage: 75 },
          ],
        },
        ['a', 'b'],
      ),
    ).toBe(true)
  })

  it.each([
    ['does not add up to 100%', [{ memberId: 'a', percentage: 90 }], ['a']],
    ['contains an unknown member', [{ memberId: 'unknown', percentage: 100 }], ['a']],
    ['contains a negative percentage', [{ memberId: 'a', percentage: -10 }], ['a']],
    ['contains a percentage over 100', [{ memberId: 'a', percentage: 110 }], ['a']],
    [
      'contains a duplicate member',
      [
        { memberId: 'a', percentage: 50 },
        { memberId: 'a', percentage: 50 },
      ],
      ['a'],
    ],
  ])('rejects ownership that %s', (_case, shares, memberIds) => {
    expect(isValidOwnership({ mode: 'shared', shares }, memberIds)).toBe(false)
  })
})

describe('allocation', () => {
  it.each([
    [100, [50, 50], { a: 50, b: 50 }],
    [100, [33, 67], { a: 33, b: 67 }],
    [100, [33.333, 33.333, 33.334], { a: 33.33, b: 33.33, c: 33.34 }],
    [0, [50, 50], { a: 0, b: 0 }],
    [10.01, [50, 50], { a: 5.01, b: 5 }],
  ])('allocates %s using %j', (value, percentages, expected) => {
    const memberIds = ['a', 'b', 'c'].slice(0, percentages.length)
    const ownership = {
      mode: percentages.length > 1 ? 'shared' : 'single',
      shares: memberIds.map((memberId, index) => ({
        memberId,
        percentage: percentages[index],
      })),
    }

    const allocation = allocateValueByOwnership(value, ownership, memberIds)
    expect(allocation).toEqual(expected)
    expect(Object.values(allocation).reduce((sum, amount) => sum + amount, 0)).toBe(value)
  })

  it('uses the same remainder allocation for an individual member value', () => {
    const ownership = createEqualOwnership(['a', 'b', 'c'])

    expect(applyOwnership(100, ownership, 'c')).toBe(33.34)
    expect(applyOwnership(100, ownership, 'unknown')).toBe(0)
  })
})
