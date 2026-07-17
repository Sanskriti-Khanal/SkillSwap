const mongoose = require('mongoose');

// Applicant-facing status-transition timeline — powers the "Track Application
// Status" page. Distinct from AdminReview (internal admin notes/actions) and
// AuditLog (tamper-evident security record).
const applicationHistorySchema = new mongoose.Schema({
  application_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TutorApplication',
    required: true,
  },
  from_status: String,
  to_status: {
    type: String,
    required: true,
  },
  actor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  actor_role: {
    type: String,
    enum: ['applicant', 'admin', 'system'],
    required: true,
  },
  reason: String,
}, { timestamps: true });

applicationHistorySchema.index({ application_id: 1, createdAt: 1 });

module.exports = mongoose.model('ApplicationHistory', applicationHistorySchema);
