const { createHash } = require('node:crypto')
const { FieldValue } = require('firebase-admin/firestore')
const { onCall, HttpsError } = require('firebase-functions/v2/https')
const logger = require('firebase-functions/logger')
const { google } = require('googleapis')
const {
  ensureAiCredits,
  normalizeCreditBalance,
  normalizeNonNegativeInteger,
} = require('./credits')
const { requireAuth } = require('./auth')
const { firestore } = require('./firebase')
const { consumeVerifiedPurchase } = require('./purchaseFinalization')

const AI_CREDIT_PRODUCTS = new Map([
  ['ai_credits_10', { credits: 10, unlimited: false }],
  ['ai_credits_50', { credits: 50, unlimited: false }],
  ['ai_unlimited', { credits: 0, unlimited: true }],
])
const ANDROID_PACKAGE_NAME = 'com.offbeatstudio.financialcrimes'

const redeemAiCreditPurchase = onCall({ enforceAppCheck: true }, async (request) => {
  const auth = requireAuth(request)
  const productId = String(request.data?.productId || '')
  const purchaseToken = String(request.data?.purchaseToken || '')
  const product = AI_CREDIT_PRODUCTS.get(productId)

  if (!product || !purchaseToken || purchaseToken.length > 4096) {
    throw new HttpsError('invalid-argument', 'A valid AI credit purchase is required.')
  }

  await ensureAiCredits(auth.uid)

  let purchase
  try {
    const publisher = await getAndroidPublisher()
    const response = await publisher.purchases.products.get({
      packageName: ANDROID_PACKAGE_NAME,
      productId,
      token: purchaseToken,
    })
    purchase = response.data
  } catch (error) {
    logger.error('AI_PURCHASE_VERIFICATION_FAILED', {
      productId,
      status: error?.code || null,
    })
    throw new HttpsError('unavailable', 'Purchase verification is temporarily unavailable.', {
      reason: 'PURCHASE_VERIFICATION_FAILED',
    })
  }

  const expectedAccountId = hashValue(auth.uid)
  if (
    purchase.purchaseState !== 0 ||
    (purchase.productId && purchase.productId !== productId) ||
    purchase.obfuscatedExternalAccountId !== expectedAccountId
  ) {
    throw new HttpsError('failed-precondition', 'The purchase is not valid for this account.', {
      reason: purchase.purchaseState === 2 ? 'PURCHASE_PENDING' : 'PURCHASE_INVALID',
    })
  }

  const purchaseRef = firestore.collection('aiPurchases').doc(hashValue(purchaseToken))
  const userRef = firestore.collection('aiUsers').doc(auth.uid)
  let result

  await firestore.runTransaction(async (transaction) => {
    const [purchaseSnapshot, userSnapshot] = await Promise.all([
      transaction.get(purchaseRef),
      transaction.get(userRef),
    ])
    if (!userSnapshot.exists) throw new HttpsError('not-found', 'AI credit account not found.')

    const userData = userSnapshot.data() || {}
    const credits = normalizeCreditBalance(userData.credits)
    if (purchaseSnapshot.exists) {
      if (purchaseSnapshot.data()?.uid !== auth.uid) {
        throw new HttpsError('permission-denied', 'This purchase belongs to another account.')
      }
      result = {
        credits,
        creditsGranted: 0,
        unlimited: userData.unlimited === true,
        alreadyRedeemed: true,
      }
      return
    }

    if (purchase.consumptionState === 1) {
      throw new HttpsError('failed-precondition', 'This purchase was already consumed.', {
        reason: 'PURCHASE_ALREADY_CONSUMED',
      })
    }

    const creditsToGrant = product.credits
    const newBalance = credits + creditsToGrant
    const userUpdate = product.unlimited
      ? {
          unlimited: true,
          unlimitedProductId: productId,
          unlimitedPurchasedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }
      : {
          credits: newBalance,
          totalPurchasedCreditsGranted:
            normalizeNonNegativeInteger(userData.totalPurchasedCreditsGranted) + creditsToGrant,
          updatedAt: FieldValue.serverTimestamp(),
        }

    transaction.update(userRef, userUpdate)
    transaction.create(purchaseRef, {
      uid: auth.uid,
      productId,
      creditsGranted: creditsToGrant,
      unlimitedGranted: product.unlimited,
      processed: true,
      consumed: false,
      orderId: purchase.orderId || null,
      purchasedAt: purchase.purchaseTimeMillis
        ? new Date(Number(purchase.purchaseTimeMillis))
        : FieldValue.serverTimestamp(),
      processedAt: FieldValue.serverTimestamp(),
    })
    result = {
      credits: newBalance,
      creditsGranted: creditsToGrant,
      unlimited: product.unlimited || userData.unlimited === true,
      alreadyRedeemed: false,
    }
  })

  try {
    const publisher = await getAndroidPublisher()
    await consumeVerifiedPurchase({
      publisher,
      packageName: ANDROID_PACKAGE_NAME,
      productId,
      purchaseToken,
    })
    await purchaseRef.update({ consumed: true, consumedAt: FieldValue.serverTimestamp() })
  } catch (error) {
    if ([409, 410].includes(Number(error?.code))) {
      await purchaseRef.update({ consumed: true, consumedAt: FieldValue.serverTimestamp() })
    } else {
      logger.warn('AI_PURCHASE_FINALIZATION_RETRY_REQUIRED', { productId })
      throw new HttpsError('unavailable', 'Purchase delivery will be retried.', {
        reason: 'PURCHASE_RETRY_REQUIRED',
        credits: result.credits,
      })
    }
  }

  logger.info(result.alreadyRedeemed ? 'AI_PURCHASE_ALREADY_REDEEMED' : 'AI_PURCHASE_GRANTED', {
    productId,
    creditsGranted: result.creditsGranted,
    creditsRemaining: result.credits,
    unlimited: result.unlimited,
  })
  return result
})

async function getAndroidPublisher() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  })
  return google.androidpublisher({ version: 'v3', auth: await auth.getClient() })
}

function hashValue(value) {
  return createHash('sha256').update(value).digest('hex')
}

module.exports = { redeemAiCreditPurchase }
