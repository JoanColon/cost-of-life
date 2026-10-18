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
  return getCategoryPositionItems(workspaceId, 'assets', categoryId)
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
  if (includeDefaultDetail || Object.hasOwn(asset, 'detail')) {
    canonical.detail =
      asset.detail && typeof asset.detail === 'object' && !Array.isArray(asset.detail)
        ? { ...asset.detail }
        : {}
  }
  return canonical
}
