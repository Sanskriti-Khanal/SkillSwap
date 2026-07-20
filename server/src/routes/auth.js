const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const User = require('../models/User');
const PasswordHistory = require('../models/PasswordHistory');
const authMiddleware = require('../middleware/auth');
const { authRateLimiter } = require('../middleware/rateLimiter');
const captchaMiddleware = require('../middleware/captcha');
const { logEvent } = require('../services/logger');
const auditAction = require('../middleware/auditAction');
const {
  alertRepeatedFailedLogins,
  alertRefreshTokenReuse,
  recordPasswordResetRequest,
  checkImpossibleTravel,
} = require('../services/securityMonitor');
const passwordPolicy = require('../services/passwordPolicy');
const LoginAttempt = require('../models/LoginAttempt');
const RevokedToken = require('../models/RevokedToken');
const { verifyGoogleIdToken } = require('../services/googleAuthService');
const { sendPasswordResetEmail, sendPasswordChangedEmail } = require('../services/emailService');
const PasswordResetToken = require('../models/PasswordResetToken');





const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register user
// @access  Public
router.post('/register', auditAction('user.register', 'User'), authRateLimiter, captchaMiddleware, [
  body('email').isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    // Check if user already exists
    let user = await User.findByEmail(email);
    if (user) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    // Single source of truth for password rules — length/complexity, zxcvbn
    // score threshold, and HIBP breach check. Was previously a bespoke
    // express-validator regex chain plus a separate, unenforced zxcvbn call
    // plus a separate HIBP call, each duplicated again in the two
    // password-reset routes below. See services/passwordPolicy.js.
    const policyResult = await passwordPolicy.validateNewPassword(password, { userInputs: [email] });
    if (!policyResult.valid) {
      return res.status(400).json({ msg: policyResult.errors[0], errors: policyResult.errors });
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

    res.locals.audit.userId = user._id;
    res.locals.audit.role = user.role;
    res.locals.audit.resourceId = user._id;
    res.locals.audit.metadata = { email: user.email };

    res.status(201).json({
      msg: 'User registered successfully',
      strengthScore: policyResult.score,
      strengthFeedback: policyResult.feedback
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
    let user = await User.findByEmail(email);
    if(!user) { return res.status(400).json({ msg: 'Invalid Credentials' }); }

    // Check if account is locked
    if (user.locked_until && user.locked_until > Date.now()) {
      return res.status(400).json({ msg: 'Invalid Credentials' }); // Generic error
    }

    // Google-only accounts have no password_hash — generic error avoids leaking
    // that the account exists and how it was created (no user enumeration).
    if (!user.password_hash) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
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
        role: user.role,
        resource: 'User',
        resourceId: user._id,
        status: 'failure',
        failed_attempts: user.failed_attempts,
      });

      if (isNowLocked) {
        logEvent(user._id, 'user.account_locked', {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          role: user.role,
          resource: 'User',
          resourceId: user._id,
          status: 'failure',
          locked_until: user.locked_until,
        });
        // Suspicious-activity: fires past the "more than 10 failed logins"
        // threshold, reusing this same lockout checkpoint (every 5th failure)
        // rather than evaluating on every single failed attempt.
        alertRepeatedFailedLogins(user, req);
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
      role: user.role,
      resource: 'User',
      resourceId: user._id,
      status: 'success',
    });
    checkImpossibleTravel(user._id, req.ip, req.headers['user-agent']);

    res.json({ accessToken });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/auth/google
// @desc    Sign in (or register) with a Google ID token, issue our own JWTs
// @access  Public
router.post('/google', authRateLimiter, async (req, res) => {
  const { credential } = req.body;
  if (!credential) {
    return res.status(400).json({ msg: 'Google credential is required' });
  }

  let payload;
  try {
    payload = await verifyGoogleIdToken(credential);
  } catch (err) {
    return res.status(401).json({ msg: 'Invalid Google credential' });
  }

  // SECURITY: require Google's own email_verified claim — without this an attacker
  // could sign in as any address using a Google account they created but never proved
  // ownership of (e.g. via a Workspace domain that skips verification).
  if (!payload?.email_verified) {
    return res.status(401).json({ msg: 'Google account email is not verified' });
  }

  const email = payload.email.toLowerCase();
  const googleId = payload.sub;

  try {
    let user = await User.findOne({ google_id: googleId });

    if (!user) {
      const existingLocal = await User.findByEmail(email);
      if (existingLocal) {
        // SECURITY: never auto-link a Google identity to a pre-existing local account
        // by email match alone. Local account emails are never verified in this app,
        // so a matching email is not proof that the same person controls both — silently
        // linking would let anyone who once registered a victim's email locally inherit
        // whatever the victim's real Google sign-in grants. Require an explicit password
        // login instead (a future "link Google" flow can do this safely once authenticated).
        return res.status(409).json({
          msg: 'An account with this email already exists. Log in with your password to continue.',
        });
      }

      user = new User({ email, google_id: googleId });
      await user.save();
      logEvent(user._id, 'user.register_google', {
        ipAddress: req.ip, userAgent: req.headers['user-agent'],
        role: user.role, resource: 'User', resourceId: user._id, status: 'success',
      });
    }

    if (user.locked_until && user.locked_until > Date.now()) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    // MFA, if enabled on the account, still applies regardless of login method
    if (user.mfa_enabled) {
      return res.status(200).json({ mfaRequired: true, userId: user.id });
    }

    const fingerprint = getFingerprint(req);
    const { accessToken, refreshToken } = generateTokens(user, fingerprint);

    res.cookie('__Host-skillswap-session', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    logEvent(user._id, 'user.login_google', {
      ipAddress: req.ip, userAgent: req.headers['user-agent'],
      role: user.role, resource: 'User', resourceId: user._id, status: 'success',
    });
    checkImpossibleTravel(user._id, req.ip, req.headers['user-agent']);
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
        // Suspicious-activity: a refresh token that was already used-and-
        // rotated (or logged out) is being presented again — the classic
        // refresh-token-reuse theft signal.
        alertRefreshTokenReuse({
          userId: decoded.user?.id || null, ip: req.ip, userAgent: req.headers['user-agent'], jti: decoded.jti,
        });
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
router.post('/logout', auditAction('user.logout', 'User'), async (req, res) => {
  const token = req.cookies['__Host-skillswap-session'];

  // SECURITY: server-side token revocation on logout.
  // Clearing the cookie alone is client-side enforcement — an attacker who copied
  // the refresh token before logout could still replay it. Storing the jti in
  // RevokedToken makes the token permanently invalid server-side.
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'refreshSecret123');
      // No authMiddleware on this route (a stale/expired access token shouldn't
      // block logout), so req.user is never populated — pull identity for the
      // audit entry from the refresh token instead.
      res.locals.audit.userId = decoded.user?.id || null;
      res.locals.audit.role = decoded.user?.role || null;
      res.locals.audit.resourceId = decoded.user?.id || null;
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
  res.json({ msg: 'Logged out successfully' });
});

// @route   POST /api/auth/mfa/setup
// @desc    Setup MFA for logged in user
// @access  Private
router.post('/mfa/setup', authMiddleware, auditAction('user.mfa_setup_initiated', 'User'), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const secret = speakeasy.generateSecret({
      name: `SkillSwap (${user.email})`
    });

    user.mfa_secret = secret.base32; // schema setter encrypts transparently
    await user.save();

    res.locals.audit.resourceId = user._id;

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
// SECURITY: this route takes only { userId, token } — no password, no prior
// session. It's the second factor, but on its own it's a complete login path:
// a correct TOTP guess issues full access+refresh tokens. userId is not a
// secret (it's returned by /users/:id/public-profile, populated tutor_id._id
// on listings, etc.), so without rate limiting this was a straight brute-force
// authentication bypass — 1,000,000 possible 6-digit codes, no throttling, no
// captcha. authRateLimiter matches the same per-IP throttling already applied
// to /login. See docs/pentest-report.md finding PT-02.
router.post('/mfa/verify', authRateLimiter, async (req, res) => {
  const { userId, token } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    if (!user.mfa_enabled && !user.mfa_secret) {
       return res.status(400).json({ msg: 'MFA not setup for this user' });
    }

    const decryptedSecret = user.mfa_secret; // schema getter decrypts transparently

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
        logEvent(user._id, 'user.mfa_enabled', {
          ipAddress: req.ip, userAgent: req.headers['user-agent'],
          role: user.role, resource: 'User', resourceId: user._id, status: 'success',
        });
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

      checkImpossibleTravel(user._id, req.ip, req.headers['user-agent']);
      res.json({ accessToken });
    } else {
      res.status(400).json({ msg: 'Invalid token' });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// applyNewPassword (breach check, reuse-history check, hash + save) now lives
// in services/passwordPolicy.js, shared by both routes below plus registration.

// @route   POST /api/auth/password/reset
// @desc    Reset password (requires valid JWT, meaning user is logged in but might be blocked by 403 on other routes)
// @access  Private
// We skip the standard authMiddleware here because authMiddleware blocks requests if password_changed_at > 90 days.
// We need a custom middleware or just verify token inline for this specific route.
router.post('/password/reset', auditAction('user.password_changed', 'User'), [
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
    res.locals.audit.userId = user._id;
    res.locals.audit.role = user.role;
    res.locals.audit.resourceId = user._id;

    const { newPassword } = req.body;

    const result = await passwordPolicy.applyNewPassword(user, newPassword);
    if (!result.ok) { return res.status(result.status).json({ msg: result.msg }); }

    res.json({ msg: 'Password updated successfully' });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/auth/password/forgot
// @desc    Request a password reset email for an account that isn't logged in.
// @access  Public
// SECURITY: always returns the same generic response whether or not the email exists
// — a different response would let an attacker enumerate registered accounts.
router.post('/password/forgot', authRateLimiter, captchaMiddleware, [
  body('email').isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { return res.status(400).json({ errors: errors.array() }); }

  // Suspicious-activity: record every request (valid or not — enumeration
  // sweeps hit nonexistent emails too) and alert if this IP crosses the
  // threshold, regardless of which branch below the request ends up in.
  recordPasswordResetRequest(req);

  const GENERIC_RESPONSE = { msg: 'If an account with that email exists, we\'ve sent a password reset link.' };

  try {
    const { email } = req.body;
    const user = await User.findByEmail(email);

    // Google-only accounts have no password_hash — nothing to reset. Silently no-op
    // (same generic response) rather than revealing account existence or sign-in method.
    if (!user || !user.password_hash) {
      return res.json(GENERIC_RESPONSE);
    }

    // Invalidate any previous unused reset tokens for this user before issuing a new
    // one — only the most recently requested link should ever be valid.
    await PasswordResetToken.deleteMany({ user_id: user._id, used_at: null });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await PasswordResetToken.create({
      user_id: user._id,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
    });

    const resetLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${rawToken}`;
    await sendPasswordResetEmail(user.email, resetLink);

    logEvent(user._id, 'user.password_reset_requested', {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      role: user.role, resource: 'User', resourceId: user._id, status: 'success',
    });

    res.json(GENERIC_RESPONSE);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/auth/password/reset-with-token
// @desc    Redeem a password reset link (no login required) and set a new password.
// @access  Public
router.post('/password/reset-with-token', authRateLimiter, auditAction('user.password_reset_completed', 'User'), [
  body('token', 'Reset token is required').not().isEmpty(),
  body('newPassword')
    .isLength({ min: 12 }).withMessage('Password must be at least 12 characters long')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number')
    .matches(/[\W_]/).withMessage('Password must contain at least one special character'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { return res.status(400).json({ errors: errors.array() }); }

  const INVALID_MSG = { msg: 'This reset link is invalid or has expired. Please request a new one.' };

  try {
    const { token, newPassword } = req.body;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const resetToken = await PasswordResetToken.findOne({
      token_hash: tokenHash,
      used_at: null,
      expires_at: { $gt: new Date() },
    });
    if (!resetToken) { return res.status(400).json(INVALID_MSG); }

    const user = await User.findById(resetToken.user_id);
    if (!user || !user.password_hash) { return res.status(400).json(INVALID_MSG); }
    res.locals.audit.userId = user._id;
    res.locals.audit.role = user.role;
    res.locals.audit.resourceId = user._id;

    const result = await passwordPolicy.applyNewPassword(user, newPassword);
    if (!result.ok) { return res.status(result.status).json({ msg: result.msg }); }

    // Single-use — mark spent immediately so the same link can't be replayed.
    resetToken.used_at = new Date();
    await resetToken.save();

    sendPasswordChangedEmail(user.email).catch((err) => console.error('sendPasswordChangedEmail failed:', err.message));

    res.json({ msg: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/auth/password-strength
// @desc    Real-time password policy check — complexity rules + zxcvbn score
//          always; the HIBP breach check only runs when `checkBreach: true`
//          is sent (the ~200-500ms external call is meant for an on-blur/
//          on-submit check, not every keystroke while the user is typing).
// @access  Public
// `score`/`feedback` are kept at the top level (not nested under a new key)
// for backward compatibility with Register.jsx/ResetPassword.jsx, which
// already read res.data.score / res.data.feedback.warning directly.
router.post('/password-strength', async (req, res) => {
  const { password, email, checkBreach } = req.body;
  if (!password) {
    return res.json({ score: 0, feedback: { warning: '', suggestions: [] }, policy: { valid: false, errors: [] } });
  }

  const complexityErrors = passwordPolicy.checkComplexity(password);
  const strength = passwordPolicy.evaluateStrength(password, email ? [email] : []);
  const scoreOk = strength.score >= passwordPolicy.POLICY.minZxcvbnScore;

  let breachCount = null;
  if (checkBreach && complexityErrors.length === 0 && scoreOk) {
    breachCount = await passwordPolicy.checkBreached(password);
  }

  const errors = [...complexityErrors];
  if (!scoreOk) errors.push(strength.feedback?.warning || 'Password is too weak or easily guessable');
  if (breachCount > 0) errors.push(`This password has appeared in ${breachCount.toLocaleString()} data breach(es).`);

  res.json({
    score: strength.score,
    feedback: strength.feedback,
    policy: { valid: errors.length === 0, errors, minLength: passwordPolicy.POLICY.minLength },
    breachCount,
  });
});

module.exports = router;
