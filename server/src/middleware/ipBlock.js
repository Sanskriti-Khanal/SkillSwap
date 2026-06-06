const BlockedIP = require('../models/BlockedIP');

const ALLOWLIST = ['127.0.0.1', '::1'];

module.exports = async function (req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;

  if (ALLOWLIST.includes(ip)) {
    return next();
  }

  try {
    const isBlocked = await BlockedIP.findOne({ ip_address: ip });
    if (isBlocked) {
      return res.status(403).json({ msg: 'Access denied. Your IP has been blocked.' });
    }
    next();
  } catch (err) {
    console.error('IP Block Middleware Error:', err);
    next(); // Fail open or closed? Fail open to not block legitimate traffic on DB error.
  }
};
