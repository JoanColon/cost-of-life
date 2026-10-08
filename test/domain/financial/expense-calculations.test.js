import { describe, expect, it } from 'vitest'
import {
  annualMonthlyExpenseValue,
  annualExpenseValue,
  generateMonthlyExpenseAmounts,
  monthlyExpenseValue,
  normalizeExpenseAttributes,
  normalizeExpenseEstimate,
} from '../../../src/domain/financial/expense-calculations'

describe('expense calculations', () => {
  it.each([
    ['weekly', 100, 5200],
    ['monthly', 100, 1200],
    ['every_two_months', 100, 600],
    ['quarterly', 300, 1200],
    ['yearly', 600, 600],
    ['irregular', 1000, 1000],
  ])('normalizes %s estimates to an annual value', (frequency, amount, expected) => {
    expect(annualExpenseValue({ amount, frequency })).toBe(expected)
  })

  it('derives the monthly equivalent from the annual total', () => {
    expect(monthlyExpenseValue({ amount: 600, frequency: 'yearly' })).toBe(50)
    expect(monthlyExpenseValue({ amount: 1000, frequency: 'irregular' })).toBe(83.33)
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
