const mongoose = require('mongoose');

// SECURITY: Tamper-evident audit log with SHA-256 hash chaining.
//
// PROBLEM: A flat log file or unlinked DB collection can be silently edited.
// An attacker with DB write access could delete their login attempts or admin actions.
//
// SOLUTION: Each log entry stores a SHA-256 hash of:
//   (previous_hash + sequence + timestamp + userId + role + action + resource + resourceId + status + JSON(metadata))
// This creates a linked chain. If any past entry is modified or deleted,
// all subsequent hashes become invalid — detected by running verifyChain().
//
// This is the same principle used in blockchain and certificate transparency logs.
// OWASP A09:2021 – Security Logging and Monitoring Failures.
const auditLogSchema = new mongoose.Schema({
  sequence: {
    type: Number,
    required: true,
    unique: true,
    index: true,
  },
  // Which hash formula this entry was written with. Entries created before
  // role/resource/resourceId/status existed are version 1 (missing this
  // field reads as 1 — see logger.js's verifyAuditChain); new entries are
  // version 2. NEVER change what version N's hash formula covers once any
  // version-N entry has been written — that retroactively "breaks" every
  // existing entry of that version. Add a new version number instead.
  schemaVersion: {
    type: Number,
    default: 2,
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },
  // The user's role AT THE TIME of the action (not looked up later — a
  // promoted/demoted user shouldn't rewrite history). Null for anonymous
  // actions (e.g. an unauthenticated login attempt).
  role: {
    type: String,
    enum: ['learner', 'tutor', 'both', 'admin', null],
    default: null,
  },
  action: {
    type: String,
    required: true,
    index: true,
  },
  // The kind of thing acted on — e.g. 'User', 'Booking', 'Listing',
  // 'TutorApplication'. Null for actions with no single target resource.
  resource: {
    type: String,
    default: null,
  },
  // The specific document affected. Mixed (not a strict ObjectId ref) since
  // resourceId can point at any of several different collections depending
  // on `resource`, and some actions (e.g. logout) have none.
  resourceId: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
    index: true,
  },
  status: {
    type: String,
    enum: ['success', 'failure'],
    required: true,
    default: 'success',
  },
  // Named `ip`, not `ipAddress`, in the persisted schema — see logger.js's
  // writeTamperEvidentLogEntry for why call sites still pass `ipAddress`.
  ip: String,
  userAgent: String,
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  // SHA-256( previous_hash + sequence + timestamp + userId + role + action + resource + resourceId + status + JSON(metadata) )
  hash: {
    type: String,
    required: true,
  },
  // Hash of the immediately preceding AuditLog entry (genesis entry uses '0'.repeat(64))
  previous_hash: {
    type: String,
    required: true,
  },
}, { timestamps: false });

// Prevent any modification of committed log entries
auditLogSchema.pre('findOneAndUpdate', function () {
  throw new Error('AuditLog entries are immutable');
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
