import { InAppReview } from '@capacitor-community/in-app-review'
import { Capacitor } from '@capacitor/core'

const monthlyVerdictReviewKey = 'financial-crimes:monthly-verdict-review-requested'

let requestedThisSession = false
let requestInFlight = false

export async function requestMonthlyVerdictReview() {
  if (!isEligibleForNativeReview() || requestInFlight) return false

  requestInFlight = true

  try {
    await InAppReview.requestReview()
    requestedThisSession = true
    markReviewRequested()
    return true
  } catch (error) {
    console.warn('Unable to request the native in-app review:', error)
    return false
  } finally {
    requestInFlight = false
  }
}

function isEligibleForNativeReview() {
  return (
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === 'android' &&
    !requestedThisSession &&
    !wasReviewRequested()
  )
}

function wasReviewRequested() {
  try {
    return window.localStorage.getItem(monthlyVerdictReviewKey) !== null
  } catch {
    return false
  }
}

function markReviewRequested() {
  try {
    window.localStorage.setItem(monthlyVerdictReviewKey, new Date().toISOString())
  } catch {
    // The in-memory guard still prevents repeated requests during this session.
  }
}
