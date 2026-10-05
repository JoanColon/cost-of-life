const { HttpsError } = require('firebase-functions/v2/https')

function requireAuth(request) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication is required.')
  }

  return request.auth
}

module.exports = { requireAuth }
