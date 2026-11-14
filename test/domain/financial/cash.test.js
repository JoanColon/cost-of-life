import { describe, expect, it } from 'vitest'
import {
  calculateWeightedCashAnnualReturn,
  projectCashValue,
} from '../../../functions/shared/assets/cash.js'

describe('Cash asset model', () => {
  it('projects positive, zero, and negative annual compound returns', () => {
    expect(projectCashValue({ currentBalance: 10_000, annualReturnPercent: 10, months: 12 })).toBe(
      11_000,
    )
    expect(projectCashValue({ currentBalance: 10_000, annualReturnPercent: 0, months: 60 })).toBe(
      10_000,
    )
    expect(projectCashValue({ currentBalance: 10_000, annualReturnPercent: -10, months: 12 })).toBe(
      9_000,
    )
  })

  it('calculates a balance-weighted return and treats missing models as zero', () => {
    expect(
      calculateWeightedCashAnnualReturn([
        { balance: 5_000 },
        { balance: 20_000, annualReturnPercent: 2 },
        { balance: 10_000, annualReturnPercent: 3 },
      ]),
    ).toBe(2)
  })

  it('handles zero, invalid, and negative balances without misleading weights', () => {
    expect(
      calculateWeightedCashAnnualReturn([
        { balance: 0, annualReturnPercent: 10 },
        { balance: -1_000, annualReturnPercent: 10 },
        { balance: 1_000, annualReturnPercent: -2 },
        { balance: 1_000, annualReturnPercent: 'invalid' },
      ]),
    ).toBe(-1)
    expect(calculateWeightedCashAnnualReturn([])).toBe(0)
  })
})
