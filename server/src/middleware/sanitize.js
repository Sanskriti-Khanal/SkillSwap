const xss = require('xss');

// Replacement for the deprecated xss-clean package, which crashes on Express 5
// because it tries to overwrite req.query (now a read-only getter).
//
// This middleware recursively sanitizes all string values in req.body using the
// `xss` package, which strips script tags and dangerous HTML attributes.
// OWASP A03:2021 – Injection / XSS.
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'string') {
      obj[key] = xss(obj[key]);
    } else if (typeof obj[key] === 'object') {
      sanitizeObject(obj[key]);
    }
  }
  return obj;
}

module.exports = function sanitizeBody(req, res, next) {
  if (req.body) sanitizeObject(req.body);
  next();
};
