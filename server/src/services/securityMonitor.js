const geoip = require('geoip-lite');
const SecurityAlert = require('../models/SecurityAlert');
const SecurityEvent = require('../models/SecurityEvent');
const LoginLocation = require('../models/LoginLocation');
const { logger } = require('./logger');

// Default severity per alert type, used whenever a caller doesn't override it.
const SEVERITY = {
  repeated_failed_logins: 'medium',
  repeated_access_denied: 'medium',
  jwt_reuse: 'critical',
  refresh_token_reuse: 'critical',
  excessive_password_reset_requests: 'low',
  excessive_api_requests: 'medium',
  multi_country_access: 'high',
};

// Fire-and-forget — a monitoring write must never throw into (or delay) the
// request path that triggered it. Errors go to Winston, never to the caller.
async function createAlert(type, { userId = null, ip = null, userAgent = null, details = {}, severity } = {}) {
  try {
    await SecurityAlert.create({ type, severity: severity || SEVERITY[type] || 'medium', userId, ip, userAgent, details });
  } catch (err) {
    logger.error({ message: 'security_alert.write_failed', action: 'security_alert.write_failed', error: err.message, type });
  }
}

// Suppresses duplicate alerts while an open one of the same type + identity
// (prefer userId, fall back to ip) already exists within `dedupMinutes` — a
// sustained attack should produce one actionable alert, not one per request.
async function alertOnceWithin(type, { userId, ip }, dedupMinutes, payload) {
  try {
    const since = new Date(Date.now() - dedupMinutes * 60 * 1000);
    const identity = userId ? { userId } : { ip };
    const existing = await SecurityAlert.findOne({ type, status: 'open', createdAt: { $gte: since }, ...identity }).lean();
    if (existing) return;
    await createAlert(type, payload);
  } catch (err) {
    logger.error({ message: 'security_alert.dedup_check_failed', action: 'security_alert.dedup_check_failed', error: err.message, type });
  }
}

// Generic "record an occurrence, alert if the recent count crosses a
// threshold" detector — backs any suspicious pattern that's just "too many
// of X from the same IP in a short window" (access-denied, password-reset
// requests). Adding a new threshold-shaped detector never needs a new
// collection or a new counting implementation, just a new call site.
async function recordEventAndCheckThreshold({ type, ip, userId = null, userAgent = null, threshold, windowMinutes, dedupMinutes, details = {} }) {
  try {
    await SecurityEvent.create({ type, ip, userId });
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);
    const count = await SecurityEvent.countDocuments({ type, ip, occurred_at: { $gte: since } });
    if (count > threshold) {
      await alertOnceWithin(type, { userId, ip }, dedupMinutes ?? windowMinutes, {
        userId, ip, userAgent, details: { count, windowMinutes, threshold, ...details },
      });
    }
  } catch (err) {
    logger.error({ message: 'security_monitor.threshold_check_failed', action: 'security_monitor.threshold_check_failed', error: err.message, type });
  }
}

// --- 1. More than 10 failed logins -----------------------------------------
// Called from auth.js's login route at the same "just locked" checkpoint the
// existing progressive-lockout logic already computes (every 5th failed
// attempt) — piggybacking on that cadence means this only evaluates a few
// times per lockout spree rather than on every single failed request.
function alertRepeatedFailedLogins(user, req) {
  if (user.failed_attempts <= 10) return;
  alertOnceWithin('repeated_failed_logins', { userId: user._id }, 15, {
    userId: user._id, ip: req.ip, userAgent: req.headers['user-agent'],
    details: { failed_attempts: user.failed_attempts },
  });
}

// --- 2. Access denied repeatedly --------------------------------------------
// Called from a global middleware (see middleware/accessDeniedMonitor.js)
// hooked to every 403 response, keyed by user if authenticated else IP.
function recordAccessDenied(req) {
  recordEventAndCheckThreshold({
    type: 'repeated_access_denied',
    ip: req.ip,
    userId: req.user?.id || null,
    userAgent: req.headers['user-agent'],
    threshold: 5,
    windowMinutes: 10,
    details: { path: req.originalUrl, method: req.method },
  });
}

// --- 3. JWT (access token) reuse --------------------------------------------
// Called from middleware/auth.js when a token's embedded device fingerprint
// doesn't match the request it's being used from — the token is otherwise
// cryptographically valid and unexpired, so this specifically means it's
// being replayed from somewhere other than where it was issued.
function alertJwtReuse({ userId, ip, userAgent, jti }) {
  alertOnceWithin('jwt_reuse', { userId, ip }, 15, {
    userId, ip, userAgent, details: { reason: 'fingerprint_mismatch', jti },
  });
}

