const mongoose = require('mongoose');

// One row per successful login, with the country resolved from the request
// IP (offline geoip-lite lookup, no external calls). Backs the "multiple
// countries in a short period" / impossible-travel detector in
// services/securityMonitor.js. TTL auto-expires after 24h — only recent
// login geography matters for this check.
const loginLocationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  ip: { type: String, required: true },
  country: { type: String, default: null }, // ISO country code, or null if unresolvable (e.g. localhost/private IP)
  occurred_at: { type: Date, default: Date.now, expires: 86400 }, // TTL: 24 hours
});

module.exports = mongoose.model('LoginLocation', loginLocationSchema);
