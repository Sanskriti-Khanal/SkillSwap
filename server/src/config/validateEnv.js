// SECURITY: Fail-fast on missing critical secrets.
//
// If JWT_SECRET or ENCRYPTION_KEY are absent the server would fall back to
// hardcoded defaults ('secret123', random bytes), which:
// - In production: means every restart generates a different key, invalidating all sessions.
// - In a misconfigured container: could allow an attacker to forge tokens using the known default.
//
// This function is called before any routes are registered. If any required variable is
// missing the process exits with a non-zero code so the orchestrator (Docker, k8s, PM2)
// can alert the operator rather than silently running in an insecure state.
// OWASP A05:2021 – Security Misconfiguration.

const REQUIRED_IN_PRODUCTION = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'ENCRYPTION_KEY',
  'MONGO_URI',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
];

function validateEnv() {
  if (process.env.NODE_ENV !== 'production') {
    // In development, warn but do not exit — allows running without a full .env
    const missing = REQUIRED_IN_PRODUCTION.filter((k) => !process.env[k]);
    if (missing.length > 0) {
      console.warn(`[WARN] Missing env vars (using insecure defaults): ${missing.join(', ')}`);
    }
    return;
  }

  const missing = REQUIRED_IN_PRODUCTION.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`[FATAL] Missing required environment variables in production: ${missing.join(', ')}`);
    process.exit(1);
  }

  // Validate key lengths
  if (process.env.ENCRYPTION_KEY && Buffer.from(process.env.ENCRYPTION_KEY, 'hex').length !== 32) {
    console.error('[FATAL] ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters)');
    process.exit(1);
  }

  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.error('[FATAL] JWT_SECRET must be at least 32 characters');
    process.exit(1);
  }
}

module.exports = validateEnv;
