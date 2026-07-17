const mongoose = require('mongoose');

// SECURITY: This model holds government ID data. It must never be populated into
// any applicant-facing API response — only admin routes (protected by
// requireRole('admin')) may read it. See server/src/routes/adminTutorApplications.js.
const tutorVerificationSchema = new mongoose.Schema({
  application_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TutorApplication',
    required: true,
    unique: true,
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  government_id_type: {
    type: String,
    enum: ['citizenship', 'passport', 'driving_license', 'national_id'],
  },
  government_id_number: String,
  id_front_document_id: { type: mongoose.Schema.Types.ObjectId, ref: 'TutorDocuments' },
  id_back_document_id: { type: mongoose.Schema.Types.ObjectId, ref: 'TutorDocuments' },
  selfie_document_id: { type: mongoose.Schema.Types.ObjectId, ref: 'TutorDocuments' },
  live_face_verification_requested: {
    type: Boolean,
    default: false,
  },
  live_face_verification_status: {
    type: String,
    enum: ['not_requested', 'pending', 'passed', 'failed'],
    default: 'not_requested',
  },
  identity_verified: {
    type: Boolean,
    default: false,
  },
  identity_verified_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  identity_verified_at: Date,
}, { timestamps: true });

module.exports = mongoose.model('TutorVerification', tutorVerificationSchema);
