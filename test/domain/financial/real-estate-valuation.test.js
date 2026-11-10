import { describe, expect, it } from 'vitest'
import { calculateAnniversaryRealEstateValuation } from '../../../functions/shared/assets/real-estate.js'
import {
  annualRealEstateValue,
  effectiveRealEstateValue,
} from '../../../src/domain/financial/real-estate-valuation.js'

const model = {
  schemaVersion: 2,
  purchasePrice: 100_000,
  purchaseDate: '2020-04-01',
  annualAppreciationRate: 2.5,
}

describe('annual real estate valuation', () => {
  it('changes only when a purchase anniversary is completed', () => {
    expect(annualRealEstateValue(model, '2024-03-31')).toBe(107_689.06)
    expect(annualRealEstateValue(model, '2024-04-01')).toBe(110_381.29)
  })

  it('uses the model for Layer 2 value and retains legacy manual values', () => {
    expect(
      effectiveRealEstateValue(
        { currentValue: 90_000, detail: { realEstate: model } },
        '2024-04-01',
      ),
    ).toBe(110_381.29)
    expect(effectiveRealEstateValue({ currentValue: 90_000 }, '2024-04-01')).toBe(90_000)
  })

  it('keeps client and server annual valuations aligned', () => {
    expect(calculateAnniversaryRealEstateValuation(model, '2026-11-01')).toBe(
      annualRealEstateValue(model, '2026-11-01'),
    )
  })

  it('rejects a future purchase date', () => {
    expect(() => annualRealEstateValue(model, '2019-01-01')).toThrow(
      'purchase date cannot be in the future',
    )
  })
})
