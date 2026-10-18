import { describe, expect, it } from 'vitest'
import { calculateMilestoneProgress } from '@/domain/milestones/calculations'

describe('milestones', () => {
  it('calculates safety, net worth and freedom from the current workspace totals', () => {
    const progress = calculateMilestoneProgress({
      financialYear: financialYear({
        cash: 30_000,
        investments: 60_000,
        liabilities: { mortgage: 20_000 },
        annualCost: 12_000,
      }),
      month: '10',
    })

    expect(milestone(progress, 'safety_12_months')).toMatchObject({
      currentValue: 30,
      progress: 1,
      reached: true,
    })
    expect(milestone(progress, 'net_worth_50000')).toMatchObject({
      currentValue: 70_000,
      progress: 1,
      reached: true,
    })
    expect(milestone(progress, 'net_worth_100000')).toMatchObject({
      currentValue: 70_000,
      progress: 0.7,
      reached: false,
    })
    expect(milestone(progress, 'freedom_5_years')).toMatchObject({
      currentValue: 5,
      progress: 1,
      reached: true,
    })
  })

  it('does not award coverage milestones when Cost of Life is zero', () => {
    const progress = calculateMilestoneProgress({
      financialYear: financialYear({ cash: 30_000, investments: 60_000, annualCost: 0 }),
      month: '10',
    })

    expect(milestone(progress, 'safety_1_month')).toMatchObject({
      currentValue: 0,
      progress: 0,
      reached: false,
    })
    expect(milestone(progress, 'freedom_1_year')).toMatchObject({
      currentValue: 0,
      progress: 0,
      reached: false,
    })
  })

  it('keeps an achievement while reporting lower current progress', () => {
    const progress = calculateMilestoneProgress({
      financialYear: financialYear({ cash: 1_000, annualCost: 12_000 }),
      achievements: [{ milestoneId: 'safety_6_months' }],
      month: '10',
    })
    const safety = milestone(progress, 'safety_6_months')

    expect(safety.currentValue).toBe(1)
    expect(safety.progress).toBeCloseTo(1 / 6)
    expect(safety.reached).toBe(false)
    expect(safety.previouslyAchieved).toBe(true)
  })

  it('only makes debt milestones relevant after a positive historical balance', () => {
    const history = financialYear({
      year: 2025,
      liabilities: { car_loan: 8_000, credit_card_debt: 2_000 },
    })
    const progress = calculateMilestoneProgress({
      financialYear: financialYear({ year: 2026 }),
      financialHistory: [history],
      month: '10',
    })

    expect(milestone(progress, 'debt_car_free')).toMatchObject({
      currentValue: 0,
      relevant: true,
      progress: 1,
      reached: true,
    })
    expect(milestone(progress, 'debt_consumer_free')).toMatchObject({
      relevant: true,
      reached: true,
    })
    expect(milestone(progress, 'debt_free')).toMatchObject({ relevant: true, reached: true })
    expect(milestone(progress, 'debt_mortgage_free')).toMatchObject({
      relevant: false,
      progress: 0,
      reached: false,
    })
  })

  it('requires net worth to be greater than zero for positive net worth', () => {
    const progress = calculateMilestoneProgress({
      financialYear: financialYear({}),
      month: '10',
    })

    expect(milestone(progress, 'net_worth_positive')).toMatchObject({
      currentValue: 0,
      progress: 0,
      reached: false,
    })
  })

  it('reports gradual debt progress from the highest historical balance', () => {
    const progress = calculateMilestoneProgress({
      financialYear: financialYear({ liabilities: { mortgage: 40_000 } }),
      financialHistory: [financialYear({ year: 2025, liabilities: { mortgage: 100_000 } })],
      month: '10',
    })

    expect(milestone(progress, 'debt_mortgage_free')).toMatchObject({
      currentValue: 40_000,
      progress: 0.6,
      reached: false,
      relevant: true,
    })
  })
})

function milestone(progress, id) {
  return progress.find((candidate) => candidate.id === id)
}

function financialYear({
  year = 2026,
  cash = 0,
  investments = 0,
  liabilities = {},
  annualCost = 0,
} = {}) {
  const months = Object.fromEntries(
    Array.from({ length: 12 }, (_, index) => {
      const month = String(index + 1).padStart(2, '0')
      return [
        month,
        {
          assets: {
            categories: {
              ...(cash ? { cash: positionCategory('cash', cash) } : {}),
              ...(investments ? { investment: positionCategory('investment', investments) } : {}),
            },
          },
          liabilities: {
            categories: Object.fromEntries(
              Object.entries(liabilities).map(([categoryId, value]) => [
                categoryId,
                positionCategory(categoryId, value),
              ]),
            ),
          },
          income: { categories: {} },
          expenses: {
            categories: annualCost
              ? {
                  other: {
                    subcategories: {
                      expense: { effective: annualCost / 12 },
                    },
                  },
                }
              : {},
          },
        },
      ]
    }),
  )
  return { id: String(year), year, months }
}

function positionCategory(id, value) {
  return { subcategories: { [id]: { total: value } } }
}
