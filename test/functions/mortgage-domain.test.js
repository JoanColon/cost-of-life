import { describe, expect, it } from 'vitest'
import mortgageDomain from '../../functions/domain/mortgage.js'

const { effectiveMortgageBalance, isMortgagePaymentDueInMonth } = mortgageDomain

const mortgage = {
  schemaVersion: 2,
  annualInterestRate: 12,
  monthlyPayment: 1_000,
  startDate: '2025-12-15',
  balanceAnchor: { amount: 10_000, date: '2026-01-15' },
}

describe('modeled mortgage balance', () => {
  it('keeps the anchor balance until the next payment date', () => {
    expect(effectiveMortgageBalance(mortgage, '2026-02-14')).toBe(10_000)
  })

  it('applies each completed monthly payment exactly once', () => {
    expect(effectiveMortgageBalance(mortgage, '2026-02-15')).toBe(9_100)
    expect(effectiveMortgageBalance(mortgage, '2026-03-15')).toBe(8_191)
  })

  it('keeps payment dates aligned with the mortgage start date', () => {
    const offCycleAnchor = {
      ...mortgage,
      annualInterestRate: 0,
      startDate: '2026-01-01',
      balanceAnchor: { amount: 10_000, date: '2026-01-15' },
    }

    expect(effectiveMortgageBalance(offCycleAnchor, '2026-01-31')).toBe(10_000)
    expect(effectiveMortgageBalance(offCycleAnchor, '2026-02-01')).toBe(9_000)
  })

  it('stops at zero after the mortgage is paid off', () => {
    expect(
      effectiveMortgageBalance(
        { ...mortgage, annualInterestRate: 0, monthlyPayment: 6_000 },
        '2026-03-15',
      ),
    ).toBe(0)
  })

  it('identifies contractual payment months before and after payoff', () => {
    const shortMortgage = {
      ...mortgage,
      annualInterestRate: 0,
      monthlyPayment: 10_000,
      startDate: '2026-01-01',
      balanceAnchor: { amount: 10_000, date: '2026-01-01' },
    }

    expect(isMortgagePaymentDueInMonth(shortMortgage, 2026, 0)).toBe(false)
    expect(isMortgagePaymentDueInMonth(shortMortgage, 2026, 1)).toBe(true)
    expect(isMortgagePaymentDueInMonth(shortMortgage, 2026, 2)).toBe(false)
  })
})
