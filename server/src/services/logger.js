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
 * @param {object} metadata  additional context — PII is automatically scrubbed
 */
function logEvent(userId, action, metadata = {}) {
  const { ipAddress, userAgent, ...rest } = metadata;
  logger.info({
    message: action,
    userId: userId || null,
    action,
    ipAddress: ipAddress || null,
    userAgent: userAgent || null,
    metadata: scrubPII(rest),
  });

  // Write tamper-evident entry to MongoDB asynchronously (non-blocking)
  writeTamperEvidentLog(userId, action, { ipAddress, userAgent, ...scrubPII(rest) });
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

async function writeTamperEvidentLogEntry(userId, action, metadata = {}) {
  try {
    // Lazy require to avoid circular dependency during app boot
    const AuditLog = require('../models/AuditLog');

    // Find the last entry to get the chain tip (sequence + hash)
    const last = await AuditLog.findOne({}).sort({ sequence: -1 }).lean();
    const sequence = last ? last.sequence + 1 : 1;
    const previous_hash = last ? last.hash : '0'.repeat(64);
    const timestamp = new Date();

    // Hash covers all fields — any tampering with content, order, or previous_hash is detectable
    const hashInput = `${previous_hash}|${sequence}|${timestamp.toISOString()}|${userId || ''}|${action}|${JSON.stringify(metadata)}`;
    const hash = crypto.createHash('sha256').update(hashInput).digest('hex');

    await AuditLog.create({ sequence, timestamp, userId: userId || null, action, metadata, hash, previous_hash });
  } catch (err) {
    logger.error({ message: 'audit_chain.write_failed', action: 'audit_chain.write_failed', error: err.message });
  }
}

/**
 * Verify the integrity of the entire audit log chain.
 * Returns { valid: true } if unmodified, or { valid: false, brokenAt: sequence } if tampered.
 * Call this from an admin endpoint or a scheduled integrity check.
 */
async function verifyAuditChain() {
  const AuditLog = require('../models/AuditLog');
  const entries = await AuditLog.find({}).sort({ sequence: 1 }).lean();

  let expected_previous = '0'.repeat(64);
  for (const entry of entries) {
    if (entry.previous_hash !== expected_previous) {
      return { valid: false, brokenAt: entry.sequence };
    }
    const hashInput = `${entry.previous_hash}|${entry.sequence}|${new Date(entry.timestamp).toISOString()}|${entry.userId || ''}|${entry.action}|${JSON.stringify(entry.metadata)}`;
    const computed = crypto.createHash('sha256').update(hashInput).digest('hex');
    if (computed !== entry.hash) {
      return { valid: false, brokenAt: entry.sequence };
    }
    expected_previous = entry.hash;
  }
  return { valid: true, totalEntries: entries.length };
}

module.exports = { logger, logEvent, scrubPII, PII_FIELDS, verifyAuditChain };
