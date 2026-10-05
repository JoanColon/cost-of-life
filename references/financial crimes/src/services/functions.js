import { getFunctions, httpsCallable } from 'firebase/functions'
import { app } from '@/firebase/firebase'
import { ensureRemoteAuthReady } from '@/services/remoteReadiness'

const functions = getFunctions(app, 'europe-west1')

// Local prompt tuning only:
/* import { connectFunctionsEmulator } from 'firebase/functions'
connectFunctionsEmulator(functions, '127.0.0.1', 5001) */

const ensureAiUserFunction = httpsCallable(functions, 'ensureAiUser')
const getAiCreditsFunction = httpsCallable(functions, 'getAiCredits')
const callRoastFunction = httpsCallable(functions, 'callRoast')
const callVerdictFunction = httpsCallable(functions, 'callVerdict')
const reportAiResponseFunction = httpsCallable(functions, 'reportAiResponse')
const redeemAiCreditPurchaseFunction = httpsCallable(functions, 'redeemAiCreditPurchase')

export async function ensureAiUser() {
  await ensureRemoteAuthReady()
  const result = await ensureAiUserFunction()
  return result.data
}

export async function getAiCredits() {
  await ensureRemoteAuthReady()
  const result = await getAiCreditsFunction()
  return result.data
}

export async function callRoast(payload) {
  await ensureRemoteAuthReady()
  const result = await callRoastFunction(payload)
  return result.data
}

export async function callVerdict(payload) {
  await ensureRemoteAuthReady()
  const result = await callVerdictFunction(payload)
  return result.data
}

export async function reportAiResponse(payload) {
  await ensureRemoteAuthReady()
  const result = await reportAiResponseFunction(payload)
  return result.data
}

export async function redeemAiCreditPurchase(payload) {
  await ensureRemoteAuthReady()
  const result = await redeemAiCreditPurchaseFunction(payload)
  return result.data
}

export function isAiCreditsExhaustedError(error) {
  return (
    error?.code === 'functions/resource-exhausted' &&
    error?.details?.reason === 'AI_CREDITS_EXHAUSTED'
  )
}
