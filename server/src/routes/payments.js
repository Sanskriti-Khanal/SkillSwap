const express = require('express');
const khalti = require('../services/khaltiService');
const authMiddleware = require('../middleware/auth');
const requireRole = require('../middleware/rbac');
const Booking = require('../models/Booking');
const { logEvent } = require('../services/logger');
const { generateMeetingLink } = require('../services/jitsiService');
const { sendMeetingLinkEmail } = require('../services/emailService');

const router = express.Router();

// @route   POST /api/payments/initiate
// @desc    Start a Khalti ePayment (KPG v2) for a booking
// @access  Private (learner)
router.post('/initiate', authMiddleware, async (req, res) => {
  try {
    const { booking_id } = req.body;
    if (!booking_id) {
      return res.status(400).json({ msg: 'booking_id is required' });
    }

    const booking = await Booking.findById(booking_id).populate('listing_id');
    if (!booking) {
      return res.status(404).json({ msg: 'Booking not found' });
    }

    if (booking.learner_id.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Forbidden: you can only pay for your own bookings' });
    }

    if (booking.payment_status === 'paid') {
      return res.status(400).json({ msg: 'This booking has already been paid' });
    }

    // SECURITY: amount is server-authoritative — read from the listing price, in
    // paisa. The client never supplies (or influences) the amount sent to Khalti.
    const listing = booking.listing_id;
    const amountInPaisa = Math.round(listing.price_per_session * 100);

    const result = await khalti.initiate({
      return_url: `${process.env.CLIENT_URL}/payment-success?booking_id=${booking._id}`,
      website_url: process.env.CLIENT_URL,
      amount: amountInPaisa,
      purchase_order_id: booking._id.toString(),
      purchase_order_name: listing.title,
    });

    booking.khalti_pidx = result.pidx;
    await booking.save();

    logEvent(req.user.id, 'payment.initiated', {
      ipAddress: req.ip,
      bookingId: booking._id,
      pidx: result.pidx,
    });

    res.json({ payment_url: result.payment_url });
  } catch (err) {
    console.error('Khalti initiate error:', err.message);
    res.status(502).json({ msg: 'Payment initiation failed' });
  }
});

// @route   POST /api/payments/verify
// @desc    Confirm a Khalti payment via server-side lookup (never trust redirect query params)
// @access  Private (learner)
// NOTE: KPG v2 has no completion webhook — this lookup is the only source of truth.
router.post('/verify', authMiddleware, async (req, res) => {
  try {
    const { booking_id } = req.body;
    if (!booking_id) {
      return res.status(400).json({ msg: 'booking_id is required' });
    }

    const booking = await Booking.findById(booking_id)
      .populate('listing_id')
      .populate('tutor_id', 'email')
      .populate('learner_id', 'email');
    if (!booking) {
      return res.status(404).json({ msg: 'Booking not found' });
    }

    if (booking.learner_id._id.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Forbidden' });
    }

    // Idempotent short-circuit — already settled, no need to hit Khalti again
    if (booking.payment_status === 'paid') {
      return res.json({ status: 'paid', meeting_link: booking.meeting_link });
    }

    if (!booking.khalti_pidx) {
      return res.status(400).json({ msg: 'No payment has been initiated for this booking' });
    }

    const result = await khalti.lookup(booking.khalti_pidx);
    const expectedAmount = Math.round(booking.listing_id.price_per_session * 100);

    if (result.status === 'Completed' && result.total_amount === expectedAmount) {
      // SECURITY: the conditional filter (payment_status != 'paid') makes settlement
      // idempotent — concurrent/duplicate verify calls for the same booking cannot
      // double-settle it, and the unique index on khalti_pidx prevents a pidx from
      // ever being attached to more than one booking.
      const updated = await Booking.findOneAndUpdate(
        { _id: booking._id, payment_status: { $ne: 'paid' } },
        { payment_status: 'paid', status: 'confirmed', meeting_link: generateMeetingLink(booking._id) },
        { new: true }
      );
      if (updated) {
        logEvent(req.user.id, 'payment.completed', {
          ipAddress: req.ip,
          bookingId: booking._id,
          pidx: booking.khalti_pidx,
        });

        const emailPayload = {
          title: booking.listing_id.title,
          meetingLink: updated.meeting_link,
          requestedTime: booking.requested_time,
        };
        sendMeetingLinkEmail(booking.learner_id.email, emailPayload).catch((err) => console.error('Meeting link email (learner) failed:', err.message));
        sendMeetingLinkEmail(booking.tutor_id.email, emailPayload).catch((err) => console.error('Meeting link email (tutor) failed:', err.message));
      }
      return res.json({ status: 'paid', meeting_link: updated ? updated.meeting_link : booking.meeting_link });
    }

    if (['Expired', 'User canceled'].includes(result.status)) {
      booking.payment_status = 'payment_failed';
      await booking.save();
      logEvent(req.user.id, 'payment.failed', {
        ipAddress: req.ip,
        bookingId: booking._id,
        khaltiStatus: result.status,
      });
      return res.json({ status: 'failed', khaltiStatus: result.status });
    }

    // Pending / partially refunded / anything else transient — don't mutate the booking
    return res.json({ status: 'pending', khaltiStatus: result.status });
  } catch (err) {
    console.error('Khalti verify error:', err.message);
    res.status(502).json({ msg: 'Payment verification failed' });
  }
});

// @route   POST /api/payments/refund/:bookingId
// @desc    Mark a booking refunded for reconciliation
// @access  Private (admin only)
// NOTE: Khalti's public KPG v2 API has no programmatic refund endpoint — refunds must
// be issued manually from the Khalti merchant dashboard. This route only records that
// a refund was issued so the booking status stays consistent for reconciliation.
router.post('/refund/:bookingId', [authMiddleware, requireRole('admin')], async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) {
      return res.status(404).json({ msg: 'Booking not found' });
    }

    if (booking.payment_status !== 'paid') {
      return res.status(400).json({ msg: 'Only paid bookings can be refunded' });
    }

    booking.payment_status = 'refunded';
    booking.status = 'refunded';
    await booking.save();

    logEvent(req.user.id, 'payment.refunded', {
      ipAddress: req.ip,
      bookingId: booking._id,
    });

    res.json({ msg: 'Booking marked as refunded. Issue the refund manually via the Khalti merchant dashboard.' });
  } catch (err) {
    console.error('Refund error:', err.message);
    res.status(500).json({ msg: 'Refund processing failed' });
  }
});

module.exports = router;
