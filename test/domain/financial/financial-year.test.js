import { describe, expect, it } from 'vitest'
import {
  buildFinancialYear,
  currentFinancialYear,
  financialYearCategoryValue,
  financialYearSubcategoryValue,
  financialYearValue,
} from '../../../src/domain/financial/financial-year'

const ownership = { mode: 'single', shares: [{ memberId: 'member-a', percentage: 100 }] }

describe('financial year projection', () => {
  it('uses the canonical Madrid timezone at the year boundary', () => {
    expect(currentFinancialYear(new Date('2026-12-31T23:30:00Z'))).toBe(2027)
  })

  it('uses tracked actuals only for reconciled months', () => {
    const result = buildFinancialYear({
      year: 2026,
      config: {
        expenses: { categories: { food: { enabled: true } } },
        income: { categories: {} },
      },
      expenses: [
        {
          id: 'groceries',
          category: 'food',
          type: 'groceries',
          name: 'Groceries',
          estimate: { amount: 500, frequency: 'monthly' },
          ownership,
        },
      ],
      trackingMonths: {
        '2026-10': {
          categories: {
            groceries: { items: [{ id: 'one', amount: 437, ownership }] },
          },
          reconciliation: { groceries: { decision: 'tracked' } },
        },
      },
    })

    expect(result.months['09'].expenses.categories.food.subcategories.groceries).toMatchObject({
      estimated: 500,
      actual: null,
      effective: 500,
      source: 'model',
    })
    expect(result.months['10'].expenses.categories.food.subcategories.groceries).toMatchObject({
      estimated: 500,
      actual: 437,
      effective: 437,
      source: 'tracked',
    })
    expect(financialYearValue(result, 'expenses')).toBe(5937)
    expect(financialYearCategoryValue(result, 'expenses', 'food', 'member-a')).toBe(5937)
    expect(financialYearSubcategoryValue(result, 'expenses', 'food', 'groceries', 'member-a')).toBe(
      5937,
    )
  })

  it('preserves a tracked actual when the model remains effective', () => {
    const result = buildFinancialYear({
      year: 2026,
      config: {
        expenses: { categories: { food: { enabled: true } } },
        income: { categories: {} },
      },
      expenses: [
        {
          id: 'groceries',
          category: 'food',
          type: 'groceries',
          name: 'Groceries',
          estimate: { amount: 500, frequency: 'monthly' },
          ownership,
        },
      ],
      trackingMonths: {
        '2026-10': {
          categories: {
            groceries: { items: [{ id: 'one', amount: 437, ownership }] },
          },
        },
      },
    })

    expect(result.months['10'].expenses.categories.food.subcategories.groceries).toMatchObject({
      estimated: 500,
      actual: 437,
      effective: 500,
      source: 'model',
      actualMemberValues: { 'member-a': 437 },
    })
  })

  it('projects income, savings, simple categories and ownership', () => {
    const result = buildFinancialYear({
      year: 2026,
      config: {
        expenses: {
          categories: {
            housing: {
              enabled: true,
            },
          },
        },
        income: {
          categories: {
            employment: { enabled: true },
          },
        },
      },
      expenses: [
        {
          id: 'baseline--housing',
          kind: 'categoryBaseline',
          category: 'housing',
          estimate: { amount: 400, frequency: 'monthly' },
          ownership,
        },
      ],
      income: [
        {
          id: 'salary',
          category: 'employment',
          subtype: 'salary',
          name: 'Salary',
          calculation: { mode: 'annual_salary', annualAmount: 24000, paymentsPerYear: 12 },
          ownership,
        },
      ],
    })

    expect(financialYearValue(result, 'income')).toBe(24000)
    expect(financialYearValue(result, 'expenses')).toBe(4800)
    expect(financialYearValue(result, 'savings')).toBe(19200)
    expect(result.months['01'].savings).toBe(1600)
  })

  it('places one-time income in its recognition month', () => {
    const result = buildFinancialYear({
      year: 2026,
      config: {
        expenses: { categories: {} },
        income: { categories: { other: { enabled: true } } },
      },
      income: [
        {
          id: 'refund',
          category: 'other',
          subtype: 'other',
          name: 'Refund',
          calculation: { mode: 'one_time', amount: 1200, month: 'october' },
          ownership,
        },
      ],
    })

    expect(result.months['09'].income.total).toBe(0)
    expect(result.months['10'].income.total).toBe(1200)
    expect(result.totals.income).toBe(1200)
  })
})
