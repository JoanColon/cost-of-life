import { getLiabilityCategory } from '@/config/liability-categories'
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

export async function getLiabilitiesConfig(workspaceId) {
  return getPositionConfig(workspaceId, 'liabilities')
}

export async function getCategoryLiabilities(workspaceId, categoryId) {
  return getCategoryPositionItems(workspaceId, 'liabilities', categoryId)
}

export async function saveLiabilitiesSetup(workspaceId, categories) {
  return savePositionSetup(workspaceId, 'liabilities', categories)
}

export async function updateLiabilityCategories(workspaceId, categories) {
  return updatePositionCategories(workspaceId, 'liabilities', categories)
}

export async function updateSimpleLiabilityValue(workspaceId, categoryId, value) {
  return updateSimplePositionValue(workspaceId, 'liabilities', categoryId, value)
}

export async function updateSimpleLiabilityOwnership(
  workspaceId,
  categoryId,
  ownership,
  memberIds,
) {
  return updateSimplePositionOwnership(workspaceId, 'liabilities', categoryId, ownership, memberIds)
}

export async function createLiability(workspaceId, liability, memberIds) {
  assertPositionOwnership(liability.ownership, memberIds)
  return createFinancialModelItem(workspaceId, 'liabilities', canonicalLiability(liability))
}

export async function updateLiability(workspaceId, liabilityId, changes, memberIds) {
  assertPositionOwnership(changes.ownership, memberIds)
  return updateFinancialModelItem(
    workspaceId,
    'liabilities',
    liabilityId,
    canonicalLiability(changes),
  )
}

export async function deleteLiability(workspaceId, liabilityId) {
  return deleteFinancialModelItem(workspaceId, 'liabilities', liabilityId)
}

export async function deleteLiabilityCategory(workspaceId, categoryId) {
  await deleteFinancialModelCategory(workspaceId, 'liabilities', categoryId)
}

function canonicalLiability(liability) {
  const category = getLiabilityCategory(liability.categoryId)
  if (!category) throw new Error('A valid liability category is required')
  if (!category.subcategories.includes(liability.subcategoryId)) {
    throw new Error('A valid liability subcategory is required')
  }
  const balance = normalizeNonNegativeMoney(liability.balance)
  if (balance === null) throw new Error('A non-negative balance is required')
  const itemName = String(liability.itemName || '').trim()
  if (!itemName) throw new Error('A liability name is required')
  return {
    categoryId: category.id,
    subcategoryId: liability.subcategoryId,
    itemName,
    notes: String(liability.notes || '').trim(),
    balance,
    ownership: cloneOwnership(liability.ownership),
  }
}
