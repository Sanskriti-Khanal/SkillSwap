const mongoose = require('mongoose');

const loginAttemptSchema = new mongoose.Schema({
  ip: { type: String, required: true, index: true },
  attempted_at: { type: Date, default: Date.now, expires: 600 }, // TTL: auto-delete after 10 minutes
});

module.exports = mongoose.model('LoginAttempt', loginAttemptSchema);
