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
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
