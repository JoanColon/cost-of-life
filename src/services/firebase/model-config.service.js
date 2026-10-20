import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase/firebase'

const defaults = {
  assets: { schemaVersion: 1, setupCompleted: false, categories: {} },
  liabilities: { schemaVersion: 1, setupCompleted: false, categories: {} },
  income: { schemaVersion: 1, setupCompleted: false, categories: {} },
  expenses: { schemaVersion: 1, setupCompleted: false, categories: {} },
  expenseTracking: { schemaVersion: 1, enabledSubcategories: null },
  whatIf: null,
  whatIfStrategies: null,
}

export function modelConfigRef(workspaceId, model) {
  if (!Object.hasOwn(defaults, model)) throw new Error('A valid model config is required')
  return doc(db, 'workspaces', workspaceId, 'modelConfig', model)
}

export async function getModelConfig(workspaceId, model) {
  const reference = modelConfigRef(workspaceId, model)
  const snapshot = await getDoc(reference)
  return snapshot.exists() ? snapshot.data() : defaults[model] ? { ...defaults[model] } : null
}
