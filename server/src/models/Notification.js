const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: [
      'application_submitted', 'application_received', 'application_under_review',
      'more_documents_requested', 'application_approved', 'application_rejected',
      'tutor_account_activated', 'admin_note', 'general',
    ],
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  related_application_id: { type: mongoose.Schema.Types.ObjectId, ref: 'TutorApplication' },
  read: {
    type: Boolean,
    default: false,
  },
  read_at: Date,
}, { timestamps: true });

notificationSchema.index({ user_id: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
