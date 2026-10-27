import { describe, expect, it } from 'vitest'
import {
  buildFrenchAmortizationSchedule,
  calculateFrenchMonthlyPayment,
  calculateMortgageProjection,
  monthlyInterestRate,
} from '../../../src/domain/financial/mortgage-amortization.js'

describe('French mortgage amortization', () => {
  it('converts a nominal annual percentage into a monthly decimal rate', () => {
    expect(monthlyInterestRate(2.4)).toBeCloseTo(0.002)
  })

  it('calculates the standard fixed monthly payment', () => {
    expect(
      calculateFrenchMonthlyPayment({
        principal: 200_000,
        annualInterestRate: 3,
        termMonths: 360,
      }),
    ).toBe(843.21)
  })

  it('supports a zero-interest mortgage', () => {
    expect(
      calculateFrenchMonthlyPayment({
        principal: 12_000,
        annualInterestRate: 0,
        termMonths: 12,
      }),
    ).toBe(1_000)
  })

  it('splits payments and uses a smaller final payment', () => {
    const schedule = buildFrenchAmortizationSchedule({
      currentBalance: 1_000,
      annualInterestRate: 12,
      monthlyPayment: 400,
      asOfDate: '2026-01-31',
    })

    expect(schedule[0]).toEqual({
      paymentNumber: 1,
      date: '2026-02-28',
      payment: 400,
      interest: 10,
      principal: 390,
      remainingBalance: 610,
    })
    expect(schedule.at(-1).payment).toBeLessThan(400)
    expect(schedule.at(-1).remainingBalance).toBe(0)
  })

  it('calculates the effect of an additional monthly payment', () => {
    const projection = calculateMortgageProjection({
      currentBalance: 146_230,
      annualInterestRate: 2.41,
      monthlyPayment: 812,
      extraMonthlyPayment: 200,
      asOfDate: '2026-10-27',
    })

    expect(projection.accelerated.remainingPayments).toBeLessThan(projection.remainingPayments)
    expect(projection.accelerated.monthsEarlier).toBeGreaterThan(0)
    expect(projection.accelerated.interestSaved).toBeGreaterThan(0)
    expect(projection.nextPayment.interest + projection.nextPayment.principal).toBe(
      projection.nextPayment.payment,
    )
  })

  it('returns an empty schedule for a paid-off mortgage', () => {
    expect(
      buildFrenchAmortizationSchedule({
        currentBalance: 0,
        annualInterestRate: 3,
        monthlyPayment: 800,
        asOfDate: '2026-10-27',
      }),
    ).toEqual([])
  })

  it('rejects a payment that cannot amortize the mortgage', () => {
    expect(() =>
      buildFrenchAmortizationSchedule({
        currentBalance: 100_000,
        annualInterestRate: 12,
        monthlyPayment: 500,
        asOfDate: '2026-10-27',
      }),
    ).toThrow('does not cover')
  })
})
