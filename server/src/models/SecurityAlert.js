const mongoose = require('mongoose');

// SECURITY: Central store for suspicious-activity alerts surfaced on the admin
// dashboard. Distinct from AuditLog: AuditLog is a complete, tamper-evident
// record of "what happened" for every business action; SecurityAlert is a
// much smaller, admin-triaged list of "this pattern looks like an attack" —
// written only when a detector in services/securityMonitor.js decides a
// threshold or known-bad pattern was crossed.
const securityAlertSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: [
      'repeated_failed_logins',
      'repeated_access_denied',
      'jwt_reuse',
      'refresh_token_reuse',
      'excessive_password_reset_requests',
      'excessive_api_requests',
      'multi_country_access',
    ],
    index: true,
  },
  severity: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
  },
  // The account this alert concerns, if known — some alerts (e.g. excessive
  // API requests from an IP before it's ever authenticated) have no user yet.
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },
  ip: {
    type: String,
    default: null,
    index: true,
  },
  userAgent: {
    type: String,
    default: null,
  },
  // Free-form, detector-specific context — e.g. { attempts: 12, windowMinutes: 10 }
  // or { countries: ['NP', 'US'], withinMinutes: 15 }.
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  status: {
    type: String,
    enum: ['open', 'resolved'],
    default: 'open',
    index: true,
  },
  resolved_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  resolved_at: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

// Admin dashboard's default view: newest open alerts first.
securityAlertSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('SecurityAlert', securityAlertSchema);
