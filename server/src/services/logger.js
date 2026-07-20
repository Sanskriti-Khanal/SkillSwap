const { createLogger, format, transports } = require('winston');
const path = require('path');
const crypto = require('crypto');

const { combine, timestamp, json, colorize, printf } = format;

// PII fields stripped before any log is written
const PII_FIELDS = ['password', 'token', 'secret', 'refreshToken', 'cardNumber', 'cvv', 'totpSecret'];

function scrubPII(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const scrubbed = Array.isArray(obj) ? [...obj] : { ...obj };
  for (const key of Object.keys(scrubbed)) {
    if (PII_FIELDS.includes(key)) {
      scrubbed[key] = '[REDACTED]';
    } else if (typeof scrubbed[key] === 'object') {
      scrubbed[key] = scrubPII(scrubbed[key]);
    }
  }
  return scrubbed;
}

const consoleFormat = combine(
  colorize(),
  timestamp(),
  printf(({ timestamp, level, userId, action, ipAddress, userAgent, metadata }) =>
    `${timestamp} [${level}] userId=${userId || '-'} action=${action} ip=${ipAddress || '-'} ${JSON.stringify(metadata || {})}`
  )
);

const fileFormat = combine(timestamp(), json());

const logger = createLogger({
  level: 'info',
  transports: [
    new transports.File({
      filename: path.join(__dirname, '../../logs/app.log'),
      format: fileFormat,
    }),
  ],
});

// Colourised console transport only in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({ format: consoleFormat }));
}

/**
 * Log a structured audit event.
 * @param {string|null} userId
 * @param {string} action  e.g. 'user.login', 'booking.created'
 * @param {object} metadata  additional context — PII is automatically scrubbed.
 *   Recognized first-class fields (stored as real AuditLog columns, not
 *   buried in the metadata blob): `role`, `resource`, `resourceId`,
 *   `status` ('success' | 'failure', defaults to 'success'), `ipAddress`,
 *   `userAgent`. Everything else in `metadata` is scrubbed and stored as
 *   free-form context.
 */
function logEvent(userId, action, metadata = {}) {
  const { ipAddress, userAgent, role, resource, resourceId, status, ...rest } = metadata;
  logger.info({
    message: action,
    userId: userId || null,
    action,
    ipAddress: ipAddress || null,
    userAgent: userAgent || null,
    metadata: scrubPII(rest),
  });

  // Write tamper-evident entry to MongoDB asynchronously (non-blocking)
  writeTamperEvidentLog(userId, action, {
    role, resource, resourceId, status, ipAddress, userAgent, ...scrubPII(rest),
  });
}

// Writes must be strictly serialized: each entry's previous_hash has to match
// the immediately preceding entry's hash, so two writes can never be in flight
// at once or they'll read the same chain tip and collide on `sequence`.
let auditChainQueue = Promise.resolve();

/**
 * Append a hash-chained entry to the AuditLog collection.
 * Each entry's hash covers the previous_hash + its own content,
 * so any deletion or modification of past entries breaks the chain.
 * Errors are logged to Winston but never thrown — audit log failures must
 * not interrupt the request that triggered the event.
 */
function writeTamperEvidentLog(userId, action, metadata = {}) {
  auditChainQueue = auditChainQueue.then(() =>
    writeTamperEvidentLogEntry(userId, action, metadata)
  );
  return auditChainQueue;
}

// Current hash formula version. Bump this — and add a new `case` in
// computeHash — if the fields covered by the hash ever need to change
// again. NEVER edit the CURRENT_SCHEMA_VERSION case's field list after
// entries of that version exist in production; that silently invalidates
// every entry already written with it.
const CURRENT_SCHEMA_VERSION = 2;

