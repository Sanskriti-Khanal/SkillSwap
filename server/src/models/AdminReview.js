const mongoose = require('mongoose');

// Product-facing admin review trail (who did what, with what notes) — distinct from
// the hash-chained AuditLog (tamper-evident security record, written via logEvent())
// and from ApplicationHistory (the applicant-facing status timeline). Three separate
// logs for three separate audiences.
const adminReviewSchema = new mongoose.Schema({
  application_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TutorApplication',
    required: true,
  },
  reviewer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  action: {
    type: String,
    enum: [
      'approve', 'reject', 'request_more_info',
      'verify_identity', 'verify_certificates', 'verify_portfolio', 'verify_experience',
      'feature', 'unfeature', 'suspend', 'revoke', 'note', 'notify',
    ],
    required: true,
  },
  notes: String,
  metadata: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

adminReviewSchema.index({ application_id: 1, createdAt: -1 });

module.exports = mongoose.model('AdminReview', adminReviewSchema);
