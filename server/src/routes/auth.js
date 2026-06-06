const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const zxcvbn = require('zxcvbn');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const PasswordHistory = require('../models/PasswordHistory');


const router = express.Router();

// Validation rules for password
const passwordValidation = [
  body('password')
    .isLength({ min: 12 }).withMessage('Password must be at least 12 characters long')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number')
    .matches(/[\W_]/).withMessage('Password must contain at least one special character'),
  body('email').isEmail().withMessage('Please provide a valid email address').normalizeEmail()
];

// @route   POST /api/auth/register
// @desc    Register user
// @access  Public
router.post('/register', passwordValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    // Evaluate password strength
    const strength = zxcvbn(password);

    // Hash password with bcrypt cost factor 12
    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(password, salt);

    // Create user
    user = new User({
      email,
      password_hash
    });

    await user.save();

    // Store in password history
    await PasswordHistory.create({
      userId: user._id,
      password_hash
    });

    // We don't return the JWT here yet; normally they might need to verify email or we just login.
    // The prompt just says "Return a zxcvbn strength score in the response" for registration.
    res.status(201).json({
      msg: 'User registered successfully',
      strengthScore: strength.score,
      strengthFeedback: strength.feedback
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Helper for device fingerprinting
const getFingerprint = (req) => {
  const userAgent = req.headers['user-agent'] || '';
  const ip = req.ip || req.connection.remoteAddress;
  return crypto.createHash('sha256').update(`${userAgent}-${ip}`).digest('hex');
};

const generateTokens = (user, fingerprint) => {
  const payload = {
    user: { id: user.id },
    fingerprint
  };
  
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET || 'secret123', { expiresIn: '15m' });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET || 'refreshSecret123', { expiresIn: '7d' });
  
  return { accessToken, refreshToken };
};

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', [
  body('email', 'Please include a valid email').isEmail(),
  body('password', 'Password is required').exists()
], async (req, res) => {
  const errors = validationResult(req);
  if(!errors.isEmpty()){ return res.status(400).json({ errors: errors.array() }); }
  
  const { email, password } = req.body;
  try {
    let user = await User.findOne({ email });
    if(!user) { return res.status(400).json({ msg: 'Invalid Credentials' }); }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if(!isMatch) { return res.status(400).json({ msg: 'Invalid Credentials' }); }

    // If MFA is enabled, we don't issue tokens here. We return a response indicating MFA is required.
    if(user.mfa_enabled) {
      return res.status(200).json({ mfaRequired: true, userId: user.id });
    }

    const fingerprint = getFingerprint(req);
    const { accessToken, refreshToken } = generateTokens(user, fingerprint);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ accessToken });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/auth/refresh
// @desc    Refresh access token
// @access  Public
router.post('/refresh', async (req, res) => {
  const token = req.cookies.refreshToken;
  if(!token) { return res.status(401).json({ msg: 'No refresh token provided' }); }

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'refreshSecret123');
    
    // Check fingerprint
    const fingerprint = getFingerprint(req);
    if(decoded.fingerprint !== fingerprint) {
      return res.status(401).json({ msg: 'Invalid device fingerprint' });
    }

    let user = await User.findById(decoded.user.id);
    if(!user) { return res.status(401).json({ msg: 'User not found' }); }

    const newTokens = generateTokens(user, fingerprint);

    res.cookie('refreshToken', newTokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ accessToken: newTokens.accessToken });
  } catch (err) {
    console.error(err.message);
    res.status(401).json({ msg: 'Invalid refresh token' });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Public
router.post('/logout', (req, res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict'
  });
  res.json({ msg: 'Logged out successfully' });
});

module.exports = router;