// Computes the hash for one entry given its (already-resolved) field values.
// Called both when writing a new entry and when re-verifying an old one, so
// write and verify can never drift apart into two copies of the same logic.
function computeHash(version, entry) {
  const { previous_hash, sequence, timestamp, userId, role, action, resource, resourceId, status, metadata } = entry;
  const ts = timestamp instanceof Date ? timestamp.toISOString() : new Date(timestamp).toISOString();
  // Mongoose silently drops a Mixed field entirely when it's set to `{}` —
  // it round-trips as `undefined`, not `{}`. Normalize both sides the same
  // way so an entry logged with no extra metadata hashes identically at
  // write time and at verify time (rather than "{}" vs "undefined"→"").
  const metaJson = JSON.stringify(metadata || {});
  switch (version) {
    case 1:
      // Original formula, from before role/resource/resourceId/status existed.
      // `metadata` for v1 entries still contains ipAddress/userAgent inline
      // (they weren't split out into top-level fields yet) — reuse it as-is.
      return crypto.createHash('sha256')
        .update(`${previous_hash}|${sequence}|${ts}|${userId || ''}|${action}|${metaJson}`)
        .digest('hex');
    case 2:
      return crypto.createHash('sha256')
        .update([previous_hash, sequence, ts, userId || '', role || '', action, resource || '', resourceId || '', status, metaJson].join('|'))
        .digest('hex');
    default:
      throw new Error(`No hash formula registered for AuditLog schemaVersion ${version}`);
  }
}

async function writeTamperEvidentLogEntry(userId, action, metadata = {}) {
  try {
    // Lazy require to avoid circular dependency during app boot
    const AuditLog = require('../models/AuditLog');

    // Pull the structured audit fields out of metadata. `ip` is the
    // persisted schema field name (per the AuditLog spec); call sites use
    // `ipAddress` (matching Express's req.ip naming) — this is the single
    // translation point, so no call site needed to change.
    const { role = null, resource = null, resourceId = null, status = 'success', ipAddress, userAgent, ...rest } = metadata;
    const ip = ipAddress || null;

    // Find the last entry to get the chain tip (sequence + hash)
    const last = await AuditLog.findOne({}).sort({ sequence: -1 }).lean();
    const sequence = last ? last.sequence + 1 : 1;
    const previous_hash = last ? last.hash : '0'.repeat(64);
    const timestamp = new Date();

    const hash = computeHash(CURRENT_SCHEMA_VERSION, {
      previous_hash, sequence, timestamp, userId, role, action, resource, resourceId, status, metadata: rest,
    });

    await AuditLog.create({
      sequence, timestamp, schemaVersion: CURRENT_SCHEMA_VERSION, userId: userId || null, role, action,
      resource, resourceId, status, ip, userAgent: userAgent || null, metadata: rest, hash, previous_hash,
    });
  } catch (err) {
    logger.error({ message: 'audit_chain.write_failed', action: 'audit_chain.write_failed', error: err.message });
  }
}

/**
 * Verify the integrity of the entire audit log chain.
 * Returns { valid: true } if unmodified, or { valid: false, brokenAt: sequence } if tampered.
 * Call this from an admin endpoint or a scheduled integrity check.
 *
 * Each entry is re-hashed with the formula matching ITS OWN schemaVersion
 * (entries written before role/resource/resourceId/status existed are
 * version 1 and stay verifiable under the original formula forever — see
 * computeHash). The previous_hash → hash LINK between entries works
 * uniformly across the version boundary regardless of which formula
 * produced either side, since a link only compares "does this entry's
 * declared previous_hash equal the prior entry's actual stored hash".
 */
async function verifyAuditChain() {
  const AuditLog = require('../models/AuditLog');
  const entries = await AuditLog.find({}).sort({ sequence: 1 }).lean();

  let expected_previous = '0'.repeat(64);
  for (const entry of entries) {
    if (entry.previous_hash !== expected_previous) {
      return { valid: false, brokenAt: entry.sequence };
    }
    const computed = computeHash(entry.schemaVersion || 1, entry);
    if (computed !== entry.hash) {
      return { valid: false, brokenAt: entry.sequence };
    }
    expected_previous = entry.hash;
  }
  return { valid: true, totalEntries: entries.length };
}

module.exports = { logger, logEvent, scrubPII, PII_FIELDS, verifyAuditChain };
