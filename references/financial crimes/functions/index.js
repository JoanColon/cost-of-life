const { setGlobalOptions } = require('firebase-functions/v2')

setGlobalOptions({
  region: 'europe-west1',
  maxInstances: 10,
})

const { callRoast, callVerdict } = require('./src/ai')
const { ensureAiUser, getAiCredits } = require('./src/credits')
const { redeemAiCreditPurchase } = require('./src/purchases')
const { reportAiResponse } = require('./src/reports')

exports.ensureAiUser = ensureAiUser
exports.getAiCredits = getAiCredits
exports.redeemAiCreditPurchase = redeemAiCreditPurchase
exports.callRoast = callRoast
exports.callVerdict = callVerdict
exports.reportAiResponse = reportAiResponse
