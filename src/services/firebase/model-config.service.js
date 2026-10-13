import { doc, runTransaction, serverTimestamp } from 'firebase/firestore'
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

export async function ensureModelConfig(workspaceId, model) {
  const configRef = modelConfigRef(workspaceId, model)

  return runTransaction(db, async (transaction) => {
    const existing = await transaction.get(configRef)
    if (existing.exists()) return existing.data()

    const config = {
      schemaVersion: 1,
      ...defaults[model],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    transaction.set(configRef, config)
    return { ...config, createdAt: null, updatedAt: null }
  })
}
