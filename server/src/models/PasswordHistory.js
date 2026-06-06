const mongoose = require('mongoose');

const passwordHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  password_hash: {
    type: String,
    required: true,
  }
}, { timestamps: true });

module.exports = mongoose.model('PasswordHistory', passwordHistorySchema);
