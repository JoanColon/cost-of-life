import { FirebaseAnalytics } from '@capacitor-firebase/analytics'

export async function logAnalyticsEvent(name, params = {}) {
  try {
    await FirebaseAnalytics.logEvent({
      name,
      params,
    })
  } catch {
    // Analytics should never interrupt the app experience.
  }
}
