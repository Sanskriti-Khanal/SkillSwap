const mongoose = require('mongoose');

// SECURITY: only the SHA-256 hash of the reset token is ever stored — the raw token
// exists only in the emailed link and briefly in the requester's memory, mirroring the
// same "never store the secret itself" principle as password_hash. A DB compromise
// alone can't be used to mint valid reset links.
const passwordResetTokenSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  token_hash: {
    type: String,
    required: true,
    unique: true,
  },
  used_at: {
    type: Date,
    default: null,
  },
  expires_at: {
    type: Date,
    required: true,
  },
}, { timestamps: true });

// TTL index — MongoDB automatically deletes documents once expires_at is in the past,
// so spent/expired tokens don't accumulate indefinitely.
passwordResetTokenSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PasswordResetToken', passwordResetTokenSchema);
