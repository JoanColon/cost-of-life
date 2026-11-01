import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase/firebase'

const mutateFinancialModel = httpsCallable(functions, 'mutateFinancialModel')

export async function createFinancialModelItem(workspaceId, section, item) {
  return call({ workspaceId, section, operation: 'create', item })
}

export async function updateFinancialModelItem(workspaceId, section, itemId, item, relations) {
  const payload = { workspaceId, section, operation: 'update', itemId, item }
  if (relations !== undefined) payload.relations = relations
  return call(payload)
}

export async function deleteFinancialModelItem(workspaceId, section, itemId) {
  return call({ workspaceId, section, operation: 'delete', itemId })
}

export async function deleteFinancialModelCategory(workspaceId, section, categoryId) {
  return call({ workspaceId, section, operation: 'deleteCategory', categoryId })
}

async function call(payload) {
  const result = await mutateFinancialModel(payload)
  return result.data
}
