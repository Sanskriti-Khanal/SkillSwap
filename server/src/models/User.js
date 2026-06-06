const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password_hash: {
    type: String,
    required: true,
  },
  mfa_enabled: {
    type: Boolean,
    default: false,
  },
  mfa_secret: {
    type: String,
    default: null,
  },
  password_changed_at: {
    type: Date,
    default: Date.now,
  },
  failed_attempts: {
    type: Number,
    default: 0,
  },
  locked_until: {
    type: Date,
  },
  role: {
    type: String,
    enum: ['learner', 'tutor', 'both', 'admin'],
    default: 'learner',
  },
  bio: {
    type: String,
    maxLength: 500,
  },
  skills: {
    type: [String],
    default: [],
  },
  hourly_rate: {
    type: Number,
    min: 0,
  },
  availability_days: {
    type: [String],
    default: [],
  },
  profile_photo_url: {
    type: String,
  }
}, { timestamps: true });


module.exports = mongoose.model('User', userSchema);

