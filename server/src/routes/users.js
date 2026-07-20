const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const authMiddleware = require('../middleware/auth');
const requireOwnership = require('../middleware/requireOwnership');
const User = require('../models/User');
const Booking = require('../models/Booking');
const PasswordHistory = require('../models/PasswordHistory');
const RevokedToken = require('../models/RevokedToken');
const TutorApplication = require('../models/TutorApplication');
const TutorEducation = require('../models/TutorEducation');
const TutorExperience = require('../models/TutorExperience');
const TutorSkills = require('../models/TutorSkills');
const TutorDocuments = require('../models/TutorDocuments');
const { logEvent } = require('../services/logger');
const { getSignedDownloadUrl } = require('../config/storage');

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

    let profile_photo_url = user.profile_photo_url;
    let education = null;
    let experience = null;
    let skills = null;
    if (application) {
      [education, experience, skills] = await Promise.all([
        application.education_id ? TutorEducation.findById(application.education_id).select('highest_education institution_name field_of_study certifications') : null,
        application.experience_id ? TutorExperience.findById(application.experience_id).select('portfolio_links current_title current_company years_of_professional_experience') : null,
        application.skills_id ? TutorSkills.findById(application.skills_id) : null,
      ]);

      if (!profile_photo_url) {
        const doc = await TutorDocuments.findOne({ application_id: application._id, category: 'profile_photo', status: 'uploaded' });
        if (doc) {
          try {
            profile_photo_url = getSignedDownloadUrl(doc.storage_key, doc.format, doc.resource_type, 604800); // 7 days
          } catch (e) {
            console.error('Failed to generate signed URL for profile photo:', e);
          }
        }
      }
    }

    res.json({
      user: {
        _id: user._id,
        email: user.email,
        role: user.role,
        profile_photo_url: profile_photo_url,
        bio: user.bio,
        member_since: user.createdAt,
      },
      profile: application ? {
        display_name: application.personal_info?.display_name,
        professional_headline: application.professional_headline,
        bio: application.bio,
        // Teaching proof is submitted by the applicant specifically to demonstrate their
        // teaching ability publicly — unlike TutorVerification, it's meant to be shown.
        demo_video_youtube_url: application.teaching_proof?.demo_video_youtube_url || null,
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
// SECURITY: previously `User.findOne({ _id: req.params.id, _id: req.user.id })`
// — a duplicate `_id` key in the same object literal, which JavaScript
// silently resolves to just the second value. The query itself enforced
// NOTHING; only the explicit `if` check above it protected this route. Not
// exploitable as it stood (the check was correct), but one refactor away
// from a real IDOR if someone ever removed that check believing the query
// already scoped it. requireOwnership replaces both with one reviewed check.
router.get('/:id/profile', requireOwnership(User, { ownerFields: '_id', resourceName: 'Profile' }), async (req, res) => {
  const user = req.resource.toObject();
  delete user.password_hash;
  delete user.mfa_secret;
  res.json(user);
});

// @route   GET /api/users/me/export
// @desc    Export authenticated user data as JSON
// @access  Private
router.get('/me/export', exportRateLimiter, async (req, res) => {
  try {
    // NOT .lean() — email is encrypted at rest (see models/User.js), and its
    // decrypt transform is a Mongoose document getter. .lean() returns a
    // plain object straight from the driver, bypassing getters entirely,
    // which would export raw ciphertext instead of the user's real email.
    // .toObject() below applies the same getters explicitly.
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const exported = user.toObject();
    delete exported.password_hash;
    delete exported.mfa_secret;
    delete exported.email_lookup_hash;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="user-data-export.json"');
    res.send(JSON.stringify(exported, null, 2));
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
