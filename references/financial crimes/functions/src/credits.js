const { FieldValue } = require('firebase-admin/firestore')
const { onCall, HttpsError } = require('firebase-functions/v2/https')
const logger = require('firebase-functions/logger')
const { requireAuth } = require('./auth')
const { firestore } = require('./firebase')

const WELCOME_AI_CREDITS = 5
const MONTHLY_AI_CREDITS = 2

const ensureAiUser = onCall({ enforceAppCheck: true }, async (request) => {
  const auth = requireAuth(request)
  return ensureAiCredits(auth.uid)
})

const getAiCredits = onCall({ enforceAppCheck: true }, async (request) => {
  const auth = requireAuth(request)
  return ensureAiCredits(auth.uid)
})

async function ensureAiCredits(uid) {
  const userRef = firestore.collection('aiUsers').doc(uid)
  const currentMonth = getUtcMonthKey(new Date())
  let result

  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(userRef)

    if (!snapshot.exists) {
      result = {
        credits: WELCOME_AI_CREDITS,
        created: true,
        monthlyCreditsGranted: 0,
        unlimited: false,
      }
      transaction.create(userRef, {
        credits: WELCOME_AI_CREDITS,
        unlimited: false,
        welcomeCreditsGranted: true,
        lastMonthlyFreeGrant: currentMonth,
        totalFreeCreditsGranted: WELCOME_AI_CREDITS,
        totalPurchasedCreditsGranted: 0,
        totalCreditsUsed: 0,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
      return
    }

    const data = snapshot.data() || {}
    const currentCredits = normalizeCreditBalance(data.credits)
    const shouldGrantMonthlyCredits = data.lastMonthlyFreeGrant !== currentMonth
    const monthlyCreditsGranted = shouldGrantMonthlyCredits ? MONTHLY_AI_CREDITS : 0
    const credits = currentCredits + monthlyCreditsGranted

    result = {
      credits,
      created: false,
      monthlyCreditsGranted,
      unlimited: data.unlimited === true,
    }

    if (shouldGrantMonthlyCredits) {
      transaction.update(userRef, {
        credits,
        lastMonthlyFreeGrant: currentMonth,
        totalFreeCreditsGranted:
          normalizeNonNegativeInteger(data.totalFreeCreditsGranted) + MONTHLY_AI_CREDITS,
        updatedAt: FieldValue.serverTimestamp(),
      })
    }
  })

  if (result.created) {
    logger.info('AI_USER_CREATED', { credits: result.credits })
  } else if (result.monthlyCreditsGranted) {
    logger.info('MONTHLY_AI_CREDITS_GRANTED', {
      creditsGranted: result.monthlyCreditsGranted,
      creditsRemaining: result.credits,
    })
  }

  return result
}

async function consumeAiCredit(uid, generationType) {
  const userRef = firestore.collection('aiUsers').doc(uid)
  const currentMonth = getUtcMonthKey(new Date())
  let result

  try {
    await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(userRef)
      const data = snapshot.exists ? snapshot.data() || {} : {}
      const monthlyCreditsGranted =
        snapshot.exists && data.lastMonthlyFreeGrant !== currentMonth ? MONTHLY_AI_CREDITS : 0
      const unlimited = data.unlimited === true
      const availableCredits =
        (snapshot.exists ? normalizeCreditBalance(data.credits) : WELCOME_AI_CREDITS) +
        monthlyCreditsGranted

      if (!unlimited && availableCredits <= 0) {
        throw new HttpsError('resource-exhausted', 'No AI credits remain.', {
          reason: 'AI_CREDITS_EXHAUSTED',
          credits: 0,
        })
      }

      const creditsRemaining = unlimited ? availableCredits : availableCredits - 1
      const totalFreeCreditsGranted = snapshot.exists
        ? normalizeNonNegativeInteger(data.totalFreeCreditsGranted) + monthlyCreditsGranted
        : WELCOME_AI_CREDITS
      const totalCreditsUsed = snapshot.exists
        ? normalizeNonNegativeInteger(data.totalCreditsUsed) + 1
        : 1

      if (snapshot.exists) {
        transaction.update(userRef, {
          credits: creditsRemaining,
          lastMonthlyFreeGrant: monthlyCreditsGranted
            ? currentMonth
            : data.lastMonthlyFreeGrant || currentMonth,
          totalFreeCreditsGranted,
          totalCreditsUsed,
          updatedAt: FieldValue.serverTimestamp(),
        })
      } else {
        transaction.create(userRef, {
          credits: creditsRemaining,
          unlimited: false,
          welcomeCreditsGranted: true,
          lastMonthlyFreeGrant: currentMonth,
          totalFreeCreditsGranted,
          totalPurchasedCreditsGranted: 0,
          totalCreditsUsed,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        })
      }

      result = { creditsRemaining, monthlyCreditsGranted, unlimited }
    })
  } catch (error) {
    if (error instanceof HttpsError && error.code === 'resource-exhausted') {
      logger.info('AI_CREDITS_EXHAUSTED', { generationType })
    }
    throw error
  }

  logger.info('AI_CREDIT_CONSUMED', {
    generationType,
    creditsRemaining: result.creditsRemaining,
    unlimited: result.unlimited,
  })
  return result
}

async function refundAiCredit(uid, generationType) {
  const userRef = firestore.collection('aiUsers').doc(uid)

  try {
    let creditsRemaining = 0
    await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(userRef)
      if (!snapshot.exists) throw new Error('AI credit account no longer exists.')

      const data = snapshot.data() || {}
      const unlimited = data.unlimited === true
      creditsRemaining = normalizeCreditBalance(data.credits) + (unlimited ? 0 : 1)
      transaction.update(userRef, {
        credits: creditsRemaining,
        totalCreditsUsed: Math.max(0, normalizeNonNegativeInteger(data.totalCreditsUsed) - 1),
        updatedAt: FieldValue.serverTimestamp(),
      })
    })

    logger.info('AI_CREDIT_REFUNDED', { generationType, creditsRemaining })
  } catch (error) {
    logger.error('AI_CREDIT_REFUND_FAILED', {
      generationType,
      error: error instanceof Error ? error.message : 'Unknown refund error',
    })
  }
}

function getUtcMonthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function normalizeCreditBalance(value) {
  const credits = Number(value)
  return Number.isFinite(credits) && credits >= 0 ? Math.floor(credits) : 0
}

function normalizeNonNegativeInteger(value) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0
}

module.exports = {
  consumeAiCredit,
  ensureAiCredits,
  ensureAiUser,
  getAiCredits,
  normalizeCreditBalance,
  normalizeNonNegativeInteger,
  refundAiCredit,
}
