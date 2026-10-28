import { describe, expect, it } from 'vitest'
import {
  calculateDebtPayoffImpact,
  highestInterestModeledDebt,
} from '../../../src/domain/financial/debt-payoff.js'

function mortgage(id, annualInterestRate, balance = 146_230) {
  return {
    id,
    balance,
    detail: {
      mortgage: {
        originalPrincipal: 200_000,
        annualInterestRate,
        monthlyPayment: 812,
        startDate: '2020-01-01',
        termMonths: 360,
        amortizationType: 'french',
        fixedRate: true,
      },
    },
  }
}

describe('debt payoff projections', () => {
  it('uses the French mortgage model for an accelerated payoff projection', () => {
    const result = calculateDebtPayoffImpact({
      liability: mortgage('home', 2.41),
      extraMonthlyPayment: 200,
      asOfDate: '2026-10-28',
    })

    expect(result.modelType).toBe('mortgage')
    expect(result.accelerated.remainingPayments).toBeLessThan(result.remainingPayments)
    expect(result.accelerated.interestSaved).toBeGreaterThan(0)
  })

  it('returns null when the liability has no supported detail model', () => {
    expect(
      calculateDebtPayoffImpact({
        liability: { id: 'loan', balance: 10_000 },
        extraMonthlyPayment: 200,
      }),
    ).toBeNull()
  })

  it('selects the modeled debt with the highest annual interest rate', () => {
    expect(
      highestInterestModeledDebt([
        mortgage('lower', 1.9),
        { id: 'unmodeled', balance: 3_000 },
        mortgage('higher', 4.25),
      ]).id,
    ).toBe('higher')
  })
})
