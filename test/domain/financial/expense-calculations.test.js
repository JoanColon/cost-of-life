import { describe, expect, it } from 'vitest'
import {
  annualMonthlyExpenseValue,
  annualExpenseValue,
  generateMonthlyExpenseAmounts,
  monthlyExpenseValue,
  normalizeExpenseAttributes,
  normalizeExpenseEstimate,
  expenseFrequencies,
  updateMonthlyExpenseAmounts,
} from '../../../src/domain/financial/expense-calculations'

describe('expense calculations', () => {
  it('exposes only the supported expense frequencies', () => {
    expect(expenseFrequencies).toEqual(['monthly', 'every_two_months', 'quarterly', 'yearly'])
  })

  it.each([
    ['monthly', 100, 1200],
    ['every_two_months', 100, 600],
    ['quarterly', 300, 1200],
    ['yearly', 600, 600],
  ])('normalizes %s estimates to an annual value', (frequency, amount, expected) => {
    expect(annualExpenseValue({ amount, frequency })).toBe(expected)
  })

  it('derives the monthly equivalent from the annual total', () => {
    expect(monthlyExpenseValue({ amount: 600, frequency: 'yearly' })).toBe(50)
  })

  it('generates an editable Jan-Dec schedule from the estimate', () => {
    expect(generateMonthlyExpenseAmounts({ amount: 300, frequency: 'quarterly' })).toEqual({
      january: 300,
      february: 0,
      march: 0,
      april: 300,
      may: 0,
      june: 0,
      july: 300,
      august: 0,
      september: 0,
      october: 300,
      november: 0,
      december: 0,
    })
  })

  it('uses the twelve editable month values for the annual total', () => {
    const months = generateMonthlyExpenseAmounts({ amount: 100, frequency: 'monthly' })
    months.april = 250

    expect(annualMonthlyExpenseValue(months)).toBe(1350)
  })

  it('updates baseline months without losing manual monthly exceptions', () => {
    const monthlyAmounts = generateMonthlyExpenseAmounts({ amount: 500, frequency: 'monthly' })
    monthlyAmounts.august = 800

    const updated = updateMonthlyExpenseAmounts(
      monthlyAmounts,
      { amount: 500, frequency: 'monthly' },
      { amount: 550, frequency: 'monthly' },
    )

    expect(updated.july).toBe(550)
    expect(updated.august).toBe(800)
    expect(updated.september).toBe(550)
  })

  it('preserves exceptions when the baseline frequency changes', () => {
    const monthlyAmounts = generateMonthlyExpenseAmounts({ amount: 300, frequency: 'quarterly' })
    monthlyAmounts.february = 75

    const updated = updateMonthlyExpenseAmounts(
      monthlyAmounts,
      { amount: 300, frequency: 'quarterly' },
      { amount: 100, frequency: 'monthly' },
    )

    expect(updated.january).toBe(100)
    expect(updated.february).toBe(75)
    expect(updated.march).toBe(100)
  })

  it.each([
    { amount: -1, frequency: 'monthly' },
    { amount: Number.NaN, frequency: 'monthly' },
    { amount: 100, frequency: 'daily' },
  ])('rejects invalid estimates %#', (estimate) => {
    expect(normalizeExpenseEstimate(estimate)).toBeNull()
    expect(annualExpenseValue(estimate)).toBeNull()
  })

  it('allows necessity to remain unclassified', () => {
    expect(
      normalizeExpenseAttributes({
        variability: 'variable',
        recurrence: 'recurring',
        necessity: null,
      }),
    ).toEqual({ variability: 'variable', recurrence: 'recurring', necessity: null })
  })

  it('rejects invalid behavior attributes', () => {
    expect(
      normalizeExpenseAttributes({
        variability: 'sometimes',
        recurrence: 'recurring',
        necessity: 'essential',
      }),
    ).toBeNull()
  })
})
