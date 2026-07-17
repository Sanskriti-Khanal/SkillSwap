const mongoose = require('mongoose');

const tutorEducationSchema = new mongoose.Schema({
  application_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TutorApplication',
    required: true,
    unique: true,
  },
  highest_education: {
    type: String,
    enum: ['high_school', 'diploma', 'bachelors', 'masters', 'phd', 'other'],
  },
  institution_name: String,
  field_of_study: String,
  graduation_year: Number,
  currently_enrolled: {
    type: Boolean,
    default: false,
  },
  certifications: {
    type: [{
      name: String,
      issuing_organization: String,
      issue_date: Date,
      expiry_date: Date,
      document_id: { type: mongoose.Schema.Types.ObjectId, ref: 'TutorDocuments' },
    }],
    default: [],
  },
  certificate_document_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TutorDocuments' }],
  transcript_document_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TutorDocuments' }],
}, { timestamps: true });

module.exports = mongoose.model('TutorEducation', tutorEducationSchema);
