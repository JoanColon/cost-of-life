import { describe, expect, it } from 'vitest'
import {
  buildStrategyCalculationContext,
  extractPositionLiabilities,
  modeledLiabilitiesForPositions,
} from '../../../src/domain/financial/calculation-context.js'

const financialYear = {
  months: {
    10: {
      assets: {
        categories: {
          cash: { subcategories: { cash: { total: 5_000 } } },
          real_estate: {
            subcategories: {
              land: {
                total: 90_000,
                items: {
                  'land-a': { total: 90_000, memberValues: { alice: 45_000 } },
                },
              },
            },
          },
        },
      },
      liabilities: {
        categories: {
          mortgage: {
            subcategories: {
              primary_home: {
                total: 80_000,
                items: {
                  'mortgage-a': { total: 80_000, memberValues: { alice: 40_000 } },
                },
              },
            },
          },
          other_debt: { subcategories: { other_debt: { total: 2_000 } } },
        },
      },
    },
  },
}

describe('financial calculation context', () => {
  it('extracts liabilities once with stable IDs and member scoping', () => {
    expect(extractPositionLiabilities(financialYear, '10', 'alice')).toEqual([
      {
        id: 'mortgage-a',
        categoryId: 'mortgage',
        subcategoryId: 'primary_home',
        name: null,
        balance: 40_000,
      },
    ])
  })

  it('uses snapshot balances while taking projection rules from models', () => {
    const mortgageModel = {
      id: 'mortgage-a',
      categoryId: 'mortgage',
      balance: 99_999,
      ownership: {
        shares: [
          { memberId: 'alice', percentage: 50 },
          { memberId: 'bob', percentage: 50 },
        ],
      },
      detail: {
        mortgage: {
          amortizationType: 'french',
          annualInterestRate: 2,
          monthlyPayment: 1_000,
        },
      },
    }
    const context = buildStrategyCalculationContext({
      financialYear,
      month: '10',
      memberId: 'alice',
      realEstateAssets: [
        {
          id: 'land-a',
          currentValue: 120_000,
          ownership: {
            shares: [
              { memberId: 'alice', percentage: 50 },
              { memberId: 'bob', percentage: 50 },
            ],
          },
          detail: {
            realEstate: {
              schemaVersion: 2,
              purchasePrice: 60_000,
              purchaseDate: '2020-01-01',
              annualAppreciationRate: 2.5,
            },
          },
        },
      ],
      mortgageLiabilities: [mortgageModel],
    })

    expect(context.modeledRealEstateAssets[0]).toMatchObject({
      currentValue: 45_000,
      model: { purchasePrice: 30_000 },
    })
    expect(context.modeledMortgages[0]).toMatchObject({
      currentBalance: 40_000,
      monthlyPayment: 500,
    })
    expect(modeledLiabilitiesForPositions(context.liabilities, [mortgageModel])[0].balance).toBe(
      40_000,
    )
  })
})
