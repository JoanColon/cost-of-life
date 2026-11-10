import { describe, expect, it } from 'vitest'
import {
  buildFrenchMortgageScheduleFromBalance,
  calculateMortgageBalanceFromAnchor,
} from '../../../functions/shared/liabilities/mortgage.js'

describe('shared mortgage time semantics', () => {
  it('projects forward from a balance known at the projection date', () => {
    const schedule = buildFrenchMortgageScheduleFromBalance({
      currentBalance: 10_000,
      annualInterestRate: 0,
      monthlyPayment: 1_000,
      asOfDate: '2026-01-15',
      startDate: '2025-12-01',
    })

    expect(schedule[0]).toMatchObject({ date: '2026-02-01', remainingBalance: 9_000 })
  })

  it('reconstructs historical payments only after the recorded anchor', () => {
    const mortgage = {
      schemaVersion: 2,
      annualInterestRate: 0,
      monthlyPayment: 1_000,
      startDate: '2025-12-01',
      balanceAnchor: { amount: 10_000, date: '2026-01-15' },
    }

    expect(calculateMortgageBalanceFromAnchor(mortgage, '2026-01-31')).toBe(10_000)
    expect(calculateMortgageBalanceFromAnchor(mortgage, '2026-02-01')).toBe(9_000)
  })
})
