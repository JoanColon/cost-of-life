import { describe, expect, it } from 'vitest'
import {
  calculateAnnualIncomeAmount,
  calculateIncomeBreakdown,
  normalizeDisposableIncomePercent,
  normalizeIncomeCalculationModel,
} from '../../../functions/shared/income/calculations.js'

describe('income calculations', () => {
  it('uses an annual salary as its annual value and derives both monthly concepts', () => {
    const calculation = { mode: 'annual_salary', annualAmount: 42000, paymentsPerYear: 14 }

    expect(calculateAnnualIncomeAmount(calculation)).toBe(42000)
    expect(calculateIncomeBreakdown(calculation)).toEqual({
      annualValue: 42000,
      perPayment: 3000,
      monthlyAverage: 3500,
    })
  })

  it('calculates twelve monthly payments plus extras assigned to specific months', () => {
    const calculation = {
      mode: 'monthly_schedule',
      monthlyAmount: 3000,
      extrasByMonth: { june: 2500, december: 2500 },
    }

    expect(calculateAnnualIncomeAmount(calculation)).toBe(41000)
    expect(calculateIncomeBreakdown(calculation).monthlyAverage).toBe(3416.67)
  })

  it.each([
    ['monthly', 100, 1200],
    ['quarterly', 100, 400],
    ['yearly', 100, 100],
  ])('normalizes %s recurring income', (frequency, amount, expected) => {
    expect(calculateAnnualIncomeAmount({ mode: 'recurring', amount, frequency })).toBe(expected)
  })

  it('counts one-time income once', () => {
    expect(calculateAnnualIncomeAmount({ mode: 'one_time', amount: 1234.56 })).toBe(1234.56)
  })

  it.each([
    { mode: 'annual_salary', annualAmount: 42000, paymentsPerYear: 0 },
    {
      mode: 'monthly_schedule',
      monthlyAmount: 3000,
      extrasByMonth: { someday: 3000 },
    },
    { mode: 'monthly_schedule', monthlyAmount: 3000, extrasByMonth: { june: -1 } },
    { mode: 'recurring', amount: 100, frequency: 'daily' },
    { mode: 'one_time', amount: -1 },
    { mode: 'unknown', amount: 100 },
  ])('rejects invalid calculation %#', (calculation) => {
    expect(normalizeIncomeCalculationModel(calculation)).toBeNull()
    expect(calculateAnnualIncomeAmount(calculation)).toBeNull()
  })

  it('normalizes an available-income percentage between zero and one hundred', () => {
    expect(normalizeDisposableIncomePercent('72.3456')).toBe(72.346)
    expect(normalizeDisposableIncomePercent(101)).toBeNull()
    expect(normalizeDisposableIncomePercent(undefined, 100)).toBe(100)
  })
})
