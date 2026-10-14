import { describe, expect, it } from 'vitest'
import financialYearDomain from '../../functions/domain/financial-year.js'

const { applyTrackingMonth, buildFinancialYear, updateFinancialYearProjection } =
  financialYearDomain
const ownership = { mode: 'single', shares: [{ memberId: 'member-a', percentage: 100 }] }

function projection() {
  return buildFinancialYear({
    year: 2026,
    config: {
      assets: { categories: { cash: { enabled: true } } },
      liabilities: { categories: { mortgage: { enabled: true } } },
      expenses: { categories: { food: { enabled: true } } },
      income: { categories: {} },
    },
    assets: [{ id: 'account', category: 'cash', name: 'Account', currentValue: 1000, ownership }],
    liabilities: [{ id: 'home', category: 'mortgage', name: 'Mortgage', balance: 400, ownership }],
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
    trackingMonths: {},
  })
}

describe('server financial year projection', () => {
  it('creates the twelve estimated months from the current model', () => {
    const result = projection()

    expect(Object.keys(result.months)).toHaveLength(12)
    expect(result.months['01'].assets.total).toBe(1000)
    expect(result.months['01'].liabilities.total).toBe(400)
    expect(result.months['01'].netWorth).toBe(600)
    expect(result.months['12'].netWorth).toBe(600)
    expect(result.totals.expenses).toBe(6000)
    expect(result.months['10'].expenses.categories.food.subcategories.groceries.source).toBe(
      'model',
    )
  })

  it('uses simple values directly from model configuration', () => {
    const result = buildFinancialYear({
      year: 2026,
      config: {
        assets: { categories: { cash: { enabled: true, manualValue: 2500, ownership } } },
        liabilities: { categories: {} },
        expenses: {
          categories: {
            housing: {
              enabled: true,
              manualEstimate: { amount: 600, frequency: 'monthly' },
              ownership,
            },
          },
        },
        income: { categories: { other: { enabled: true, manualValue: 12000, ownership } } },
      },
    })

    expect(result.months['01'].assets.total).toBe(2500)
    expect(result.totals.expenses).toBe(7200)
    expect(result.totals.income).toBe(12000)
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

    expect(updated.months['01'].assets.total).toBe(1000)
    expect(updated.months['12'].assets.total).toBe(1200)
    expect(updated.months['01'].liabilities).toEqual(original.months['01'].liabilities)
    expect(updated.months['01'].expenses).toEqual(original.months['01'].expenses)
    expect(updated.months['01'].netWorth).toBe(600)
    expect(updated.months['12'].netWorth).toBe(800)
  })

  it('updates a historical tracked month without changing its stored estimates', () => {
    const original = projection()
    const updated = applyTrackingMonth(original, '10', {
      categories: { groceries: { items: [{ amount: 437, ownership }] } },
      reconciliation: { groceries: { decision: 'tracked' } },
    })

    expect(updated.months['10'].expenses.categories.food.subcategories.groceries).toMatchObject({
      estimated: 500,
      actual: 437,
      effective: 437,
      source: 'tracked',
    })
    expect(updated.totals.expenses).toBe(5937)
    expect(original.totals.expenses).toBe(6000)
  })

  it('keeps the tracked actual when a historical month uses the model', () => {
    const updated = applyTrackingMonth(projection(), '10', {
      categories: { groceries: { items: [{ amount: 437, ownership }] } },
    })

    expect(updated.months['10'].expenses.categories.food.subcategories.groceries).toMatchObject({
      estimated: 500,
      actual: 437,
      effective: 500,
      source: 'model',
      actualMemberValues: { 'member-a': 437 },
    })
    expect(updated.totals.expenses).toBe(6000)
  })
})
