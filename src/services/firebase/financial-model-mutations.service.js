import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase/firebase'

const mutateFinancialModel = httpsCallable(functions, 'mutateFinancialModel')

export async function createFinancialModelItem(workspaceId, section, item) {
  return call({ workspaceId, section, operation: 'create', item })
}

export async function updateFinancialModelItem(workspaceId, section, itemId, item) {
  return call({ workspaceId, section, operation: 'update', itemId, item })
}

export async function deleteFinancialModelItem(workspaceId, section, itemId) {
  return call({ workspaceId, section, operation: 'delete', itemId })
}

export async function deleteFinancialModelCategory(workspaceId, section, categoryId) {
  return call({ workspaceId, section, operation: 'deleteCategory', categoryId })
}

export async function syncExpenseTrackingModel(workspaceId, subcategories) {
  return call({ workspaceId, section: 'expenses', operation: 'syncTracking', subcategories })
}

async function call(payload) {
  const result = await mutateFinancialModel(payload)
  return result.data
}
