const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const zxcvbn = require('zxcvbn');
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

module.exports = router;
