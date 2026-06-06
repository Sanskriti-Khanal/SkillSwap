const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');

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
      return res.status(401).json({ msg: 'Token validation failed (Fingerprint mismatch)' });
    }

    req.user = decoded.user;

    // Check password expiry (90 days)
    const user = await User.findById(req.user.id).select('password_changed_at');
    if (!user) {
      return res.status(401).json({ msg: 'User not found' });
    }

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    if (user.password_changed_at < ninetyDaysAgo) {
      return res.status(403).json({ msg: 'Password expired — please reset' });
    }

    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};
