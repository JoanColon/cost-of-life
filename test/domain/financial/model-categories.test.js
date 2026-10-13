import { describe, expect, it } from 'vitest'
import {
  buildModelCategories,
  canonicalCategory,
  hydrateModelConfigWithBaselines,
} from '../../../src/domain/financial/model-categories'

describe('model category construction', () => {
  it('builds zero-valued categories and preserves existing editable data', () => {
    const existing = { enabled: true, manualValue: 75, ownership: { mode: 'equal' } }
    const categories = buildModelCategories(['one', 'two'], ['two'], { one: existing }, ['a', 'b'])

    expect(categories.one).toEqual({ ...existing, enabled: false })
    expect(categories.two).toMatchObject({ enabled: true, manualValue: 0 })
  })

  it('keeps persisted modelConfig free of financial and derived values', () => {
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
    ).toEqual({ enabled: true })
  })

  it('hydrates editor state from category baselines without changing modelConfig', () => {
    const config = { categories: { salary: { enabled: true } } }
    const result = hydrateModelConfigWithBaselines(
      config,
      [{ category: 'salary', annualValue: 30000 }],
      (baseline) => ({ manualValue: baseline.annualValue }),
    )

    expect(result.categories.salary).toEqual({ enabled: true, manualValue: 30000 })
    expect(config.categories.salary).toEqual({ enabled: true })
  })
})
