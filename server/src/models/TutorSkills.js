const mongoose = require('mongoose');

const tutorSkillsSchema = new mongoose.Schema({
  application_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TutorApplication',
    required: true,
    unique: true,
  },
  primary_category: {
    type: String,
    enum: [
      'programming', 'design', 'music', 'photography', 'language', 'business',
      'marketing', 'fitness', 'cooking', 'art', 'academic_subjects', 'technology', 'other',
    ],
  },
  sub_skills: {
    type: [String],
    default: [],
  },
  teaching_experience_years: Number,
  teaching_level: {
    type: [String],
    enum: ['beginner', 'intermediate', 'advanced', 'professional'],
    default: [],
  },
  teaching_languages: {
    type: [String],
    default: [],
  },
  teaching_mode: {
    type: String,
    enum: ['online', 'offline', 'both'],
  },
  teaching_location: String,
  hourly_rate: {
    type: Number,
    min: 0,
  },
  currency: {
    type: String,
    default: 'NPR',
  },
  max_students: {
    type: Number,
    min: 1,
  },
  timezone: String,
}, { timestamps: true });

module.exports = mongoose.model('TutorSkills', tutorSkillsSchema);
