const mongoose = require('mongoose');

const blockedIPSchema = new mongoose.Schema({
  ip_address: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  reason: {
    type: String,
    required: true,
  },
  blocked_at: {
    type: Date,
    default: Date.now,
  },
  blocked_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }
});

module.exports = mongoose.model('BlockedIP', blockedIPSchema);
