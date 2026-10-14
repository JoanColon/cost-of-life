import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase/firebase'

const defaults = {
  assets: { setupCompleted: false, categories: {} },
  liabilities: { setupCompleted: false, categories: {} },
  income: { setupCompleted: false, categories: {} },
  expenses: { setupCompleted: false, categories: {} },
  expenseTracking: { enabledSubcategories: null },
}

export function modelConfigRef(workspaceId, model) {
  if (!Object.hasOwn(defaults, model)) throw new Error('A valid model config is required')
  return doc(db, 'workspaces', workspaceId, 'modelConfig', model)
}

export async function getModelConfig(workspaceId, model) {
  const reference = modelConfigRef(workspaceId, model)
  const snapshot = await getDoc(reference)
  return snapshot.exists() ? snapshot.data() : { ...defaults[model] }
}
