import { describe, expect, it } from 'vitest'
import { buildExpenseModelCategories } from '../../../src/domain/financial/expense-model-categories'

describe('expense model categories', () => {
  it('stores only category selection because subcategories come from expense items', () => {
    const categories = buildExpenseModelCategories(['food'], ['food'], {}, ['a', 'b'])

    expect(categories.food).toEqual({ enabled: true })
    expect(categories.food).not.toHaveProperty('manualValue')
    expect(categories.food).not.toHaveProperty('itemCount')
  })

  it('removes obsolete category-level expense estimates', () => {
    const categories = buildExpenseModelCategories(
      ['food'],
      ['food'],
      {
        food: {
          enabled: true,
          manualEstimate: { amount: 300, frequency: 'monthly' },
          subcategories: { groceries: {} },
        },
      },
      ['a'],
    )

    expect(categories.food).toEqual({ enabled: true })
  })
})
