const express = require('express');
const { body, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const Booking = require('../models/Booking');
const Listing = require('../models/Listing');
const User = require('../models/User');
const { logEvent } = require('../services/logger');
const { generateMeetingLink } = require('../services/jitsiService');
const { sendMeetingLinkEmail } = require('../services/emailService');

const router = express.Router();

router.use(authMiddleware);

// @route   POST /api/bookings
// @desc    Book a session for a listing
// @access  Private
router.post('/', [
  body('listing_id', 'Listing ID is required').not().isEmpty(),
  body('requested_time', 'Valid requested time is required').isISO8601()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { return res.status(400).json({ errors: errors.array() }); }

  try {
    const { listing_id, requested_time } = req.body;

    const listing = await Listing.findById(listing_id);
    if (!listing) {
      return res.status(404).json({ msg: 'Listing not found' });
    }

    if (listing.tutor_id.toString() === req.user.id) {
      return res.status(400).json({ msg: 'You cannot book your own listing' });
    }

    // SECURITY: SELECT FOR UPDATE equivalent — explicit conflict check before insert.
    // The unique partial index on (listing_id, requested_time) where status != 'cancelled'
    // provides the atomic guarantee; this pre-check surfaces a clean 409 before hitting
    // the index and prevents double-booking race conditions.
    const conflict = await Booking.findOne({
      listing_id,
      requested_time: new Date(requested_time),
      status: { $ne: 'cancelled' }
    });

    if (conflict) {
      return res.status(409).json({ msg: 'Conflict: This time slot is already booked' });
    }

    const booking = new Booking({
      listing_id,
      tutor_id: listing.tutor_id,
      learner_id: req.user.id,
      requested_time
    });

    await booking.save();
    logEvent(req.user.id, 'booking.created', { ipAddress: req.ip, bookingId: booking._id, listingId: listing._id });
    res.status(201).json(booking);
  } catch (err) {
    // SECURITY: Unique index on (listing_id, requested_time) catches any race
    // between the conflict check and the insert — final layer of double-booking prevention.
    if (err.code === 11000) {
      return res.status(409).json({ msg: 'Conflict: This time slot is already booked' });
    }
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/bookings
// @desc    Get all bookings for authenticated user
// @access  Private
router.get('/', async (req, res) => {
  try {
    // Fetch bookings where user is either the learner or the tutor
    const bookings = await Booking.find({
      $or: [{ learner_id: req.user.id }, { tutor_id: req.user.id }]
    })
      .populate('listing_id', 'title price_per_session duration_minutes')
      .populate('tutor_id', 'email')
      .populate('learner_id', 'email')
      .sort({ requested_time: 1 });

    res.json(bookings);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/bookings/:id
// @desc    Get booking by ID
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('listing_id')
      .populate('tutor_id', 'email')
      .populate('learner_id', 'email');

    if (!booking) return res.status(404).json({ msg: 'Booking not found' });

    if (booking.learner_id._id.toString() !== req.user.id && booking.tutor_id._id.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Forbidden: You are not authorized to view this booking' });
    }

    res.json(booking);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'Booking not found' });
    res.status(500).send('Server Error');
  }
});

// @route   PATCH /api/bookings/:id/confirm
// @desc    Confirm a booking
// @access  Private (tutor only)
router.patch('/:id/confirm', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ msg: 'Booking not found' });

    if (booking.tutor_id.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Forbidden: Only the tutor can confirm this booking' });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({ msg: `Cannot confirm a booking that is ${booking.status}` });
    }

    // SECURITY: free session bypass prevention — payment_status is verified from the database.
    // Never trust a client-supplied payment flag. Without this check a learner could call
    // PATCH /api/bookings/:id/confirm directly and receive a confirmed session without paying.
    //
    // VULNERABLE code (do NOT use):
    //   if (req.body.paid) { booking.status = 'confirmed'; }   ← client controls this
    if (booking.payment_status !== 'paid') {
      return res.status(402).json({ msg: 'Payment required: complete Khalti checkout before confirming' });
    }

    booking.status = 'confirmed';
    booking.meeting_link = generateMeetingLink(booking._id);
    await booking.save();

    logEvent(req.user.id, 'booking.confirmed', { ipAddress: req.ip, bookingId: booking._id });

    // Fire-and-forget confirmation emails — best-effort, must not block or fail the response
    Promise.all([
      Listing.findById(booking.listing_id).select('title'),
      User.findById(booking.tutor_id).select('email'),
      User.findById(booking.learner_id).select('email'),
    ]).then(([listing, tutor, learner]) => {
      const payload = { title: listing?.title, meetingLink: booking.meeting_link, requestedTime: booking.requested_time };
      if (tutor?.email) sendMeetingLinkEmail(tutor.email, payload).catch((err) => console.error('Meeting link email (tutor) failed:', err.message));
      if (learner?.email) sendMeetingLinkEmail(learner.email, payload).catch((err) => console.error('Meeting link email (learner) failed:', err.message));
    }).catch((err) => console.error('Meeting link email lookup failed:', err.message));

    res.json(booking);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'Booking not found' });
    res.status(500).send('Server Error');
  }
});

// @route   PATCH /api/bookings/:id/cancel
// @desc    Cancel a booking
// @access  Private
router.patch('/:id/cancel', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ msg: 'Booking not found' });

    if (booking.learner_id.toString() !== req.user.id && booking.tutor_id.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Forbidden: You are not authorized to cancel this booking' });
    }

    if (booking.status === 'cancelled' || booking.status === 'completed') {
      return res.status(400).json({ msg: `Cannot cancel a booking that is ${booking.status}` });
    }

    booking.status = 'cancelled';
    await booking.save();

    logEvent(req.user.id, 'booking.cancelled', { ipAddress: req.ip, bookingId: booking._id });
    res.json(booking);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'Booking not found' });
    res.status(500).send('Server Error');
  }
});

module.exports = router;
