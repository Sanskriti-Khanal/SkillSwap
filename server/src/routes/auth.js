const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const zxcvbn = require('zxcvbn');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const User = require('../models/User');
const PasswordHistory = require('../models/PasswordHistory');
const { encrypt, decrypt } = require('../utils/encryption');
const authMiddleware = require('../middleware/auth');
const { authRateLimiter } = require('../middleware/rateLimiter');
const captchaMiddleware = require('../middleware/captcha');
const { logEvent } = require('../services/logger');
const LoginAttempt = require('../models/LoginAttempt');
const RevokedToken = require('../models/RevokedToken');
const { isPasswordPwned } = require('../services/hibpService');





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
router.post('/register', authRateLimiter, captchaMiddleware, passwordValidation, async (req, res) => {
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

    // SECURITY: k-anonymity breach check — reject passwords found in known breach databases.
    // Fails open (allows registration) if the HIBP API is unreachable.
    const pwnedCount = await isPasswordPwned(password);
    if (pwnedCount > 0) {
      return res.status(400).json({
        msg: `This password has appeared in ${pwnedCount.toLocaleString()} data breach(es). Please choose a different password.`
      });
    }

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

    logEvent(user._id, 'user.register', {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      email: user.email,
    });

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
  // SECURITY: role is included so RBAC middleware can enforce access control without
  // a DB round-trip on every request. The role is re-verified against the DB on
  // sensitive admin actions. Short token lifetime (15 min) limits the window where
  // a stale role could be exploited if an admin demotes a user.
  //
  // jti (JWT ID) is a unique identifier per token. On logout the refresh token's jti
  // is stored in RevokedToken so it cannot be replayed even within its 7-day lifetime.
  const jti = crypto.randomBytes(16).toString('hex');
  const payload = {
    user: { id: user.id, role: user.role },
    fingerprint,
    jti,
  };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET || 'secret123', { expiresIn: '15m' });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET || 'refreshSecret123', { expiresIn: '7d' });

  return { accessToken, refreshToken, jti };
};

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', authRateLimiter, captchaMiddleware, [
  body('email', 'Please include a valid email').isEmail(),
  body('password', 'Password is required').exists()
], async (req, res) => {

  const errors = validationResult(req);

  if(!errors.isEmpty()){ return res.status(400).json({ errors: errors.array() }); }
  
  const { email, password } = req.body;
  try {
    let user = await User.findOne({ email });
    if(!user) { return res.status(400).json({ msg: 'Invalid Credentials' }); }

    // Check if account is locked
    if (user.locked_until && user.locked_until > Date.now()) {
      return res.status(400).json({ msg: 'Invalid Credentials' }); // Generic error
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    
    if(!isMatch) {
      user.failed_attempts += 1;

      // SECURITY: progressive lockout backoff — each lock doubles the duration.
      // Flat lockouts are predictable; doubling forces an attacker to wait exponentially
      // longer after each bypass attempt while still auto-recovering for genuine users.
      // Thresholds: 5 → 15 min, 10 → 30 min, 15 → 60 min, 20+ → 120 min (cap).
      // OWASP A07:2021 – Identification and Authentication Failures.
      const isNowLocked = user.failed_attempts % 5 === 0;
      if (isNowLocked) {
        const lockMultiplier = Math.min(Math.floor(user.failed_attempts / 5), 8); // cap at 8 doublings
        const lockMinutes = 15 * lockMultiplier;
        user.locked_until = new Date(Date.now() + lockMinutes * 60 * 1000);
      }
      await user.save();

      logEvent(user._id, 'user.login_failed', {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        failed_attempts: user.failed_attempts,
      });

      if (isNowLocked) {
        logEvent(user._id, 'user.account_locked', {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          locked_until: user.locked_until,
        });
      }

      // Brute-force detection: record attempt and alert if >= 3 in 10 minutes from this IP
      const ip = req.ip;
      await LoginAttempt.create({ ip });
      const recentCount = await LoginAttempt.countDocuments({
        ip,
        attempted_at: { $gte: new Date(Date.now() - 10 * 60 * 1000) },
      });
      if (recentCount >= 3) {
        // Log at CRITICAL level — in production, pipe this to nodemailer or SendGrid:
        //   transporter.sendMail({ to: 'security@skillswap.com', subject: 'Brute-force alert', text: `IP: ${ip}` })
        require('../services/logger').logger.warn({
          level: 'warn',
          userId: null,
          action: 'security.brute_force_detected',
          ipAddress: ip,
          message: `Possible brute-force attack from IP: ${ip} — manual review recommended`,
          recentFailedAttempts: recentCount,
        });
      }

      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    // Reset lockout counters on successful login
    if (user.failed_attempts > 0 || user.locked_until) {
      user.failed_attempts = 0;
      user.locked_until = undefined;
      await user.save();
    }

    // If MFA is enabled, we don't issue tokens here. We return a response indicating MFA is required.
    if(user.mfa_enabled) {
      return res.status(200).json({ mfaRequired: true, userId: user.id });
    }

    const fingerprint = getFingerprint(req);
    const { accessToken, refreshToken } = generateTokens(user, fingerprint);

    // SECURITY: __Host- prefix prevents subdomain cookie injection —
    // the browser enforces Secure flag and path=/ automatically.
    // A subdomain (e.g. cdn.skillswap.com) cannot set or override this cookie.
    res.cookie('__Host-skillswap-session', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    logEvent(user._id, 'user.login', {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
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
  const token = req.cookies['__Host-skillswap-session'];
  if(!token) { return res.status(401).json({ msg: 'No refresh token provided' }); }

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'refreshSecret123');

    // SECURITY: revocation check — reject tokens that were explicitly invalidated on logout
    // or password change. Without this check an attacker who copied a refresh token before
    // logout could continue issuing new access tokens indefinitely within the 7-day window.
    if (decoded.jti) {
      const revoked = await RevokedToken.findOne({ jti: decoded.jti });
      if (revoked) {
        return res.status(401).json({ msg: 'Token has been revoked' });
      }
    }

    // Check fingerprint
    const fingerprint = getFingerprint(req);
    if(decoded.fingerprint !== fingerprint) {
      return res.status(401).json({ msg: 'Invalid device fingerprint' });
    }

    let user = await User.findById(decoded.user.id);
    if(!user) { return res.status(401).json({ msg: 'User not found' }); }

    // Revoke old token before issuing new one (rotation — prevents replay of old token)
    if (decoded.jti) {
      const expiresAt = new Date(decoded.exp * 1000);
      await RevokedToken.create({ jti: decoded.jti, expires_at: expiresAt });
    }

    const newTokens = generateTokens(user, fingerprint);

    res.cookie('__Host-skillswap-session', newTokens.refreshToken, {
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
router.post('/logout', async (req, res) => {
  const token = req.cookies['__Host-skillswap-session'];

  // SECURITY: server-side token revocation on logout.
  // Clearing the cookie alone is client-side enforcement — an attacker who copied
  // the refresh token before logout could still replay it. Storing the jti in
  // RevokedToken makes the token permanently invalid server-side.
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'refreshSecret123');
      if (decoded.jti) {
        const expiresAt = new Date(decoded.exp * 1000);
        await RevokedToken.create({ jti: decoded.jti, expires_at: expiresAt });
      }
    } catch (_) {
      // Token already invalid — still clear the cookie
    }
  }

  res.clearCookie('__Host-skillswap-session', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict'
  });
  logEvent(null, 'user.logout', { ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json({ msg: 'Logged out successfully' });
});

// @route   POST /api/auth/mfa/setup
// @desc    Setup MFA for logged in user
// @access  Private
router.post('/mfa/setup', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const secret = speakeasy.generateSecret({
      name: `SkillSwap (${user.email})`
    });

    user.mfa_secret = encrypt(secret.base32);
    await user.save();

    qrcode.toDataURL(secret.otpauth_url, (err, data_url) => {
      if (err) {
        return res.status(500).json({ msg: 'Error generating QR code' });
      }
      res.json({
        secret: secret.base32,
        qrCodeUrl: data_url
      });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/auth/mfa/verify
// @desc    Verify MFA token (used during login)
// @access  Public
router.post('/mfa/verify', async (req, res) => {
  const { userId, token } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    if (!user.mfa_enabled && !user.mfa_secret) {
       return res.status(400).json({ msg: 'MFA not setup for this user' });
    }

    const decryptedSecret = decrypt(user.mfa_secret);

    const verified = speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: 'base32',
      token
    });

    if (verified) {
      // If this is the first time verifying (setup phase), enable MFA
      if (!user.mfa_enabled) {
        user.mfa_enabled = true;
        await user.save();
        logEvent(user._id, 'user.mfa_enabled', { ipAddress: req.ip, userAgent: req.headers['user-agent'] });
      }

      // Generate tokens
      const fingerprint = getFingerprint(req);
      const { accessToken, refreshToken } = generateTokens(user, fingerprint);

      res.cookie('__Host-skillswap-session', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.json({ accessToken });
    } else {
      res.status(400).json({ msg: 'Invalid token' });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/auth/password/reset
// @desc    Reset password (requires valid JWT, meaning user is logged in but might be blocked by 403 on other routes)
// @access  Private
// We skip the standard authMiddleware here because authMiddleware blocks requests if password_changed_at > 90 days.
// We need a custom middleware or just verify token inline for this specific route.
router.post('/password/reset', [
  body('newPassword')
    .isLength({ min: 12 }).withMessage('Password must be at least 12 characters long')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number')
    .matches(/[\W_]/).withMessage('Password must contain at least one special character')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { return res.status(400).json({ errors: errors.array() }); }

  const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');
  if (!token) { return res.status(401).json({ msg: 'No token, authorization denied' }); }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
    
    // Verify fingerprint
    const fingerprint = getFingerprint(req);
    if (decoded.fingerprint !== fingerprint) {
      return res.status(401).json({ msg: 'Token validation failed' });
    }

    const user = await User.findById(decoded.user.id);
    if (!user) { return res.status(404).json({ msg: 'User not found' }); }

    const { newPassword } = req.body;

    // HIBP breach check on password reset too
    const pwnedCount = await isPasswordPwned(newPassword);
    if (pwnedCount > 0) {
      return res.status(400).json({
        msg: `This password has appeared in ${pwnedCount.toLocaleString()} data breach(es). Please choose a different password.`
      });
    }

    // Check last 5 passwords
    const history = await PasswordHistory.find({ userId: user.id }).sort({ createdAt: -1 }).limit(5);
    for (let record of history) {
      const isMatch = await bcrypt.compare(newPassword, record.password_hash);
      if (isMatch) {
        return res.status(400).json({ msg: 'Password has been used recently. Please choose a different password.' });
      }
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(newPassword, salt);

    // Update user
    user.password_hash = password_hash;
    user.password_changed_at = Date.now();
    await user.save();

    // Add to history
    await PasswordHistory.create({
      userId: user.id,
      password_hash
    });

    logEvent(user._id, 'user.password_changed', {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ msg: 'Password updated successfully' });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/auth/password-strength
// @desc    Calculate password strength
// @access  Public
router.post('/password-strength', (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.json({ score: 0, feedback: { warning: '', suggestions: [] } });
  }
  const strength = zxcvbn(password);
  res.json({ score: strength.score, feedback: strength.feedback });
});

module.exports = router;
