const mongoose = require('mongoose');

const APPLICATION_STATUSES = [
  'draft',
  'submitted',
  'pending_review',
  'under_review',
  'needs_more_info',
  'approved',
  'rejected',
  'suspended',
];

// Statuses in which the applicant may no longer edit the application.
const LOCKED_STATUSES = ['submitted', 'pending_review', 'under_review', 'approved', 'rejected', 'suspended'];

const tutorApplicationSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: APPLICATION_STATUSES,
    default: 'draft',
  },
  // Slug of the last step the applicant saved — drives wizard resume.
  current_step: {
    type: String,
    default: 'personal-info',
  },
  personal_info: {
    full_name: String,
    display_name: String,
    profile_photo_document_id: { type: mongoose.Schema.Types.ObjectId, ref: 'TutorDocuments' },
    cover_photo_document_id: { type: mongoose.Schema.Types.ObjectId, ref: 'TutorDocuments' },
    date_of_birth: Date,
    gender: String,
    phone_number: String,
    country: String,
    province_state: String,
    district: String,
    city: String,
    full_address: String,
    nationality: String,
    languages_spoken: { type: [String], default: [] },
  },
  // Step 4 — Teaching Profile
  professional_headline: String,
  bio: {
    type: String,
    maxLength: 2000,
  },
  // Step 7 — Verification Questions (long-form). teaching_philosophy lives here,
  // not as a separate top-level field — it IS "Describe your teaching philosophy".
  verification_answers: {
    why_teach: String,
    teaching_philosophy: String,
    how_help_beginners: String,
    keep_students_engaged: String,
    what_makes_different: String,
  },
  verification_id: { type: mongoose.Schema.Types.ObjectId, ref: 'TutorVerification' },
  education_id: { type: mongoose.Schema.Types.ObjectId, ref: 'TutorEducation' },
  experience_id: { type: mongoose.Schema.Types.ObjectId, ref: 'TutorExperience' },
  skills_id: { type: mongoose.Schema.Types.ObjectId, ref: 'TutorSkills' },
  // Teaching proof — at least one populated field required at submit time.
  teaching_proof: {
    demo_video_youtube_url: String,
    portfolio_url: String,
    testimonials: String,
    research_papers_url: String,
    articles_url: String,
    previous_teaching_experience: String,
    projects_url: String,
    github_repository_url: String,
    case_studies_url: String,
    document_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TutorDocuments' }],
  },
  // Weekly availability intent captured during application — embedded (small, bounded,
  // always read with the parent). Distinct from the live User.availability_days used by
  // the Tutor Dashboard once approved.
  availability: {
    type: [{
      day: { type: String, enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
      start_time: String,
      end_time: String,
    }],
    default: [],
  },
  timezone: String,
  agreement: {
    info_accurate: { type: Boolean, default: false },
    false_info_understood: { type: Boolean, default: false },
    terms_accepted: { type: Boolean, default: false },
    privacy_policy_accepted: { type: Boolean, default: false },
    signature_name: String,
    signature_date: Date,
  },
  featured: {
    type: Boolean,
    default: false,
  },
  reviewed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewed_at: Date,
  rejection_reason: String,
  submitted_at: Date,
}, { timestamps: true });

// SECURITY: prevents a user from having more than one application "in flight" at a time.
// Rejected/suspended applications don't block reapplication; approved ones shouldn't need to.
tutorApplicationSchema.index(
  { user_id: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['draft', 'submitted', 'pending_review', 'under_review', 'needs_more_info'] } } }
);

tutorApplicationSchema.methods.isEditable = function () {
  return !LOCKED_STATUSES.includes(this.status) || this.status === 'needs_more_info';
};

module.exports = mongoose.model('TutorApplication', tutorApplicationSchema);
module.exports.APPLICATION_STATUSES = APPLICATION_STATUSES;
module.exports.LOCKED_STATUSES = LOCKED_STATUSES;
