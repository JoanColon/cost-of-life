import { describe, expect, it } from 'vitest'
import {
  buildModelCategories,
  buildIncomeModelCategories,
  canonicalCategory,
} from '../../../src/domain/financial/model-categories'

describe('model category construction', () => {
  it('builds zero-valued categories and preserves existing editable data', () => {
    const existing = { enabled: true, manualValue: 75, ownership: { mode: 'equal' } }
    const categories = buildModelCategories(['one', 'two'], ['two'], { one: existing }, ['a', 'b'])

    expect(categories.one).toEqual({ ...existing, enabled: false })
    expect(categories.two).toMatchObject({ enabled: true, manualValue: 0 })
  })

  it('keeps editable values in modelConfig and removes derived values', () => {
    expect(
      canonicalCategory({
        enabled: true,
        manualValue: 75,
        manualEstimate: { amount: 75, frequency: 'monthly' },
        monthlyAmounts: [75],
        ownership: { mode: 'equal' },
        necessity: 'essential',
        itemCount: 1,
        itemizedValue: 75,
        memberValues: { a: 75 },
      }),
    ).toEqual({
      enabled: true,
      manualValue: 75,
      manualEstimate: { amount: 75, frequency: 'monthly' },
      monthlyAmounts: [75],
      ownership: { mode: 'equal' },
      necessity: 'essential',
    })
  })

  it('keeps income category configuration item-only', () => {
    const categories = buildIncomeModelCategories(
      ['employment'],
      ['employment'],
      { employment: { enabled: true, manualValue: 100 } },
      ['a'],
    )
    expect(categories.employment).toEqual({ enabled: true })
  })
})
