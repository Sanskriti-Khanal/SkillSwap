const mongoose = require('mongoose');

// SECURITY: Server-side refresh token revocation list.
// Problem: JWT refresh tokens are stateless — clearing the cookie on logout does not
// prevent an attacker who copied the token from replaying it within its 7-day lifetime.
// Fix: on logout (or password change) the token's JTI (unique ID) is stored here.
// The /refresh endpoint rejects any token whose JTI is in this collection.
// TTL index auto-expires entries after 7 days (matching token lifetime) to keep the
// collection small. OWASP A07:2021 – Identification and Authentication Failures.
const revokedTokenSchema = new mongoose.Schema({
  jti: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  expires_at: {
    type: Date,
    required: true,
  },
});

// Auto-delete documents when expires_at is reached — mirrors token lifetime
revokedTokenSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RevokedToken', revokedTokenSchema);
