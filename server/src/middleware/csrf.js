const crypto = require('crypto');

const CSRF_COOKIE = 'csrf-token';
const CSRF_HEADER = 'x-csrf-token';

// ATTACK SCENARIO (CSRF):
// An attacker hosts a page at https://evil.com with:
//   <form action="https://skillswap.app/api/bookings" method="POST">
//     <input name="listing_id" value="victim-listing-id" />
//     <input name="requested_time" value="2025-01-01T10:00:00Z" />
//   </form>
//   <script>document.forms[0].submit()</script>
// When the victim visits evil.com while logged in, the browser auto-sends the
// session cookie, creating a booking on the victim's behalf.
//
// FIX (double-submit cookie pattern):
// 1. Server sets a random csrf-token cookie (readable by JS, SameSite=Strict)
// 2. Client reads it and echoes it in the X-CSRF-Token request header
// 3. Server verifies the header value matches the cookie value
// A cross-origin attacker cannot read the cookie (same-origin policy) and therefore
// cannot forge the header — even if the browser auto-sends the cookie.
//
// NOTE: SameSite=Strict on the __Host-skillswap-session refresh cookie already blocks
// CSRF for the refresh endpoint. This middleware adds defence-in-depth for all
// state-changing routes protected by Bearer token, in case the client ever
// switches to cookie-based auth.

function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Middleware that issues a CSRF token cookie on GET requests and
 * validates the double-submit on state-changing methods.
 */
function csrfProtection(req, res, next) {
  // Issue token on safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    if (!req.cookies[CSRF_COOKIE]) {
      const token = generateCsrfToken();
      res.cookie(CSRF_COOKIE, token, {
        httpOnly: false,   // Must be readable by JS so the client can echo it
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
      });
    }
    return next();
  }

  // Validate token on mutating methods
  const cookieToken = req.cookies[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ msg: 'CSRF token missing or invalid' });
  }

  next();
}

module.exports = { csrfProtection, CSRF_COOKIE, CSRF_HEADER };
