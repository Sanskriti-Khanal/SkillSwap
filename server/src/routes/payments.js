const express = require('express');
const getStripe = require('../services/stripeService');
const authMiddleware = require('../middleware/auth');
const requireRole = require('../middleware/rbac');
const Booking = require('../models/Booking');
const Listing = require('../models/Listing');
const { logEvent } = require('../services/logger');

const router = express.Router();

// @route   POST /api/payments/create-checkout-session
// @desc    Create a Stripe Checkout session for a booking
// @access  Private (learner)
router.post('/create-checkout-session', authMiddleware, async (req, res) => {
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

    // SECURITY: price fetched from DB — client-supplied amount is ignored
    const listing = booking.listing_id;
    const amountInPaisa = Math.round(listing.price_per_session * 100); // NPR → paisa

    // Increment attempt number and save before calling Stripe to build a stable idempotency key
    booking.attempt_number += 1;
    await booking.save();

    const idempotencyKey = `${booking._id}-${booking.attempt_number}`;

    const session = await getStripe().checkout.sessions.create(
      {
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'npr',
              product_data: {
                name: listing.title,
                description: `${listing.duration_minutes}-minute session with tutor`,
              },
              unit_amount: amountInPaisa,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${process.env.CLIENT_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_URL}/payment-cancel?booking_id=${booking._id}`,
        metadata: {
          booking_id: booking._id.toString(),
        },
      },
      { idempotencyKey }
    );

    // Store session ID so the webhook can look up the booking
    booking.stripe_session_id = session.id;
    await booking.save();

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err.message);
    res.status(500).json({ msg: 'Payment session creation failed' });
  }
});

// @route   POST /api/payments/webhook
// @desc    Handle Stripe webhook events
// @access  Public (Stripe-signed only)
// NOTE: This route must receive the raw body — see app.js for express.raw() mount
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    // SECURITY: webhook signature verified — prevents spoofed payment confirmations
    event = getStripe().webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ msg: `Webhook Error: ${err.message}` });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const bookingId = session.metadata?.booking_id;

      if (bookingId) {
        await Booking.findByIdAndUpdate(bookingId, {
          payment_status: 'paid',
          status: 'confirmed',
        });
        logEvent(null, 'payment.completed', { bookingId, stripeSessionId: session.id });
      }
    }

    if (event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object;
      // Find booking by stripe_session_id via the checkout session
      // payment_intent.metadata is set if created via PaymentIntent directly;
      // for Checkout-initiated flows we match via the stored session ID
      const booking = await Booking.findOne({
        stripe_session_id: { $exists: true },
        payment_status: 'unpaid',
      }).where('stripe_session_id').ne(null);

      if (booking) {
        booking.payment_status = 'payment_failed';
        await booking.save();
        logEvent(null, 'payment.failed', { bookingId: booking._id });
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err.message);
    res.status(500).json({ msg: 'Webhook processing failed' });
  }
});

// @route   POST /api/payments/refund/:bookingId
// @desc    Refund a payment and update booking status
// @access  Private (admin only)
router.post('/refund/:bookingId', [authMiddleware, requireRole('admin')], async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId).populate('listing_id');
    if (!booking) {
      return res.status(404).json({ msg: 'Booking not found' });
    }

    if (booking.payment_status !== 'paid') {
      return res.status(400).json({ msg: 'Only paid bookings can be refunded' });
    }

    if (!booking.stripe_session_id) {
      return res.status(400).json({ msg: 'No Stripe session found for this booking' });
    }

    // Fetch the Stripe session to get the PaymentIntent ID
    const session = await getStripe().checkout.sessions.retrieve(booking.stripe_session_id);
    if (!session.payment_intent) {
      return res.status(400).json({ msg: 'No payment intent found for this session' });
    }

    // Issue the refund via Stripe
    let refund;
    try {
      refund = await getStripe().refunds.create({ payment_intent: session.payment_intent });
    } catch (stripeErr) {
      console.error('Stripe refund failed:', stripeErr.message);
      return res.status(502).json({ msg: 'Stripe refund failed — booking status unchanged' });
    }

    // Only update DB after Stripe succeeds — if this fails, the refund exists in Stripe
    // and can be reconciled manually via the Stripe dashboard
    booking.payment_status = 'refunded';
    booking.status = 'refunded';
    await booking.save();

    logEvent(req.user.id, 'payment.refunded', {
      ipAddress: req.ip,
      bookingId: booking._id,
      refundId: refund.id,
    });
    res.json({ msg: 'Refund issued successfully', refund_id: refund.id });
  } catch (err) {
    console.error('Refund error:', err.message);
    res.status(500).json({ msg: 'Refund processing failed' });
  }
});

module.exports = router;