// --- 4. Refresh token reuse --------------------------------------------------
// Called from auth.js's /refresh route when a refresh token's jti is found
// in RevokedToken — i.e. a token that was already used-and-rotated (or
// explicitly logged out) is being presented again, the classic
// refresh-token-rotation theft signal.
function alertRefreshTokenReuse({ userId, ip, userAgent, jti }) {
  alertOnceWithin('refresh_token_reuse', { userId, ip }, 15, {
    userId, ip, userAgent, details: { jti },
  });
}

// --- 5. Too many password reset requests ------------------------------------
function recordPasswordResetRequest(req) {
  recordEventAndCheckThreshold({
    type: 'excessive_password_reset_requests',
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    threshold: 5,
    windowMinutes: 15,
  });
}

// --- 6. Excessive API requests -----------------------------------------------
// Deliberately in-memory, not DB-backed: this runs on every /api request, so
// a Mongo write per request would add real latency and load to every call
// just to watch for a rare event. A per-IP sliding window in memory is how
// express-rate-limit itself works, and is the right cost/benefit here — the
// threshold (200/min) is well above apiSlowDown's throttle point (30/min),
// so this flags likely automation/abuse, not just a heavy legitimate user.
const API_WINDOW_MS = 60 * 1000;
const API_THRESHOLD = 200;
const apiRequestWindows = new Map(); // ip -> timestamps[]

function checkApiRequestRate(ip) {
  const now = Date.now();
  let timestamps = apiRequestWindows.get(ip);
  if (!timestamps) {
    timestamps = [];
    apiRequestWindows.set(ip, timestamps);
  }
  timestamps.push(now);
  while (timestamps.length && timestamps[0] < now - API_WINDOW_MS) timestamps.shift();

  if (timestamps.length > API_THRESHOLD) {
    alertOnceWithin('excessive_api_requests', { ip }, 5, {
      ip, details: { requestsInWindow: timestamps.length, windowMs: API_WINDOW_MS, threshold: API_THRESHOLD },
    });
  }
}

// Prevents apiRequestWindows from growing forever as new IPs show up —
// drops any IP with no requests in the last window on a slow interval.
const cleanupTimer = setInterval(() => {
  const cutoff = Date.now() - API_WINDOW_MS;
  for (const [ip, timestamps] of apiRequestWindows) {
    if (!timestamps.length || timestamps[timestamps.length - 1] < cutoff) apiRequestWindows.delete(ip);
  }
}, 5 * 60 * 1000);
cleanupTimer.unref(); // don't keep the process alive just for this

// --- 7. Multiple countries in a short period ("impossible travel") ---------
// Called from every successful-login code path (password login, Google
// login, MFA verify). Resolves the request IP to a country offline via
// geoip-lite (no external network call), records it, then checks whether
// this account has logged in from more than one distinct country within the
// last hour. Private/loopback IPs (localhost in dev) don't resolve to a
// country — the check is skipped rather than false-alarming on every local
// login.
const IMPOSSIBLE_TRAVEL_WINDOW_MINUTES = 60;

async function checkImpossibleTravel(userId, ip, userAgent) {
  try {
    const geo = geoip.lookup(ip);
    const country = geo?.country || null;
    await LoginLocation.create({ userId, ip, country });
    if (!country) return;

    const since = new Date(Date.now() - IMPOSSIBLE_TRAVEL_WINDOW_MINUTES * 60 * 1000);
    const recent = await LoginLocation.find({ userId, occurred_at: { $gte: since }, country: { $ne: null } })
      .select('country')
      .lean();
    const countries = [...new Set(recent.map((r) => r.country))];

    if (countries.length > 1) {
      await alertOnceWithin('multi_country_access', { userId }, IMPOSSIBLE_TRAVEL_WINDOW_MINUTES, {
        userId, ip, userAgent, details: { countries, withinMinutes: IMPOSSIBLE_TRAVEL_WINDOW_MINUTES },
      });
    }
  } catch (err) {
    logger.error({ message: 'security_monitor.impossible_travel_check_failed', action: 'security_monitor.impossible_travel_check_failed', error: err.message });
  }
}

module.exports = {
  alertRepeatedFailedLogins,
  recordAccessDenied,
  alertJwtReuse,
  alertRefreshTokenReuse,
  recordPasswordResetRequest,
  checkApiRequestRate,
  checkImpossibleTravel,
};
