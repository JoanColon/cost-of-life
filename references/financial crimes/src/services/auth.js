import { browserLocalPersistence, getAuth, setPersistence, signInAnonymously } from 'firebase/auth'

import { app } from '@/firebase/firebase'

export const auth = getAuth(app)

let initializePromise = null

export function initializeAnonymousAuth() {
  if (initializePromise) return initializePromise

  initializePromise = (async () => {
    await setPersistence(auth, browserLocalPersistence)
    await auth.authStateReady()

    if (auth.currentUser) return auth.currentUser

    const credential = await signInAnonymously(auth)
    return credential.user
  })().catch((error) => {
    initializePromise = null
    throw error
  })

  return initializePromise
}
