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
  // Khalti KPG v2 payment identifier, set once /payments/initiate succeeds
  khalti_pidx: {
    type: String,
    default: null,
  },
  // Jitsi Meet room URL, generated once the booking is confirmed
  meeting_link: {
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

// SECURITY: a Khalti pidx can never be attached to more than one booking — enforced
// atomically at the database layer, not just in application logic. Sparse/partial so
// bookings that haven't started a payment yet (khalti_pidx: null) don't collide.
bookingSchema.index(
  { khalti_pidx: 1 },
  { unique: true, partialFilterExpression: { khalti_pidx: { $type: 'string' } } }
);

module.exports = mongoose.model('Booking', bookingSchema);
