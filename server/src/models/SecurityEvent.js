const mongoose = require('mongoose');

// Lightweight, high-volume "tick" collection backing the generic threshold
// detectors in services/securityMonitor.js (repeated access-denied, excessive
// password-reset requests). One document per occurrence; TTL auto-expires
// after 1 hour so this never grows unbounded — mirrors the existing
// LoginAttempt model's TTL pattern. Deliberately generic (a `type` field)
// rather than one collection per detector, so adding a new threshold-based
// detector never means adding a new collection.
const securityEventSchema = new mongoose.Schema({
  type: { type: String, required: true, index: true },
  ip: { type: String, required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  occurred_at: { type: Date, default: Date.now, expires: 3600 }, // TTL: 1 hour
});

module.exports = mongoose.model('SecurityEvent', securityEventSchema);
