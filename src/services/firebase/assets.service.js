import { getAssetCategory } from '@/config/asset-categories'
import {
  createFinancialModelItem,
  deleteFinancialModelCategory,
  deleteFinancialModelItem,
  updateFinancialModelItem,
} from '@/services/firebase/financial-model-mutations.service'
import { normalizeNonNegativeMoney } from '@/domain/financial/money'
import { cloneOwnership } from '@/domain/financial/ownership'
import {
  annualRealEstateValue,
  effectiveRealEstateValue,
} from '@/domain/financial/real-estate-valuation'
import {
  assertPositionOwnership,
  getCategoryPositionItems,
  getPositionConfig,
  savePositionSetup,
  updatePositionCategories,
  updateSimplePositionOwnership,
  updateSimplePositionValue,
} from '@/services/firebase/position-model.service'

export async function getAssetsConfig(workspaceId) {
  return getPositionConfig(workspaceId, 'assets')
}

export async function getCategoryAssets(workspaceId, categoryId) {
  const assets = await getCategoryPositionItems(workspaceId, 'assets', categoryId)
  return assets.map((asset) => ({ ...asset, currentValue: effectiveRealEstateValue(asset) }))
}

export async function saveAssetsSetup(workspaceId, categories) {
  return savePositionSetup(workspaceId, 'assets', categories)
}

export async function updateAssetsCategories(workspaceId, categories) {
  return updatePositionCategories(workspaceId, 'assets', categories)
}

export async function updateSimpleCategoryValue(workspaceId, categoryId, value) {
  return updateSimplePositionValue(workspaceId, 'assets', categoryId, value)
}

export async function updateSimpleCategoryOwnership(workspaceId, categoryId, ownership, memberIds) {
  return updateSimplePositionOwnership(workspaceId, 'assets', categoryId, ownership, memberIds)
}

export async function createAsset(workspaceId, asset, memberIds) {
  assertPositionOwnership(asset.ownership, memberIds)
  return createFinancialModelItem(workspaceId, 'assets', canonicalAsset(asset, true))
}

export async function updateAsset(workspaceId, assetId, changes, memberIds) {
  assertPositionOwnership(changes.ownership, memberIds)
  return updateFinancialModelItem(workspaceId, 'assets', assetId, canonicalAsset(changes))
}

export async function deleteAsset(workspaceId, assetId) {
  return deleteFinancialModelItem(workspaceId, 'assets', assetId)
}

export async function deleteAssetCategory(workspaceId, categoryId) {
  await deleteFinancialModelCategory(workspaceId, 'assets', categoryId)
}

function canonicalAsset(asset, includeDefaultDetail = false) {
  const category = getAssetCategory(asset.categoryId)
  if (!category) throw new Error('A valid asset category is required')
  if (!category.subcategories.includes(asset.subcategoryId)) {
    throw new Error('A valid asset subcategory is required')
  }
  const currentValue = normalizeNonNegativeMoney(asset.currentValue)
  if (currentValue === null) throw new Error('A non-negative numeric value is required')
  const itemName = String(asset.itemName || '').trim()
  if (!itemName) throw new Error('An asset name is required')
  const canonical = {
    categoryId: category.id,
    subcategoryId: asset.subcategoryId,
    itemName,
    notes: String(asset.notes || '').trim(),
    currentValue,
    ownership: cloneOwnership(asset.ownership),
    valueSource: 'manual',
  }
  const mortgageEligible =
    category.id === 'real_estate' &&
    ['primary_home', 'rental_property'].includes(asset.subcategoryId)
  const realEstateModelEligible = category.id === 'real_estate'
  if (mortgageEligible) {
    canonical.mortgageLiabilityId = normalizeOptionalId(asset.mortgageLiabilityId)
  }
  if (includeDefaultDetail || Object.hasOwn(asset, 'detail')) {
    const detail =
      asset.detail && typeof asset.detail === 'object' && !Array.isArray(asset.detail)
        ? { ...asset.detail }
        : {}
    if (detail.realEstate != null) {
      if (!realEstateModelEligible) throw new Error('Only real estate can have a real estate model')
      const annualAppreciationRate = Number(detail.realEstate.annualAppreciationRate)
      if (
        !Number.isFinite(annualAppreciationRate) ||
        annualAppreciationRate < -100 ||
        annualAppreciationRate > 100
      ) {
        throw new Error('A valid annual appreciation rate is required')
      }
      if (detail.realEstate.schemaVersion === 2) {
        const purchasePrice = normalizeNonNegativeMoney(detail.realEstate.purchasePrice)
        const purchaseDate = String(detail.realEstate.purchaseDate || '').trim()
        if (purchasePrice === null) throw new Error('A valid purchase price is required')
        detail.realEstate = {
          schemaVersion: 2,
          purchasePrice,
          purchaseDate,
          annualAppreciationRate,
        }
        canonical.currentValue = annualRealEstateValue(detail.realEstate)
        canonical.valueSource = 'model'
      } else {
        detail.realEstate = { schemaVersion: 1, annualAppreciationRate }
      }
    }
    canonical.detail = detail
  }
  return canonical
}

function normalizeOptionalId(value) {
  const id = String(value || '').trim()
  return id || null
}
