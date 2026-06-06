const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

// Strict rate limit for auth routes: max 5 requests per minute per IP
const authRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5,
  message: { msg: 'Too many requests from this IP, please try again after a minute' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General slow down for all other /api routes
// Start slowing down after 30 requests per minute
const apiSlowDown = slowDown({
  windowMs: 1 * 60 * 1000, // 1 minute
  delayAfter: 30, // allow 30 requests per minute, then...
  delayMs: (hits) => (hits - 30) * 100, // add 100ms of delay per request above 30
});

module.exports = {
  authRateLimiter,
  apiSlowDown
};
