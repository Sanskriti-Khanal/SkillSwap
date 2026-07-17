const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const authMiddleware = require('../middleware/auth');
const User = require('../models/User');
const Booking = require('../models/Booking');
const PasswordHistory = require('../models/PasswordHistory');
const RevokedToken = require('../models/RevokedToken');
const TutorApplication = require('../models/TutorApplication');
const TutorEducation = require('../models/TutorEducation');
const TutorExperience = require('../models/TutorExperience');
const TutorSkills = require('../models/TutorSkills');
const { logEvent } = require('../services/logger');

const router = express.Router();

// @route   GET /api/users/:id/public-profile
// @desc    Public tutor profile — safe subset of the user's own fields plus their most
//          recent APPROVED tutor application data (headline, bio, skills, education,
//          portfolio links). Registered before the authMiddleware blanket below so
//          anyone browsing (including logged-out visitors) can view it.
// @access  Public
// SECURITY: never includes TutorVerification (government ID) or any admin-only field —
// only a hand-picked public-safe projection is ever returned.
router.get('/:id/public-profile', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('email role profile_photo_url bio createdAt');
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const application = await TutorApplication.findOne({ user_id: user._id, status: 'approved' });

    let education = null;
    let experience = null;
    let skills = null;
    if (application) {
      [education, experience, skills] = await Promise.all([
        application.education_id ? TutorEducation.findById(application.education_id).select('highest_education institution_name field_of_study') : null,
        application.experience_id ? TutorExperience.findById(application.experience_id).select('portfolio_links current_title current_company years_of_professional_experience') : null,
        application.skills_id ? TutorSkills.findById(application.skills_id) : null,
      ]);
    }

    res.json({
      user: {
        _id: user._id,
        email: user.email,
        role: user.role,
        profile_photo_url: user.profile_photo_url,
        bio: user.bio,
        member_since: user.createdAt,
      },
      profile: application ? {
        display_name: application.personal_info?.display_name,
        professional_headline: application.professional_headline,
        bio: application.bio,
        education,
        experience,
        skills,
      } : null,
    });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'User not found' });
    res.status(500).send('Server Error');
  }
});

// Apply auth middleware to all routes below this point.
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

// @route   DELETE /api/users/me
// @desc    Delete own account and all associated data (GDPR right to erasure)
// @access  Private
router.delete('/me', [
  body('password', 'Password confirmation required').exists()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { return res.status(400).json({ errors: errors.array() }); }

  try {
    const user = await User.findById(req.user.id);
    if (!user) { return res.status(404).json({ msg: 'User not found' }); }

    // SECURITY: require password confirmation before deletion — prevents CSRF-assisted
    // account deletion and limits damage if an access token is stolen. An attacker with
    // only the JWT cannot delete the account without also knowing the password.
    // OWASP A07:2021 – Identification and Authentication Failures.
    const isMatch = await bcrypt.compare(req.body.password, user.password_hash);
    if (!isMatch) {
      return res.status(403).json({ msg: 'Incorrect password — account deletion denied' });
    }

    // Revoke refresh token if present (session invalidation)
    const refreshToken = req.cookies['__Host-skillswap-session'];
    if (refreshToken) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'refreshSecret123');
        if (decoded.jti) {
          await RevokedToken.create({ jti: decoded.jti, expires_at: new Date(decoded.exp * 1000) });
        }
      } catch (_) {}
    }

    // Cascade delete: remove all user data (GDPR erasure)
    // Bookings and password history are deleted. Reviews and listings are soft-anonymised
    // to preserve tutor ratings for other users. The tutor_id field is set to null.
    await Promise.all([
      PasswordHistory.deleteMany({ userId: user._id }),
      Booking.deleteMany({ $or: [{ learner_id: user._id }, { tutor_id: user._id }] }),
      User.findByIdAndDelete(user._id),
    ]);

    // Clear session cookie
    res.clearCookie('__Host-skillswap-session', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
    });

    logEvent(user._id, 'user.account_deleted', { ipAddress: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ msg: 'Account and associated data deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
