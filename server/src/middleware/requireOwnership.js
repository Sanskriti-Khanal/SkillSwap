// SECURITY: Generic IDOR (Insecure Direct Object Reference) protection.
//
// PROBLEM: a route like `PATCH /api/bookings/:id/cancel` takes an ID
// straight from the URL. Without a server-side ownership check, any
// authenticated user can act on ANY other user's resource just by guessing
// or enumerating IDs — this is CWE-639 / OWASP API1:2023 (Broken Object
// Level Authorization), the single most common API vulnerability class.
//
// This app already defends against it, but the check was hand-written and
// slightly different in every route (see e.g. the old bookings.js confirm/
// cancel handlers, or the accidental `{ _id: req.params.id, _id: req.user.id }`
// duplicate-object-key bug in users.js's /:id/profile route — the second
// `_id` silently overwrote the first, so the query itself enforced nothing;
// only the explicit `if` check above it actually protected the route).
// Centralizing the check in one reviewed, tested place means every route
// that uses it gets the same guarantee, and a future route can't forget it
// or get the field name wrong.
//
// Usage:
//   router.patch('/:id/cancel', authMiddleware,
//     requireOwnership(Booking, { ownerFields: ['learner_id', 'tutor_id'], resourceName: 'Booking' }),
//     async (req, res) => { const booking = req.resource; ... })
//
// `req.resource` is set to the fetched document on success, so the handler
// never needs to re-fetch it — one DB round-trip instead of two, and the
// object the ownership check examined is guaranteed to be the same object
// the handler acts on (no TOCTOU gap between a separate check and a
// separate fetch).
//
// A 403 here is automatically picked up by the global repeated-access-
// denied monitor (middleware/securityMonitor.js → services/securityMonitor.js)
// — this middleware doesn't need its own logging call for that. It does log
// its own IDOR-specific audit trail entry (distinct action name) so a
// review of "who tried to access resources they don't own" doesn't have to
// be reconstructed from generic 403s mixed in with expired-token noise.
const { logEvent } = require('../services/logger');

function requireOwnership(Model, { idParam = 'id', ownerFields, resourceName, allowAdmin = false } = {}) {
  if (!ownerFields) throw new Error('requireOwnership: ownerFields is required');
  const owners = Array.isArray(ownerFields) ? ownerFields : [ownerFields];
  const label = resourceName || Model.modelName || 'Resource';

  return async (req, res, next) => {
    try {
      const doc = await Model.findById(req.params[idParam]);
      if (!doc) {
        return res.status(404).json({ msg: `${label} not found` });
      }

      const isOwner = owners.some((field) => {
        const value = doc[field];
        return value != null && value.toString() === req.user.id;
      });
      const isAdmin = allowAdmin && req.user.role === 'admin';

      if (!isOwner && !isAdmin) {
        logEvent(req.user.id, 'idor.access_denied', {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          role: req.user.role,
          resource: label,
          resourceId: doc._id,
          status: 'failure',
          ownerFields: owners,
        });
        return res.status(403).json({ msg: `Forbidden: you do not have access to this ${label.toLowerCase()}` });
      }

      req.resource = doc;
      next();
    } catch (err) {
      if (err.kind === 'ObjectId') {
        return res.status(404).json({ msg: `${label} not found` });
      }
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  };
}

module.exports = requireOwnership;
