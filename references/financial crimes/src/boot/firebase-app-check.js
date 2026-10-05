import { defineBoot } from '#q-app'
import { startAppCheckConfiguration } from '@/services/remoteReadiness'

export default defineBoot(() => {
  // Start provider configuration at the earliest opportunity, but never hold Vue mounting open.
  // Every protected Firebase call awaits the same shared promise before making its request.
  startAppCheckConfiguration().catch((error) => {
    if (import.meta.env.DEV) {
      console.error('Firebase App Check configuration failed:', error)
    }
  })
})
