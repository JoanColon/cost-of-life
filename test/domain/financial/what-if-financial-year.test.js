import { describe, expect, it } from 'vitest'
import {
  financialYearAvailableIncomeValue,
  financialYearExpenseNecessityValue,
  financialYearUnclassifiedExpenseValue,
  financialYearValue,
} from '../../../src/domain/financial/financial-year'

const item = (total, extra = {}) => ({
  total,
  memberValues: { a: total * 0.75, b: total * 0.25 },
  ...extra,
})

describe('What If financial-year selectors', () => {
  const financialYear = {
    months: {
      '01': {
        income: {
          categories: {
            investments: {
              subcategories: {
                dividends: {
                  ...item(1_000),
                  items: { primary: item(1_000, { disposablePercentage: 80 }) },
                },
              },
            },
            employment: {
              subcategories: {
                bonus: { ...item(200), items: { annual: item(200) } },
              },
            },
          },
        },
        expenses: {
          categories: {
            food: {
              subcategories: {
                groceries: {
                  ...item(300),
                  necessity: 'essential',
                  effective: 300,
                  source: 'model',
                },
                restaurants: {
                  ...item(100),
                  necessity: 'lifestyle',
                  effective: 100,
                  source: 'model',
                },
                unknown: { ...item(50), necessity: null, effective: 50, source: 'model' },
              },
            },
          },
        },
      },
    },
  }

  it('applies item disposable percentages and defaults them to 100%', () => {
    expect(financialYearAvailableIncomeValue(financialYear)).toBe(1_000)
    expect(financialYearAvailableIncomeValue(financialYear, 'a')).toBe(750)
    expect(financialYearValue(financialYear, 'savings')).toBe(550)
  })

  it('separates lifestyle and unclassified expenses', () => {
    expect(financialYearExpenseNecessityValue(financialYear, 'lifestyle')).toBe(100)
    expect(financialYearUnclassifiedExpenseValue(financialYear)).toBe(50)
  })
})
