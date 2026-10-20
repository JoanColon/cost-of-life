import { serverTimestamp, writeBatch } from 'firebase/firestore'
import { normalizeWhatIfConfig } from '@/domain/financial/what-if'
import { db } from '@/firebase/firebase'
import { currentUserId } from '@/services/firebase/current-user'
import { getModelConfig, modelConfigRef } from '@/services/firebase/model-config.service'

export async function getWhatIfConfig(workspaceId) {
  const [legacyConfig, strategyConfig] = await Promise.all([
    getModelConfig(workspaceId, 'whatIf'),
    getModelConfig(workspaceId, 'whatIfStrategies'),
  ])
  return normalizeWhatIfConfig({ ...(legacyConfig || {}), ...(strategyConfig || {}) })
}

export async function saveWhatIfConfig(workspaceId, config) {
  const normalized = normalizeWhatIfConfig(config)
  const activeScenario =
    normalized.scenarios.find(({ id }) => id === normalized.activeScenarioId) ||
    normalized.scenarios[0]
  const updatedAt = serverTimestamp()
  const updatedBy = currentUserId()
  const batch = writeBatch(db)
  batch.set(modelConfigRef(workspaceId, 'whatIf'), {
    schemaVersion: 1,
    discretionaryReductionPercent: normalized.discretionaryReductionPercent,
    expectedAnnualReturnPercent: activeScenario.investmentMix.stockMarket?.annualReturnPercent || 7,
    selectedLiabilityId: activeScenario.selectedLiabilityId,
    strategy: activeScenario.allocation,
    updatedAt: serverTimestamp(),
    updatedBy,
  })
  batch.set(modelConfigRef(workspaceId, 'whatIfStrategies'), {
    schemaVersion: 1,
    activeScenarioId: normalized.activeScenarioId,
    scenarios: normalized.scenarios,
    updatedAt,
    updatedBy,
  })
  await batch.commit()
  return normalized
}
