const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { alertJwtReuse } = require('../services/securityMonitor');
const { isPasswordExpired } = require('../services/passwordPolicy');

const getFingerprint = (req) => {
  const userAgent = req.headers['user-agent'] || '';
  const ip = req.ip || req.connection.remoteAddress;
  return crypto.createHash('sha256').update(`${userAgent}-${ip}`).digest('hex');
};

module.exports = async function (req, res, next) {
  // Get token from header
  const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');

    // Verify fingerprint
    const fingerprint = getFingerprint(req);
    if (decoded.fingerprint !== fingerprint) {
      // Suspicious-activity: a structurally valid, unexpired access token
      // being used from a different device/IP than it was issued for — the
      // token itself is fine, so this specifically means it's being reused
      // from somewhere it shouldn't be (stolen or shared).
      alertJwtReuse({
        userId: decoded.user?.id || null, ip: req.ip, userAgent: req.headers['user-agent'], jti: decoded.jti,
      });
      return res.status(401).json({ msg: 'Token validation failed (Fingerprint mismatch)' });
    }

    req.user = decoded.user;

    // Check password expiry (90 days). Also re-read role fresh from the DB rather than
    // trusting the JWT's embedded value — the token can be up to 15 minutes old, and an
    // admin action (e.g. approving a tutor application) changes the DB role immediately.
    // Without this, a user keeps hitting 403s on role-gated routes until their token
    // happens to expire/refresh or they log out and back in, even though every page that
    // reads /users/me (a fresh DB read) already shows their correct new role.
    const user = await User.findById(req.user.id).select('password_changed_at role');
    if (!user) {
      return res.status(401).json({ msg: 'User not found' });
    }
    req.user.role = user.role;

    if (isPasswordExpired(user)) {
      return res.status(403).json({ msg: 'Password expired — please reset' });
    }

    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};
