import { Capacitor } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'
import { nextTick } from 'vue'

const splashWatchdogDuration = 10000
let splashHidden = false
let hidePromise = null
let watchdogId = null

export function installSplashWatchdog() {
  if (!Capacitor.isNativePlatform() || splashHidden || watchdogId !== null) return

  watchdogId = window.setTimeout(() => {
    watchdogId = null
    hideNativeSplash().catch(() => {
      // A later readiness signal can retry if the native bridge was temporarily unavailable.
    })
  }, splashWatchdogDuration)
}

export async function hideNativeSplashWhenReady() {
  await nextTick()
  await nextPaint()
  return hideNativeSplash()
}

export function hideNativeSplash() {
  if (!Capacitor.isNativePlatform() || splashHidden) return Promise.resolve()
  if (hidePromise) return hidePromise

  clearWatchdog()
  hidePromise = SplashScreen.hide()
    .then(() => {
      splashHidden = true
    })
    .catch((error) => {
      hidePromise = null
      installSplashWatchdog()
      throw error
    })

  return hidePromise
}

function nextPaint() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(resolve)
    })
  })
}

function clearWatchdog() {
  if (watchdogId === null) return
  window.clearTimeout(watchdogId)
  watchdogId = null
}
