const mongoose = require('mongoose');

const tutorExperienceSchema = new mongoose.Schema({
  application_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TutorApplication',
    required: true,
    unique: true,
  },
  employment_status: {
    type: String,
    enum: ['employed', 'self_employed', 'freelance', 'unemployed', 'student'],
  },
  current_company: String,
  current_title: String,
  years_of_teaching_experience: Number,
  years_of_professional_experience: Number,
  resume_document_id: { type: mongoose.Schema.Types.ObjectId, ref: 'TutorDocuments' },
  portfolio_links: {
    website: String,
    github: String,
    linkedin: String,
    behance: String,
    dribbble: String,
  },
  portfolio_document_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TutorDocuments' }],
  experience_verified: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

module.exports = mongoose.model('TutorExperience', tutorExperienceSchema);
