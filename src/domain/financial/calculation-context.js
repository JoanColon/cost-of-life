import {
  financialYearMonthCategoryValue,
  financialYearMonthValue,
} from '../../../functions/shared/positions/annual-projection.js'
import { moneyForOwnershipScope } from '../../../functions/shared/core/ownership.js'
import { buildStrategyStartingPosition } from '../../../functions/shared/plan/strategy-simulation.js'
import { calculateWeightedCashAnnualReturn } from '../../../functions/shared/assets/cash.js'

export function extractPositionItems(
  financialYear,
  month,
  section,
  { categoryIds = null, memberId = 'all' } = {},
) {
  const allowedCategories = categoryIds ? new Set(categoryIds) : null
  const categories = financialYear?.months?.[month]?.[section]?.categories || {}
  return Object.entries(categories).flatMap(([categoryId, category]) => {
    if (allowedCategories && !allowedCategories.has(categoryId)) return []
    return Object.entries(category?.subcategories || {}).flatMap(([subcategoryId, subcategory]) => {
      const items = Object.entries(subcategory?.items || {})
      if (items.length) {
        return items.map(([id, item]) => ({
          id,
          categoryId,
          subcategoryId,
          name: item.itemName || null,
          value: scopedPositionValue(item, memberId),
        }))
      }
      return [
        {
          id: subcategoryId,
          categoryId,
          subcategoryId,
          name: null,
          value: scopedPositionValue(subcategory, memberId),
        },
      ]
    })
  })
}

export function extractPositionLiabilities(
  financialYear,
  month,
  memberId = 'all',
  resolveCategoryName = () => null,
) {
  return extractPositionItems(financialYear, month, 'liabilities', { memberId })
    .map(({ value, ...liability }) => ({
      ...liability,
      name: liability.name || resolveCategoryName(liability.categoryId),
      balance: value,
    }))
    .filter(({ balance }) => balance > 0)
    .sort((left, right) => right.balance - left.balance)
}

export function buildStrategyCalculationContext({
  financialYear,
  month,
  memberId = 'all',
  realEstateAssets = [],
  cashAssets = [],
  mortgageLiabilities = [],
} = {}) {
  const assetPositions = new Map(
    extractPositionItems(financialYear, month, 'assets', {
      categoryIds: ['real_estate'],
      memberId,
    }).map((item) => [item.id, item.value]),
  )
  const liabilityPositions = new Map(
    extractPositionLiabilities(financialYear, month, memberId).map((item) => [
      item.id,
      item.balance,
    ]),
  )

  return {
    startingPosition: buildStrategyStartingPosition(financialYear, month, memberId),
    suggestedCashAnnualReturnPercent: calculateScopedCashAnnualReturn({
      financialYear,
      month,
      memberId,
      cashAssets,
    }),
    currentAssets: financialYearMonthValue(financialYear, month, 'assets', memberId),
    currentLiabilities: financialYearMonthValue(financialYear, month, 'liabilities', memberId),
    currentNetWorth: financialYearMonthValue(financialYear, month, 'netWorth', memberId),
    currentRealEstate: financialYearMonthCategoryValue(
      financialYear,
      month,
      'assets',
      'real_estate',
      memberId,
    ),
    liabilities: extractPositionLiabilities(financialYear, month, memberId),
    modeledRealEstateAssets: realEstateAssets
      .filter(({ id, detail }) => id && detail?.realEstate && assetPositions.has(id))
      .map((asset) => {
        const model = asset.detail.realEstate
        return {
          id: asset.id,
          currentValue: assetPositions.get(asset.id),
          model: {
            ...model,
            ...(model.schemaVersion === 2
              ? {
                  purchasePrice: moneyForOwnershipScope(
                    model.purchasePrice,
                    asset.ownership,
                    memberId,
                  ),
                }
              : {}),
          },
        }
      })
      .filter(({ currentValue }) => currentValue > 0),
    modeledMortgages: mortgageLiabilities
      .filter(
        ({ id, detail }) =>
          id && detail?.mortgage?.amortizationType === 'french' && liabilityPositions.has(id),
      )
      .map((liability) => ({
        id: liability.id,
        currentBalance: liabilityPositions.get(liability.id),
        annualInterestRate: liability.detail.mortgage.annualInterestRate,
        monthlyPayment: moneyForOwnershipScope(
          liability.detail.mortgage.monthlyPayment,
          liability.ownership,
          memberId,
        ),
      }))
      .filter(({ currentBalance, monthlyPayment }) => currentBalance > 0 && monthlyPayment > 0),
  }
}

/** Uses observed, ownership-scoped Cash positions as weights for their optional L3 returns. */
export function calculateScopedCashAnnualReturn({
  financialYear,
  month,
  memberId = 'all',
  cashAssets = [],
} = {}) {
  const modelsById = new Map(cashAssets.map((asset) => [asset.id, asset]))
  const positions = extractPositionItems(financialYear, month, 'assets', {
    categoryIds: ['cash'],
    memberId,
  }).map(({ id, value }) => ({
    balance: value,
    annualReturnPercent: modelsById.get(id)?.detail?.cash?.annualReturnPercent ?? 0,
  }))
  return calculateWeightedCashAnnualReturn(positions)
}

export function modeledLiabilitiesForPositions(
  positionLiabilities = [],
  modelLiabilities = [],
  memberId = 'all',
) {
  const positionsById = new Map(positionLiabilities.map((liability) => [liability.id, liability]))
  return modelLiabilities.flatMap((model) => {
    const position = positionsById.get(model.id)
    if (!position) return []
    const mortgage = model.detail?.mortgage
    return [
      {
        ...model,
        balance: position.balance,
        name: position.name || model.itemName || null,
        ...(mortgage
          ? {
              detail: {
                ...model.detail,
                mortgage: {
                  ...mortgage,
                  originalPrincipal: moneyForOwnershipScope(
                    mortgage.originalPrincipal,
                    model.ownership,
                    memberId,
                  ),
                  monthlyPayment: moneyForOwnershipScope(
                    mortgage.monthlyPayment,
                    model.ownership,
                    memberId,
                  ),
                },
              },
            }
          : {}),
      },
    ]
  })
}

function scopedPositionValue(item, memberId) {
  const value = memberId !== 'all' ? item?.memberValues?.[memberId] : item?.total
  return Math.max(0, Number(value) || 0)
}
