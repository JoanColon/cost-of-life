import { describe, expect, it } from 'vitest'
import { buildExpenseModelCategories } from '../../../src/domain/financial/expense-model-categories'

describe('expense model categories', () => {
  it('creates zero-valued editable expense categories', () => {
    const categories = buildExpenseModelCategories(['food'], ['food'], {}, ['a', 'b'])

    expect(categories.food).toMatchObject({
      enabled: true,
      manualEstimate: { amount: 0, frequency: 'monthly' },
      necessity: null,
    })
    expect(categories.food).not.toHaveProperty('manualValue')
    expect(categories.food).not.toHaveProperty('itemCount')
  })
})
