const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// Apply auth middleware to all user routes
router.use(authMiddleware);

// Rate limiter for data export: 1 request per hour per user
const exportRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1, // limit each user to 1 request per windowMs
  keyGenerator: (req) => req.user.id, // Rate limit based on user ID, not IP
  message: { msg: 'Data export limit reached. Please try again in an hour.' }
});

// @route   PATCH /api/users/profile
// @desc    Update user profile
// @access  Private
router.patch('/profile', [
  body('hourly_rate').optional().isNumeric(),
  body('skills').optional().isArray(),
  body('availability_days').optional().isArray()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { return res.status(400).json({ errors: errors.array() }); }

  try {
    // SECURITY: Privilege escalation fix - explicitly remove protected fields
    delete req.body.role;
    delete req.body._id;
    delete req.body.password_hash;
    delete req.body.mfa_secret;

    const allowed = ['bio', 'skills', 'hourly_rate', 'availability_days', 'profile_photo_url'];
    const updateFields = {};

    // SECURITY: mass assignment prevention — only whitelisted fields accepted
    Object.keys(req.body).forEach((key) => {
      if (allowed.includes(key)) {
        updateFields[key] = req.body[key];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateFields },
      { new: true }
    ).select('-password_hash -mfa_secret');

    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/users/me
// @desc    Get current user profile
// @access  Private
router.get('/me', async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password_hash -mfa_secret');
    if (!user) {
      return res.status(404).json({ msg: 'Profile not found' });
    }
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/users/:id/profile

// @desc    Get user profile
// @access  Private
router.get('/:id/profile', async (req, res) => {
  try {
    // SECURITY: IDOR prevention — ownership enforced server-side
    // We enforce that the requested ID matches the authenticated user's ID
    if (req.params.id !== req.user.id) {
      return res.status(403).json({ msg: 'Forbidden: You can only view your own profile' });
    }

    const user = await User.findOne({ _id: req.params.id, _id: req.user.id })
      .select('-password_hash -mfa_secret');

    if (!user) {
      return res.status(404).json({ msg: 'Profile not found' });
    }

    res.json(user);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Profile not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/users/me/export
// @desc    Export authenticated user data as JSON
// @access  Private
router.get('/me/export', exportRateLimiter, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    // Remove sensitive data before export
    delete user.password_hash;
    delete user.mfa_secret;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="user-data-export.json"');
    res.send(JSON.stringify(user, null, 2));
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
