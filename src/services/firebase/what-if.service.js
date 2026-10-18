import { serverTimestamp, setDoc } from 'firebase/firestore'
import { normalizeWhatIfConfig } from '@/domain/financial/what-if'
import { currentUserId } from '@/services/firebase/current-user'
import { getModelConfig, modelConfigRef } from '@/services/firebase/model-config.service'

export async function getWhatIfConfig(workspaceId) {
  return normalizeWhatIfConfig((await getModelConfig(workspaceId, 'whatIf')) || {})
}

export async function saveWhatIfConfig(workspaceId, config) {
  const normalized = normalizeWhatIfConfig(config)
  await setDoc(
    modelConfigRef(workspaceId, 'whatIf'),
    {
      schemaVersion: 1,
      ...normalized,
      updatedAt: serverTimestamp(),
      updatedBy: currentUserId(),
    },
    { merge: true },
  )
  return normalized
}
