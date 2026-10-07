import { describe, expect, it } from 'vitest'
import { normalizeMoney } from '../../../src/domain/financial/money'

describe('normalizeMoney', () => {
  it.each([
    [0, 0],
    ['10.129', 10.13],
    [12.345, 12.35],
  ])('normalizes %s to cents', (value, expected) => {
    expect(normalizeMoney(value)).toBe(expected)
  })

  it.each(['', null, undefined, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects %s',
    (value) => {
      expect(normalizeMoney(value)).toBeNull()
    },
  )
})
