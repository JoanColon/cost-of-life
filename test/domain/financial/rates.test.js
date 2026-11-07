import { describe, expect, it } from 'vitest'
import {
  effectiveGrowthFactor,
  effectiveMonthlyRate,
  normalizeAnnualPercent,
} from '../../../src/domain/financial/rates.js'

describe('effective annual rates', () => {
  it('converts an effective annual percentage into an equivalent monthly rate', () => {
    const monthlyRate = effectiveMonthlyRate(7)

    expect(Math.pow(1 + monthlyRate, 12)).toBeCloseTo(1.07, 12)
    expect(effectiveGrowthFactor(7, 12)).toBeCloseTo(1.07, 12)
  })

  it('normalizes editable percentages without inventing invalid values', () => {
    expect(normalizeAnnualPercent(1)).toBe(1)
    expect(normalizeAnnualPercent(101, 2)).toBe(2)
    expect(normalizeAnnualPercent('invalid')).toBeNull()
  })
})
