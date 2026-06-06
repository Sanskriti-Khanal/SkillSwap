const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema({
  tutor_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
  },
  skill_category: {
    type: String,
    required: true,
  },
  price_per_session: {
    type: Number, // In NPR
    required: true,
    min: 0,
  },
  duration_minutes: {
    type: Number,
    required: true,
    min: 15,
  }
}, { timestamps: true });

module.exports = mongoose.model('Listing', listingSchema);
