import { describe, expect, it } from 'vitest'
import {
  annualIncomeValue,
  incomeCalculationBreakdown,
  normalizeIncomeCalculation,
} from '../../../src/domain/financial/income-calculations'

describe('income calculations', () => {
  it('uses an annual salary as its annual value and derives both monthly concepts', () => {
    const calculation = { mode: 'annual_salary', annualAmount: 42000, paymentsPerYear: 14 }

    expect(annualIncomeValue(calculation)).toBe(42000)
    expect(incomeCalculationBreakdown(calculation)).toEqual({
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

    expect(annualIncomeValue(calculation)).toBe(41000)
    expect(incomeCalculationBreakdown(calculation).monthlyAverage).toBe(3416.67)
  })

  it.each([
    ['weekly', 100, 5200],
    ['monthly', 100, 1200],
    ['quarterly', 100, 400],
    ['yearly', 100, 100],
  ])('normalizes %s recurring income', (frequency, amount, expected) => {
    expect(annualIncomeValue({ mode: 'recurring', amount, frequency })).toBe(expected)
  })

  it('counts one-time income once', () => {
    expect(annualIncomeValue({ mode: 'one_time', amount: 1234.56 })).toBe(1234.56)
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
    expect(normalizeIncomeCalculation(calculation)).toBeNull()
    expect(annualIncomeValue(calculation)).toBeNull()
  })
})
