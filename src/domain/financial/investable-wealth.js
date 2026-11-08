import {
  financialYearMonthCategoryValue,
  financialYearMonthItemValue,
  financialYearMonthSubcategoryValue,
  financialYearMonthValue,
} from './financial-year'

export const INVESTABLE_ASSET_CATEGORY_IDS = Object.freeze(['cash', 'investment'])
export const INVESTABLE_REAL_ESTATE_SUBCATEGORY_IDS = Object.freeze([
  'rental_property',
  'land',
  'real_estate_other',
])

export function primaryHomeMortgageLiabilityIds(realEstateAssets = []) {
  return new Set(
    realEstateAssets
      .filter(({ subcategoryId }) => subcategoryId === 'primary_home')
      .map(({ mortgageLiabilityId }) => mortgageLiabilityId)
      .filter(Boolean),
  )
}

export function investableWealthAt(
  financialYear,
  month,
  { memberId = 'all', excludedLiabilityIds = new Set() } = {},
) {
  const investableAssets =
    INVESTABLE_ASSET_CATEGORY_IDS.reduce(
      (total, categoryId) =>
        total +
        financialYearMonthCategoryValue(financialYear, month, 'assets', categoryId, memberId),
      0,
    ) +
    INVESTABLE_REAL_ESTATE_SUBCATEGORY_IDS.reduce(
      (total, subcategoryId) =>
        total +
        financialYearMonthSubcategoryValue(
          financialYear,
          month,
          'assets',
          'real_estate',
          subcategoryId,
          memberId,
        ),
      0,
    )
  const excludedLiabilities = [...excludedLiabilityIds].reduce(
    (total, liabilityId) =>
      total +
      financialYearMonthItemValue(financialYear, month, 'liabilities', liabilityId, memberId),
    0,
  )
  const includedLiabilities =
    financialYearMonthValue(financialYear, month, 'liabilities', memberId) - excludedLiabilities

  return Math.round((investableAssets - includedLiabilities + Number.EPSILON) * 100) / 100
}
