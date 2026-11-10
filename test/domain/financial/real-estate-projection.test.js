import { describe, expect, it } from 'vitest'
import { projectRealEstate } from '../../../functions/shared/assets/real-estate-projection.js'

const baseModel = {
  purchasePrice: 100_000,
  purchaseDate: '2020-04-01',
  currentDate: '2026-11-01',
  annualAppreciationRate: 2.5,
  horizonMonths: 12,
}

describe('real estate projection', () => {
  it('starts on the purchase date, identifies now, and projects beyond it', () => {
    const projection = projectRealEstate(baseModel)

    expect(projection[0]).toMatchObject({
      date: '2020-04-01',
      isCurrent: false,
      propertyValue: 100_000,
    })
    expect(projection.find(({ isCurrent }) => isCurrent)?.date).toBe('2026-11-01')
    expect(projection.at(-1).date).toBe('2027-11-01')
  })

  it('updates property value on purchase anniversaries', () => {
    const projection = projectRealEstate({ ...baseModel, horizonMonths: 0 })
    const beforeAnniversary = projection.find(({ date }) => date === '2021-03-01')
    const anniversary = projection.find(({ date }) => date === '2021-04-01')

    expect(beforeAnniversary.propertyValue).toBe(100_000)
    expect(anniversary.propertyValue).toBe(102_500)
    expect(projection.at(-1).propertyValue).toBeCloseTo(100_000 * Math.pow(1.025, 6), 2)
  })

  it('supports zero and negative appreciation', () => {
    expect(
      projectRealEstate({ ...baseModel, annualAppreciationRate: 0, horizonMonths: 0 }).at(-1)
        .propertyValue,
    ).toBe(100_000)
    expect(
      projectRealEstate({
        ...baseModel,
        purchaseDate: '2025-11-01',
        annualAppreciationRate: -10,
        horizonMonths: 0,
      }).at(-1).propertyValue,
    ).toBe(90_000)
  })

  it('uses historical, current, and future mortgage timeline balances', () => {
    const projection = projectRealEstate({
      ...baseModel,
      hasMortgage: true,
      horizonMonths: 2,
      mortgageTimeline: [
        { date: '2022-04-01', balance: 80_000 },
        { date: '2026-11-01', balance: 60_000 },
        { date: '2026-12-01', balance: 59_500 },
      ],
    })

    expect(projection[0].mortgageBalance).toBeNull()
    expect(projection[0].homeEquity).toBeNull()
    expect(projection.find(({ date }) => date === '2022-04-01').mortgageBalance).toBe(80_000)
    expect(projection.find(({ isCurrent }) => isCurrent).mortgageBalance).toBe(60_000)
    expect(projection.find(({ date }) => date === '2026-12-01').mortgageBalance).toBe(59_500)
  })

  it('does not add mortgage debt when no mortgage is linked', () => {
    const projection = projectRealEstate({ ...baseModel, horizonMonths: 1 })
    expect(projection.at(-1).homeEquity).toBe(projection.at(-1).propertyValue)
  })

  it('uses the persisted model appreciation bounds', () => {
    expect(() => projectRealEstate({ ...baseModel, annualAppreciationRate: 100.01 })).toThrow(
      'between -100% and 100%',
    )
  })
})
