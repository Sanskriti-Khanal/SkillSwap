const { logEvent } = require('../services/logger');

// Express middleware factory that makes audit logging automatic instead of
// a hand-written `logEvent(...)` call duplicated in every route handler.
//
// Usage — the common case, zero overrides needed:
//   router.patch('/:id/cancel', authMiddleware, auditAction('booking.cancelled', 'Booking'), handler)
//   → logs once the response finishes, with resourceId taken from req.params.id,
//     userId/role taken from req.user, status derived from the HTTP status code.
//
// Usage — a POST/create route, where there's no req.params.id yet:
//   router.post('/', authMiddleware, auditAction('listing.created', 'Listing'), async (req, res) => {
//     const listing = await Listing.create(...);
//     res.locals.audit.resourceId = listing._id;   // only line the handler needs to add
//     res.status(201).json(listing);
//   })
//
// Any field can be overridden from inside the handler by mutating
// `res.locals.audit` before responding: `.action`, `.resource`, `.resourceId`,
// `.userId`, `.role`, `.status` ('success' | 'failure'), `.metadata` (object,
// merged into the log's free-form metadata), and `.skip` (set `true` to
// suppress logging entirely for this response — e.g. a validation error that
// bailed out before anything audit-worthy happened).
//
// Logging itself happens on the `finish` event — after the response has
// already been written to the socket — and `logEvent`'s own Mongo write is
// an async, non-blocking, serialized queue (see services/logger.js). So this
// middleware never adds latency to the request it's auditing.
//
// Intentionally NOT used for routes with multiple business-logic-determined
// outcomes decided deep inside the handler (e.g. login: wrong-password vs.
// account-locked vs. success are three different audit actions from one
// route, not just "did the HTTP status code say ok"). Those routes keep
// explicit `logEvent(...)` calls at each branch instead — see auth.js and
// payments.js for that pattern, using the same role/resource/resourceId/
// status fields this middleware sets automatically.
function auditAction(action, resource, options = {}) {
  const { resourceIdParam = 'id' } = options;

  return function auditActionMiddleware(req, res, next) {
    res.locals.audit = {
      action,
      resource,
      resourceId: req.params[resourceIdParam] || null,
    };

    res.on('finish', () => {
      const a = res.locals.audit;
      if (!a || a.skip) return;

      const userId = a.userId ?? req.user?.id ?? null;
      const role = a.role ?? req.user?.role ?? null;
      const status = a.status ?? (res.statusCode < 400 ? 'success' : 'failure');

      logEvent(userId, a.action, {
        role,
        resource: a.resource,
        resourceId: a.resourceId,
        status,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        ...a.metadata,
      });
    });

    next();
  };
}

module.exports = auditAction;
