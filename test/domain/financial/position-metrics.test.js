import { describe, expect, it } from 'vitest'
import {
  calculateCostOfLifeRatioPercent,
  calculateFundedYears,
  calculateSavingsCapacity,
  calculateSavingsRatePercent,
} from '../../../functions/shared/positions/metrics.js'

describe('position metrics', () => {
  it('calculates savings capacity without imposing a consumer rounding policy', () => {
    expect(calculateSavingsCapacity(10.129, 3)).toBeCloseTo(7.129)
  })

  it('calculates dashboard ratios as whole percentages', () => {
    expect(calculateSavingsRatePercent(250, 1_000)).toBe(25)
    expect(calculateCostOfLifeRatioPercent(750, 1_000)).toBe(75)
    expect(calculateSavingsRatePercent(250, 0)).toBe(0)
  })

  it('calculates non-negative funded years from annual cost of life', () => {
    expect(calculateFundedYears(50_000, 20_000)).toBe(2.5)
    expect(calculateFundedYears(-1_000, 20_000)).toBe(0)
  })
})
