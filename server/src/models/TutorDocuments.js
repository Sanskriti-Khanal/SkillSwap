const mongoose = require('mongoose');

// Generic file-reference rows for every document uploaded across the tutor
// application wizard (identity, education, experience, teaching proof).
// storage_key holds the Cloudinary public_id of a type:'private' asset — never a
// public delivery URL. See server/src/config/storage.js for how objects are read
// back (signed, short-lived download URLs only).
const tutorDocumentsSchema = new mongoose.Schema({
  application_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TutorApplication',
    required: true,
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  category: {
    type: String,
    enum: [
      'profile_photo', 'cover_photo',
      'id_front', 'id_back', 'selfie',
      'certificate', 'transcript',
      'resume', 'portfolio_sample', 'demo_video',
      'other',
    ],
    required: true,
  },
  storage_key: {
    type: String,
    required: true,
  },
  resource_type: {
    type: String,
    enum: ['image', 'video', 'raw'],
    default: 'image',
  },
  format: String,
  original_filename: String,
  mime_type: String,
  size_bytes: Number,
  status: {
    type: String,
    enum: ['uploaded', 'verified', 'rejected'],
    default: 'uploaded',
  },
  rejection_reason: String,
  uploaded_at: {
    type: Date,
    default: Date.now,
  },
});

tutorDocumentsSchema.index({ application_id: 1, category: 1 });

module.exports = mongoose.model('TutorDocuments', tutorDocumentsSchema);
