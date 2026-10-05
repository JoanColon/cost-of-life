import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases'
import { Capacitor } from '@capacitor/core'

import { auth } from '@/services/auth'
import { redeemAiCreditPurchase } from '@/services/functions'
import { ensureRemoteAuthReady } from '@/services/remoteReadiness'

export const AI_CREDIT_PACKS = [
  { productId: 'ai_credits_10', credits: 10 },
  { productId: 'ai_credits_50', credits: 50 },
  { productId: 'ai_unlimited', unlimited: true },
]

const AI_CREDIT_PRODUCT_IDS = new Set(AI_CREDIT_PACKS.map(({ productId }) => productId))

export async function loadAiCreditProducts() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return []
  const { isBillingSupported } = await NativePurchases.isBillingSupported()
  if (!isBillingSupported) return []
  const { products } = await NativePurchases.getProducts({
    productIdentifiers: AI_CREDIT_PACKS.map(({ productId }) => productId),
    productType: PURCHASE_TYPE.INAPP,
  })
  return AI_CREDIT_PACKS.map((pack) => {
    const product = products.find(({ identifier }) => identifier === pack.productId)
    return product ? { ...pack, product } : null
  }).filter(Boolean)
}

export async function purchaseAiCredits(productId) {
  if (!AI_CREDIT_PRODUCT_IDS.has(productId)) throw new Error('Unknown AI credit product.')
  await ensureRemoteAuthReady()
  const appAccountToken = await getObfuscatedAccountId()
  const purchase = await NativePurchases.purchaseProduct({
    productIdentifier: productId,
    productType: PURCHASE_TYPE.INAPP,
    quantity: 1,
    // The backend verifies, grants, and consumes the purchase. Setting this to true would make
    // the native plugin race the backend by consuming the token before verification completes.
    isConsumable: false,
    autoAcknowledgePurchases: false,
    appAccountToken,
  })

  if (purchase.purchaseState !== '1') {
    return { pending: true, credits: null, creditsGranted: 0 }
  }
  return redeemPurchase(purchase)
}

export async function recoverAiCreditPurchases() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return null
  await ensureRemoteAuthReady()
  const appAccountToken = await getObfuscatedAccountId()
  const { purchases } = await NativePurchases.getPurchases({
    productType: PURCHASE_TYPE.INAPP,
    appAccountToken,
  })
  let latestResult = null
  for (const purchase of purchases) {
    if (
      AI_CREDIT_PRODUCT_IDS.has(purchase.productIdentifier) &&
      purchase.purchaseToken &&
      purchase.purchaseState === '1'
    ) {
      latestResult = await redeemPurchase(purchase)
    }
  }
  return latestResult
}

async function redeemPurchase(purchase) {
  if (!purchase.purchaseToken) throw new Error('Google Play did not return a purchase token.')
  return redeemAiCreditPurchase({
    productId: purchase.productIdentifier,
    purchaseToken: purchase.purchaseToken,
  })
}

async function getObfuscatedAccountId() {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Anonymous authentication is not ready.')
  const encoded = new TextEncoder().encode(uid)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
