import { describe, expect, it } from 'vitest'
import {
  normalizeNonNegativeMoneyOrNull,
  roundMoneyOrNull,
  roundMoneyOrZero,
} from '../../../functions/shared/core/money.js'

describe('money rounding policies', () => {
  it('rounds valid and Number-compatible values to cents', () => {
    expect(roundMoneyOrZero('10.129')).toBe(10.13)
    expect(roundMoneyOrNull(null)).toBe(0)
    expect(roundMoneyOrNull('')).toBe(0)
  })

  it('distinguishes the zero and null fallbacks for non-finite values', () => {
    expect(roundMoneyOrZero(undefined)).toBe(0)
    expect(roundMoneyOrNull(undefined)).toBeNull()
    expect(roundMoneyOrNull(Number.NaN)).toBeNull()
  })
})

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
