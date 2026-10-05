import { initializeAppCheck } from '@/services/appCheck'

let appCheckPromise = null
let authPromise = null

export function startAppCheckConfiguration() {
  if (appCheckPromise) return appCheckPromise

  const attempt = initializeAppCheck()
  appCheckPromise = attempt.catch((error) => {
    appCheckPromise = null
    throw error
  })
  return appCheckPromise
}

export function ensureRemoteAuthReady() {
  if (authPromise) return authPromise

  const attempt = (async () => {
    await startAppCheckConfiguration()
    const { initializeAnonymousAuth } = await import('@/services/auth')
    return initializeAnonymousAuth()
  })()

  authPromise = attempt.catch((error) => {
    authPromise = null
    throw error
  })
  return authPromise
}
