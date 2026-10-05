const { onCall, HttpsError } = require('firebase-functions/v2/https')
const logger = require('firebase-functions/logger')

const reportAiResponse = onCall({ enforceAppCheck: true }, async (request) => {
  const responseType = String(request.data?.responseType || '').trim()
  const reason = String(request.data?.reason || '').trim()
  const details = String(request.data?.details || '').trim()
  const allowedResponseTypes = ['roast', 'verdict', 'other']
  const allowedReasons = ['offensive', 'harmful', 'misleading', 'other']

  if (!allowedResponseTypes.includes(responseType) || !allowedReasons.includes(reason)) {
    throw new HttpsError('invalid-argument', 'A valid response type and reason are required.')
  }

  if (details.length > 1000) {
    throw new HttpsError('invalid-argument', 'Report details must not exceed 1000 characters.')
  }

  logger.warn('AI response reported', {
    responseType,
    reason,
    details: details || null,
    appId: request.app?.appId ?? null,
  })

  return { reported: true }
})

module.exports = { reportAiResponse }
