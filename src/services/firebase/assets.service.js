import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db } from '@/firebase/firebase'

function configRef(workspaceId) {
  return doc(db, 'workspaces', workspaceId, 'financialPosition', 'assetsConfig')
}

function assetsRef(workspaceId) {
  return collection(db, 'workspaces', workspaceId, 'assets')
}

export async function getAssetsState(workspaceId) {
  const [configSnapshot, assetsSnapshot] = await Promise.all([
    getDoc(configRef(workspaceId)),
    getDocs(assetsRef(workspaceId)),
  ])

  return {
    config: configSnapshot.exists() ? configSnapshot.data() : null,
    assets: assetsSnapshot.docs.map((assetDocument) => ({
      id: assetDocument.id,
      ...assetDocument.data(),
    })),
  }
}

export async function saveAssetsSetup(workspaceId, categories, userId) {
  await setDoc(configRef(workspaceId), {
    setupCompleted: true,
    categories,
    createdAt: serverTimestamp(),
    createdBy: userId,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  })
}

export async function updateAssetsCategories(workspaceId, categories, userId) {
  await setDoc(
    configRef(workspaceId),
    {
      setupCompleted: true,
      categories,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    },
    { merge: true },
  )
}

export async function updateAssetCategory(workspaceId, categoryId, category, userId) {
  await updateDoc(configRef(workspaceId), {
    [`categories.${categoryId}`]: {
      ...category,
      updatedAt: serverTimestamp(),
    },
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  })
}

export async function createAsset(workspaceId, asset, userId) {
  const assetRef = await addDoc(assetsRef(workspaceId), {
    ...asset,
    valueSource: 'manual',
    createdAt: serverTimestamp(),
    createdBy: userId,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  })

  return { id: assetRef.id, ...asset, valueSource: 'manual', createdBy: userId, updatedBy: userId }
}

export async function updateAsset(workspaceId, assetId, changes, userId) {
  await updateDoc(doc(assetsRef(workspaceId), assetId), {
    ...changes,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  })
}

export async function removeAsset(workspaceId, assetId) {
  await deleteDoc(doc(assetsRef(workspaceId), assetId))
}
