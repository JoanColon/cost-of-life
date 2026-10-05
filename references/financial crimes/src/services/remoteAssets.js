import { getDownloadURL, getStorage, listAll, ref as storageRef } from 'firebase/storage'

import criminalCardImage from '@/assets/crimialCards/CriminalCard.webp'
import guiltyImage from '@/assets/verdict/Guilty_1.webp'
import notGuiltyImage from '@/assets/verdict/NotGuilty_1.webp'
import probationImage from '@/assets/verdict/Probation_1.webp'
import { crimeCategories } from '@/config/crimeCategories'
import { app } from '@/firebase/firebase'

const assetTimeoutMs = 5_000
const supportedImagePattern = /\.(?:webp|png|jpe?g)$/i
const crimeCategoryIds = new Set(crimeCategories.map((category) => category.id))
const verdictAssets = {
  guilty: {
    folder: 'Verdicts/Guilty',
    fallback: guiltyImage,
  },
  probation: {
    folder: 'Verdicts/Probation',
    fallback: probationImage,
  },
  'not-guilty': {
    folder: 'Verdicts/NotGuilty',
    fallback: notGuiltyImage,
  },
}

const storage = getStorage(app)
const folderItemsCache = new Map()

// Keep remote assets optional even when Firebase is offline or unavailable.
storage.maxOperationRetryTime = assetTimeoutMs

export function getCrimeAsset(categoryId) {
  if (!crimeCategoryIds.has(categoryId)) {
    warnInDevelopment(`Unknown Crime asset category: ${categoryId || 'empty'}`)
    return Promise.resolve(criminalCardImage)
  }

  return resolveAsset(`Crimes/${categoryId}`, criminalCardImage)
}

export function getVerdictAsset(verdictStatus) {
  const assetConfig = verdictAssets[verdictStatus]

  if (!assetConfig) {
    warnInDevelopment(`Unknown Verdict asset status: ${verdictStatus || 'empty'}`)
    return Promise.resolve(probationImage)
  }

  return resolveAsset(assetConfig.folder, assetConfig.fallback)
}

async function resolveAsset(folderPath, localFallback) {
  try {
    const remoteAsset = await withTimeout(selectRemoteAsset(folderPath), assetTimeoutMs)
    return remoteAsset || localFallback
  } catch (error) {
    warnInDevelopment(`Unable to resolve a remote asset from ${folderPath}.`, error)
    return localFallback
  }
}

async function selectRemoteAsset(folderPath) {
  const items = await getFolderItems(folderPath)
  if (!items.length) return null

  const selectedItem = items[Math.floor(Math.random() * items.length)]
  const downloadUrl = await getDownloadURL(selectedItem)
  await preloadImage(downloadUrl)

  return downloadUrl
}

function getFolderItems(folderPath) {
  if (!folderItemsCache.has(folderPath)) {
    const itemsPromise = listAll(storageRef(storage, folderPath)).then((result) =>
      result.items.filter((item) => supportedImagePattern.test(item.name)),
    )

    folderItemsCache.set(folderPath, itemsPromise)
  }

  return folderItemsCache.get(folderPath)
}

function preloadImage(url) {
  if (typeof Image === 'undefined') return Promise.resolve()

  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.addEventListener('load', resolve, { once: true })
    image.addEventListener('error', () => reject(new Error('Remote asset is not a valid image.')), {
      once: true,
    })
    image.src = url
  })
}

function withTimeout(promise, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(`Remote asset request exceeded ${timeoutMs}ms.`))
    }, timeoutMs)

    promise.then(
      (value) => {
        window.clearTimeout(timeoutId)
        resolve(value)
      },
      (error) => {
        window.clearTimeout(timeoutId)
        reject(error)
      },
    )
  })
}

function warnInDevelopment(message, error) {
  if (!import.meta.env.DEV) return

  console.warn(`[Remote assets] ${message}`, error || '')
}
