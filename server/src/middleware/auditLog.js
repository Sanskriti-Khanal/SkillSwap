const { logEvent, scrubPII } = require('../services/logger');

/**
 * Express middleware that logs every incoming request as an audit event.
 * PII scrubbing is applied to the body before logging.
 */
function auditLog(req, res, next) {
  const userId = req.user?.id || null;
  const action = `http.${req.method.toLowerCase()}.${req.path.replace(/\//g, '.').replace(/^\./, '')}`;
  const metadata = {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    body: scrubPII({ ...req.body }),
  };
  logEvent(userId, action, metadata);
  next();
}

module.exports = auditLog;
