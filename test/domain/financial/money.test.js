import { describe, expect, it } from 'vitest'
import { normalizeNonNegativeMoneyOrNull } from '../../../functions/shared/core/money.js'

describe('normalizeNonNegativeMoneyOrNull', () => {
  it.each([
    [0, 0],
    ['10.129', 10.13],
    [12.345, 12.35],
  ])('normalizes %s to cents', (value, expected) => {
    expect(normalizeNonNegativeMoneyOrNull(value)).toBe(expected)
  })

  it.each(['', null, undefined, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects %s',
    (value) => {
      expect(normalizeNonNegativeMoneyOrNull(value)).toBeNull()
    },
  )
})
