import {
  collection,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/firebase/firebase'
import { normalizeNonNegativeMoney } from '@/domain/financial/money'
import { cloneOwnership, isValidOwnership } from '@/domain/financial/ownership'
import { canonicalCategories } from '@/domain/financial/model-categories'
import { currentUserId } from '@/services/firebase/current-user'
import { getModelConfig, modelConfigRef } from '@/services/firebase/model-config.service'

const definitions = {
  assets: { collection: 'modelAssets', singular: 'asset' },
  liabilities: { collection: 'modelLiabilities', singular: 'liability' },
}

export function getPositionConfig(workspaceId, section) {
  return getModelConfig(workspaceId, section)
}

export async function getCategoryPositionItems(workspaceId, section, categoryId) {
  const definition = definitionFor(section)
  const reference = collection(db, 'workspaces', workspaceId, definition.collection)
  const snapshot = await getDocs(query(reference, where('categoryId', '==', categoryId)))
  return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }))
}

export async function savePositionSetup(workspaceId, section, categories) {
  const userId = currentUserId()
  const batch = writeBatch(db)
  batch.set(modelConfigRef(workspaceId, section), {
    schemaVersion: 1,
    setupCompleted: true,
    categories: canonicalCategories(categories),
    createdAt: serverTimestamp(),
    createdBy: userId,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  })
  await batch.commit()
}

export async function updatePositionCategories(workspaceId, section, categories) {
  const userId = currentUserId()
  const batch = writeBatch(db)
  batch.set(
    modelConfigRef(workspaceId, section),
    {
      schemaVersion: 1,
      setupCompleted: true,
      categories: canonicalCategories(categories),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    },
    { merge: true },
  )
  await batch.commit()
}

export async function updateSimplePositionValue(workspaceId, section, categoryId, value) {
  const definition = definitionFor(section)
  const userId = currentUserId()
  const documentRef = modelConfigRef(workspaceId, section)
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(documentRef)
    const category = snapshot.data()?.categories?.[categoryId]
    if (!category?.enabled) {
      throw new Error(`Only simple ${definition.singular} categories can be edited directly`)
    }

    const manualValue = normalizeNonNegativeMoney(value)
    if (manualValue === null) throw new Error('A non-negative numeric value is required')

    const updatedCategory = { ...category, manualValue }
    transaction.update(documentRef, {
      [`categories.${categoryId}`]: updatedCategory,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    })
    return updatedCategory
  })
}

export async function updateSimplePositionOwnership(
  workspaceId,
  section,
  categoryId,
  ownership,
  memberIds,
) {
  const definition = definitionFor(section)
  assertPositionOwnership(ownership, memberIds)
  const userId = currentUserId()
  const documentRef = modelConfigRef(workspaceId, section)
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(documentRef)
    const category = snapshot.data()?.categories?.[categoryId]
    if (!category?.enabled) {
      throw new Error(`Only simple ${definition.singular} category ownership can be edited`)
    }

    const updatedCategory = { ...category, ownership: cloneOwnership(ownership) }
    transaction.update(documentRef, {
      [`categories.${categoryId}`]: updatedCategory,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    })
    return updatedCategory
  })
}

export function assertPositionOwnership(ownership, memberIds) {
  if (!isValidOwnership(ownership, memberIds)) {
    throw new Error('Ownership must reference workspace members and add up to 100%')
  }
}

function definitionFor(section) {
  const definition = definitions[section]
  if (!definition) throw new Error('A valid position section is required')
  return definition
}
