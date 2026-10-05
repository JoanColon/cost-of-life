import { nextTick } from 'vue'
import { toPng } from 'html-to-image'
import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

const exportSize = {
  width: 1080,
  height: 1350,
}

export async function nodeToPngBlob(node, options = {}) {
  await nextTick()
  await nextFrame()
  await waitForExportAssets(node)

  const dataUrl = await toPng(node, {
    width: exportSize.width,
    height: exportSize.height,
    canvasWidth: exportSize.width,
    canvasHeight: exportSize.height,
    pixelRatio: 1,
    cacheBust: true,
    backgroundColor: 'transparent',
    ...options,
  })

  return dataUrlToBlob(dataUrl)
}

async function waitForExportAssets(node) {
  if (!node) {
    throw new Error('Share card is not available.')
  }

  if (document.fonts?.ready) {
    await document.fonts.ready
  }

  const images = Array.from(node.querySelectorAll('img'))
  await Promise.all(images.map(waitForImage))
}

export async function shareImageBlob({ blob, fileName, title, text }) {
  try {
    if (await shareImageWithCapacitor({ blob, fileName, title, text })) {
      return 'shared'
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw error
    }
  }

  const file = new File([blob], fileName, { type: blob.type })

  try {
    if (await shareImageFile({ file, title, text })) {
      return 'shared'
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw error
    }
  }

  try {
    await copyImageToClipboard(blob)
    return 'copied'
  } catch {
    downloadBlob(blob, fileName)
    return 'downloaded'
  }
}

async function shareImageWithCapacitor({ blob, fileName, title, text }) {
  if (!Capacitor.isNativePlatform()) return false

  const canShare = await Share.canShare()
  if (!canShare.value) return false

  const path = `share/${fileName}`
  await Filesystem.writeFile({
    path,
    data: await blobToBase64(blob),
    directory: Directory.Cache,
    recursive: true,
  })

  const { uri } = await Filesystem.getUri({
    path,
    directory: Directory.Cache,
  })

  await Share.share({
    title,
    text,
    files: [uri],
    dialogTitle: title,
  })

  return true
}

async function shareImageFile({ file, title, text }) {
  if (typeof navigator === 'undefined' || !navigator.share) return false
  if (navigator.canShare && !navigator.canShare({ files: [file] })) return false

  await navigator.share({ title, text, files: [file] })
  return true
}

async function copyImageToClipboard(blob) {
  if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
    throw new Error('Image clipboard is not available.')
  }

  await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function nextFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

function waitForImage(image) {
  if (image.complete && image.naturalWidth > 0) {
    return image.decode ? image.decode().catch(() => {}) : Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    image.addEventListener('load', () => resolve(), { once: true })
    image.addEventListener('error', () => reject(new Error('Unable to load share card image.')), {
      once: true,
    })
  })
}

async function dataUrlToBlob(dataUrl) {
  const response = await fetch(dataUrl)
  return response.blob()
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      const result = String(reader.result || '')
      resolve(result.includes(',') ? result.split(',')[1] : result)
    })
    reader.addEventListener('error', () => reject(reader.error))
    reader.readAsDataURL(blob)
  })
}
