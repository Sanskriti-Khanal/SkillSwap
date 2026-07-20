const { recordAccessDenied, checkApiRequestRate } = require('../services/securityMonitor');

// Hooked globally (mounted early in app.js) — watches every response for a
// 403 and feeds it to the repeated-access-denied detector. Placed on `res`
// rather than in rbac.js/ipBlock.js individually so every current and future
// source of a 403 is covered by one hook, not one call site per middleware.
function accessDeniedMonitor(req, res, next) {
  res.on('finish', () => {
    if (res.statusCode === 403) recordAccessDenied(req);
  });
  next();
}

// Mounted on /api alongside apiSlowDown — feeds the excessive-API-requests
// detector (in-memory sliding window, see services/securityMonitor.js).
function apiRequestRateMonitor(req, res, next) {
  checkApiRequestRate(req.ip);
  next();
}

module.exports = { accessDeniedMonitor, apiRequestRateMonitor };
