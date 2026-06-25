const mongoose = require('mongoose');

// SECURITY: Tamper-evident audit log with SHA-256 hash chaining.
//
// PROBLEM: A flat log file or unlinked DB collection can be silently edited.
// An attacker with DB write access could delete their login attempts or admin actions.
//
// SOLUTION: Each log entry stores a SHA-256 hash of:
//   (previous_hash + timestamp + userId + action + metadata)
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
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  action: {
    type: String,
    required: true,
  },
  ipAddress: String,
  userAgent: String,
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  // SHA-256( previous_hash + sequence + timestamp + userId + action + JSON(metadata) )
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
