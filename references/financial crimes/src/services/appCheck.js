import { Capacitor } from '@capacitor/core'
import { FirebaseAppCheck } from '@capacitor-firebase/app-check'
import { CustomProvider, initializeAppCheck as initializeWebAppCheck } from 'firebase/app-check'

import { app } from '@/firebase/firebase'

let initializePromise = null

// Quasar exposes QUASAR_DEV at compile time. Development builds use Firebase's
// Android debug provider automatically; production builds keep Play Integrity.
const useDebugProvider = import.meta.env.QUASAR_DEV

export async function initializeAppCheck() {
  if (!Capacitor.isNativePlatform()) return
  if (initializePromise) return initializePromise

  initializePromise = (async () => {
    await FirebaseAppCheck.initialize({
      debugToken: useDebugProvider,
      isTokenAutoRefreshEnabled: true,
    })

    const provider = new CustomProvider({
      getToken: async () => {
        const result = await FirebaseAppCheck.getToken({
          forceRefresh: false,
        })

        if (!result.token || typeof result.expireTimeMillis !== 'number') {
          throw new Error('Native Firebase App Check returned an invalid token.')
        }

        return {
          token: result.token,
          expireTimeMillis: result.expireTimeMillis,
        }
      },
    })

    initializeWebAppCheck(app, {
      provider,
      isTokenAutoRefreshEnabled: true,
    })
  })().catch((error) => {
    initializePromise = null

    if (import.meta.env.QUASAR_DEV) {
      console.error('Firebase App Check initialization failed:', error)
    }

    throw error
  })

  return initializePromise
}
