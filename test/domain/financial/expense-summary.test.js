import { describe, expect, it } from 'vitest'
import { addItemToCategory } from '../../../src/domain/financial/category-summary'
import {
  buildExpenseSummaryCategories,
  costOfLifeTotals,
  rebuildExpenseCategorySummary,
} from '../../../src/domain/financial/expense-summary'
import { createEqualOwnership } from '../../../src/domain/financial/ownership'

const ownership = createEqualOwnership(['a', 'b'])

describe('expense summary', () => {
  it('creates simple categories with an editable estimate', () => {
    const categories = buildExpenseSummaryCategories(['food'], ['food'], {}, ['a', 'b'])

    expect(categories.food).toMatchObject({
      enabled: true,
      manualEstimate: { amount: 0, frequency: 'monthly' },
      manualValue: 0,
      necessity: null,
      itemCount: 0,
    })
  })

  it('calculates annual and monthly Cost of Life from annual summary values', () => {
    const summary = {
      categories: {
        food: {
          enabled: true,
          manualValue: 7200,
          ownership,
          itemCount: 0,
          itemizedValue: 0,
          memberValues: { a: 3600, b: 3600 },
        },
        travel: {
          enabled: true,
          manualValue: 999,
          ownership,
          itemCount: 0,
          itemizedValue: 0,
          memberValues: { a: 499.5, b: 499.5 },
        },
      },
    }

    expect(costOfLifeTotals(summary)).toEqual({
      annualCostOfLife: 8199,
      monthlyCostOfLife: 683.25,
    })
  })

  it('does not double count the manual estimate after itemization', () => {
    const category = addItemToCategory(
      {
        enabled: true,
        manualValue: 7200,
        ownership,
        itemCount: 0,
        itemizedValue: 0,
        memberValues: { a: 3600, b: 3600 },
      },
      6000,
      ownership,
    )

    expect(costOfLifeTotals({ categories: { food: category } }).annualCostOfLife).toBe(6000)
  })

  it('rebuilds a stale accumulated category total from its expense documents', () => {
    const category = rebuildExpenseCategorySummary(
      {
        enabled: true,
        manualValue: 0,
        ownership,
        itemCount: 5,
        itemizedValue: 9704,
        memberValues: { a: 4852, b: 4852 },
      },
      [
        {
          estimate: { amount: 120, frequency: 'yearly' },
          ownership,
        },
        {
          estimate: { amount: 386, frequency: 'monthly' },
          ownership,
        },
      ],
    )

    expect(category).toMatchObject({
      itemCount: 2,
      itemizedValue: 4752,
      memberValues: { a: 2376, b: 2376 },
    })
  })
})
