const express = require('express');
const { body, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const Review = require('../models/Review');
const Booking = require('../models/Booking');

const router = express.Router();

// NOTE: no blanket `router.use(authMiddleware)` in this file — some routes are
// genuinely public (tutor/listing review listings for browsing) and some are
// private (submitting a review, fetching your own reviews). Auth is applied
// per-route below instead, and note that '/tutor/me' MUST be registered before
// '/tutor/:tutorId' or the dynamic route would shadow it.

// @route   POST /api/reviews
// @desc    Submit a review for a booking
// @access  Private
router.post('/', authMiddleware, [
  body('booking_id', 'Booking ID is required').not().isEmpty(),
  body('rating', 'Rating must be between 1 and 5').isInt({ min: 1, max: 5 }),
  body('comment', 'Comment is required').not().isEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { return res.status(400).json({ errors: errors.array() }); }

  try {
    const { booking_id, rating, comment } = req.body;

    const booking = await Booking.findById(booking_id);
    if (!booking) {
      return res.status(404).json({ msg: 'Booking not found' });
    }

    // a. BUSINESS LOGIC SECURITY CHECK: booking.status must equal 'confirmed' AND booking.requested_time < NOW()
    // Using requested_time as the session time marker
    if (booking.status !== 'confirmed' && booking.status !== 'completed') {
      return res.status(400).json({ msg: 'Cannot review a booking that is not confirmed or completed' });
    }
    if (new Date(booking.requested_time) > new Date()) {
      return res.status(400).json({ msg: 'Cannot review a session that has not occurred yet' });
    }

    // b. BUSINESS LOGIC SECURITY CHECK: req.user.id must equal booking.learner_id
    if (req.user.id !== booking.learner_id.toString()) {
      return res.status(403).json({ msg: 'Forbidden: Only the learner who booked the session can review it' });
    }

    // c. BUSINESS LOGIC SECURITY CHECK: req.user.id must NOT equal the listing's tutor_id (no self-review)
    if (req.user.id === booking.tutor_id.toString()) {
      return res.status(403).json({ msg: 'Forbidden: You cannot review your own listing' });
    }

    const review = new Review({
      booking_id,
      listing_id: booking.listing_id,
      tutor_id: booking.tutor_id,
      learner_id: req.user.id,
      rating,
      comment
    });

    await review.save();
    res.status(201).json(review);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ msg: 'You have already reviewed this booking' });
    }
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/reviews/tutor/me
// @desc    Get all reviews received by the authenticated tutor
// @access  Private
// Must be registered before GET /tutor/:tutorId below, or the dynamic route would
// shadow this one (Express matches routes in registration order).
router.get('/tutor/me', authMiddleware, async (req, res) => {
  try {
    const reviews = await Review.find({ tutor_id: req.user.id })
      .populate('learner_id', 'email profile_photo_url')
      .populate('listing_id', 'title')
      .sort({ createdAt: -1 });

    res.json(reviews);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/reviews/tutor/:tutorId
// @desc    Get all reviews received by a specific tutor (public profile page).
// @access  Public
router.get('/tutor/:tutorId', async (req, res) => {
  try {
    const reviews = await Review.find({ tutor_id: req.params.tutorId })
      .populate('learner_id', 'email profile_photo_url')
      .populate('listing_id', 'title')
      .sort({ createdAt: -1 });

    res.json(reviews);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'Tutor not found' });
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/reviews/listing/:listingId
// @desc    Get all reviews for a listing
// @access  Public
router.get('/listing/:listingId', async (req, res) => {
  try {
    const reviews = await Review.find({ listing_id: req.params.listingId })
      .populate('learner_id', 'email profile_photo_url')
      .sort({ createdAt: -1 });

    res.json(reviews);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
