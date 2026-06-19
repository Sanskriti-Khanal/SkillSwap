const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  listing_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Listing',
    required: true,
  },
  tutor_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  learner_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  requested_time: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed', 'refunded'],
    default: 'pending',
  },
  payment_status: {
    type: String,
    enum: ['unpaid', 'paid', 'payment_failed', 'refunded'],
    default: 'unpaid',
  },
  // Incremented on each payment attempt — used to build idempotency keys for Stripe
  attempt_number: {
    type: Number,
    default: 0,
  },
  stripe_session_id: {
    type: String,
    default: null,
  },
}, { timestamps: true });

// SECURITY: Prevents double-booking race condition natively in MongoDB
// Only one active/pending/completed booking can exist for a specific time slot on a listing
bookingSchema.index(
  { listing_id: 1, requested_time: 1 },
  { unique: true, partialFilterExpression: { status: { $nin: ['cancelled', 'refunded'] } } }
);

module.exports = mongoose.model('Booking', bookingSchema);
