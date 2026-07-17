const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  // Required for local (password) accounts; absent for Google-only accounts.
  password_hash: {
    type: String,
    required: function () { return !this.google_id; },
  },
  // Set once a Google sign-in creates or links this account. Sparse+unique so multiple
  // local-only accounts (no google_id at all) don't collide on the index. Deliberately no
  // `default: null` — a sparse index only skips documents where the field is ABSENT, not
  // documents where it's explicitly null, so a default of null defeats the sparse behavior
  // and makes every second local signup fail with a duplicate-key error.
  google_id: {
    type: String,
    unique: true,
    sparse: true,
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

