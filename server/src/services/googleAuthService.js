const { OAuth2Client } = require('google-auth-library');

let _client = null;

// Lazy-init so the module can load without GOOGLE_CLIENT_ID set (e.g. in tests).
function getClient() {
  if (!_client) {
    if (!process.env.GOOGLE_CLIENT_ID) {
      throw new Error('GOOGLE_CLIENT_ID environment variable is not set');
    }
    _client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }
  return _client;
}

// Verifies a Google ID token's signature, audience, issuer, and expiry against
// Google's public keys. Throws if the token is invalid, expired, or was issued
// for a different client. Returns the decoded payload (sub, email, email_verified, ...).
async function verifyGoogleIdToken(idToken) {
  const ticket = await getClient().verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  return ticket.getPayload();
}

module.exports = { verifyGoogleIdToken };
