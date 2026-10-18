import { describe, expect, it } from 'vitest'
import financialYearDomain from '../../functions/domain/financial-year.js'
import {
  financialYearExpenseItemValue,
  financialYearMonthValue,
  financialYearValue,
} from '../../src/domain/financial/financial-year.js'

const { applyTrackingMonth, buildFinancialYear, updateFinancialYearProjection } =
  financialYearDomain
const ownership = { mode: 'single', shares: [{ memberId: 'member-a', percentage: 100 }] }

function projection() {
  return buildFinancialYear({
    year: 2026,
    config: {
      assets: { categories: { cash: { enabled: true } } },
      liabilities: { categories: { mortgage: { enabled: true } } },
      expenses: {
        categories: {
          food: { enabled: true },
        },
      },
      income: { categories: {} },
    },
    assets: [{ id: 'account', category: 'cash', name: 'Account', currentValue: 1000, ownership }],
    liabilities: [{ id: 'home', category: 'mortgage', name: 'Mortgage', balance: 400, ownership }],
    expenses: [
      {
        id: 'groceries',
        categoryId: 'food',
        subcategoryId: 'groceries',
        itemName: 'Weekly groceries',
        notes: '',
        estimate: { amount: 500, frequency: 'monthly' },
        necessity: 'lifestyle',
        ownership,
      },
    ],
    trackingMonths: {},
  })
}

describe('server financial year projection', () => {
  it('uses one client selector for canonical and edited expense values', () => {
    expect(
      financialYearExpenseItemValue({ source: 'tracked', effective: 437 }, 500),
    ).toBe(437)
    expect(financialYearExpenseItemValue({ source: 'model', effective: 500 }, 600)).toBe(600)
    expect(financialYearExpenseItemValue({ source: 'model', effective: 500 })).toBe(500)
  })

  it('creates the twelve estimated months from the current model', () => {
    const result = projection()

    expect(Object.keys(result.months)).toHaveLength(12)
    expect(result.totals).toBeUndefined()
    expect(result.schemaVersion).toBe(2)
    expect(result.months['01'].assets.total).toBeUndefined()
    expect(result.months['01'].assets.categories.cash.total).toBeUndefined()
    expect(financialYearMonthValue(result, '01', 'assets')).toBe(1000)
    expect(financialYearMonthValue(result, '01', 'liabilities')).toBe(400)
    expect(financialYearMonthValue(result, '01', 'netWorth')).toBe(600)
    expect(financialYearMonthValue(result, '12', 'netWorth')).toBe(600)
    expect(financialYearValue(result, 'expenses')).toBe(6000)
    expect(result.months['10'].expenses.categories.food.subcategories.groceries.source).toBe(
      'model',
    )
    expect(
      result.months['10'].expenses.categories.food.subcategories.groceries.items.groceries
        .necessity,
    ).toBe('lifestyle')
  })

  it('uses simple asset values and ignores obsolete income values in model configuration', () => {
    const result = buildFinancialYear({
      year: 2026,
      config: {
        assets: { categories: { cash: { enabled: true, manualValue: 2500, ownership } } },
        liabilities: { categories: {} },
        expenses: {
          categories: {
            housing: { enabled: true },
          },
        },
        income: { categories: { other: { enabled: true, manualValue: 12000, ownership } } },
      },
    })

    expect(financialYearMonthValue(result, '01', 'assets')).toBe(2500)
    expect(financialYearValue(result, 'expenses')).toBe(0)
    expect(financialYearValue(result, 'income')).toBe(0)
  })

  it('distributes annual income cents without changing the annual amount', () => {
    const result = buildFinancialYear({
      year: 2026,
      config: { income: { categories: { employment: { enabled: true } } } },
      income: [
        {
          id: 'salary',
          categoryId: 'employment',
          subcategoryId: 'salary',
          itemName: 'Main salary',
          notes: 'Primary employment',
          calculation: { mode: 'annual_salary', annualAmount: 100, paymentsPerYear: 12 },
          disposablePercentage: 80,
          ownership,
        },
      ],
    })

    expect(financialYearMonthValue(result, '01', 'income')).toBe(8.34)
    expect(financialYearMonthValue(result, '12', 'income')).toBe(8.33)
    expect(financialYearValue(result, 'income')).toBe(100)
    expect(
      result.months['01'].income.categories.employment.subcategories.salary.items.salary
        .disposablePercentage,
    ).toBe(80)
    expect(
      result.months['01'].income.categories.employment.subcategories.salary.items.salary.notes,
    ).toBe('Primary employment')
  })

  it('does not rewrite closed position months when assets change in December', () => {
    const original = projection()
    const updated = updateFinancialYearProjection(original, {
      year: 2026,
      config: { assets: { categories: { cash: { enabled: true } } } },
      assets: [{ id: 'account', category: 'cash', currentValue: 1200, ownership }],
      sections: ['assets'],
      positionFromMonths: { assets: '12' },
    })

    expect(financialYearMonthValue(updated, '01', 'assets')).toBe(1000)
    expect(financialYearMonthValue(updated, '12', 'assets')).toBe(1200)
    expect(updated.months['01'].liabilities).toEqual(original.months['01'].liabilities)
    expect(updated.months['01'].expenses).toEqual(original.months['01'].expenses)
    expect(financialYearMonthValue(updated, '01', 'netWorth')).toBe(600)
    expect(financialYearMonthValue(updated, '12', 'netWorth')).toBe(800)
  })

  it('updates a historical tracked month without changing its stored estimates', () => {
    const original = projection()
    const updated = applyTrackingMonth(original, '10', {
      categories: {
        groceries: { items: [{ itemId: 'groceries', amount: 437, ownership }] },
      },
      reconciliation: { groceries: { decision: 'tracked' } },
    })

    expect(updated.months['10'].expenses.categories.food.subcategories.groceries).toMatchObject({
      estimated: 500,
      actual: 437,
      effective: 437,
      source: 'tracked',
    })
    expect(financialYearValue(updated, 'expenses')).toBe(5937)
    expect(
      updated.months['10'].expenses.categories.food.subcategories.groceries.items.groceries.actual,
    ).toBe(437)
    expect(financialYearValue(original, 'expenses')).toBe(6000)
    expect(updated.schemaVersion).toBe(2)
  })

  it('keeps the tracked actual when a historical month uses the model', () => {
    const updated = applyTrackingMonth(projection(), '10', {
      categories: {
        groceries: { items: [{ itemId: 'groceries', amount: 437, ownership }] },
      },
    })

    expect(updated.months['10'].expenses.categories.food.subcategories.groceries).toMatchObject({
      estimated: 500,
      actual: 437,
      effective: 500,
      source: 'model',
      actualMemberValues: { 'member-a': 437 },
    })
    expect(financialYearValue(updated, 'expenses')).toBe(6000)
  })
})
