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

export async function updateLiability(workspaceId, liabilityId, changes, memberIds, options = {}) {
  assertPositionOwnership(changes.ownership, memberIds)
  const relations = {}
  if (Object.hasOwn(options, 'mortgageAssetId')) {
    relations.mortgageAssetId = normalizeOptionalId(options.mortgageAssetId)
  }
  if (Object.hasOwn(options, 'mortgageExpenseId')) {
    relations.mortgageExpenseId = normalizeOptionalId(options.mortgageExpenseId)
  }
  const canonical = canonicalLiability(changes)
  return Object.keys(relations).length
    ? updateFinancialModelItem(workspaceId, 'liabilities', liabilityId, canonical, relations)
    : updateFinancialModelItem(workspaceId, 'liabilities', liabilityId, canonical)
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
  const canonical = {
    categoryId: category.id,
    subcategoryId: liability.subcategoryId,
    itemName,
    notes: String(liability.notes || '').trim(),
    balance,
    ownership: cloneOwnership(liability.ownership),
  }
  if (category.id === 'mortgage' && liability.detail?.mortgage) {
    canonical.detail = { mortgage: canonicalMortgageDetail(liability.detail.mortgage) }
  }
  return canonical
}

function canonicalMortgageDetail(mortgage) {
  const originalPrincipal = normalizeNonNegativeMoney(mortgage.originalPrincipal)
  const monthlyPayment = normalizeNonNegativeMoney(mortgage.monthlyPayment)
  const annualInterestRate = Number(mortgage.annualInterestRate)
  const termMonths = Number(mortgage.termMonths)
  const startDate = String(mortgage.startDate || '').trim()
  if (originalPrincipal === null) throw new Error('A valid original principal is required')
  if (monthlyPayment === null || monthlyPayment <= 0) {
    throw new Error('A valid monthly payment is required')
  }
  if (!Number.isFinite(annualInterestRate) || annualInterestRate < 0 || annualInterestRate > 100) {
    throw new Error('A valid annual interest rate is required')
  }
  if (!Number.isInteger(termMonths) || termMonths <= 0 || termMonths > 1_200) {
    throw new Error('A valid mortgage term is required')
  }
  if (!isIsoDate(startDate)) throw new Error('A valid mortgage start date is required')

  const schemaVersion = mortgage.schemaVersion === 2 ? 2 : 1
  let balanceAnchor
  if (schemaVersion === 2) {
    const amount = normalizeNonNegativeMoney(mortgage.balanceAnchor?.amount)
    const date = String(mortgage.balanceAnchor?.date || '').trim()
    if (amount === null || !isIsoDate(date)) {
      throw new Error('A valid mortgage balance anchor is required')
    }
    balanceAnchor = { amount, date }
  }

  return {
    schemaVersion,
    originalPrincipal,
    annualInterestRate,
    monthlyPayment,
    startDate,
    termMonths,
    amortizationType: 'french',
    fixedRate: true,
    ...(balanceAnchor ? { balanceAnchor } : {}),
  }
}

function isIsoDate(value) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return false
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return (
    date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() === Number(match[2]) - 1 &&
    date.getUTCDate() === Number(match[3])
  )
}

function normalizeOptionalId(value) {
  const id = String(value || '').trim()
  return id || null
}
