# SkillSwap — Security Decisions

This document records the rationale behind every significant security decision made during development.

---

## Phase 1 — Foundation

### Helmet + CSP
Helmet is applied globally and sets `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and HSTS. A Content Security Policy restricts script sources to `'self'` to mitigate XSS.

### Parameterised queries
All database operations use Mongoose's parameterised query API. Raw string concatenation into queries is forbidden and enforced via ESLint's `eslint-plugin-security` rule `security/detect-possible-timing-attacks` and manual review.

### CORS
In development, CORS is restricted to the Vite dev server (`http://localhost:5173`). In production it is restricted to the deployed frontend origin. Wildcards (`*`) are never used.

---

## Phase 2 — Authentication

### bcrypt cost factor 12
A cost factor of 12 requires ~250 ms per hash on a modern server, making offline brute-force attacks cost-prohibitive while staying within acceptable latency for login.

### JWT access token lifetime (15 minutes)
Short-lived access tokens limit the window of exposure if a token is stolen. A 7-day refresh token (HttpOnly, Secure, SameSite=Strict cookie) allows seamless re-authentication without re-login.

### Refresh token rotation
Each refresh token is single-use. The old token is invalidated before a new one is issued, preventing replay attacks if a refresh token is intercepted.

### TOTP secret AES-256 encryption at rest
TOTP secrets are encrypted before storage. If the database is compromised, secrets cannot be used to generate valid OTPs without the encryption key, which is stored separately in the environment.

### Device fingerprint binding
JWTs include a hash of the user-agent and IP address. Requests where the fingerprint does not match are rejected, mitigating token theft across different devices/networks.

### Password history
The last 5 password hashes are stored. Reuse is rejected on registration and password change, preventing users from cycling back to compromised passwords.

### 90-day password expiry
All protected routes check `password_changed_at`. If older than 90 days, a `403` is returned until the user resets their password. This limits the damage from credentials compromised in old breaches.

---

## Phase 3 — Brute-Force Protection

### Account lockout (5 attempts → 15 minutes)
After 5 consecutive failed logins, the account is locked for 15 minutes. The error message is intentionally generic — it does not reveal whether the account is locked or credentials are wrong, preventing account enumeration.

### IP blocklist
A `blocked_ips` database table is checked on every request. `127.0.0.1` and `::1` are hardcoded in an allowlist and can never be blocked, preventing accidental lockout of the server itself.

### hCaptcha on register and login
Server-side verification of the hCaptcha token prevents automated account creation and credential stuffing at the application layer.

---

## Phase 4 — RBAC & IDOR

### Mass assignment prevention
`PATCH /api/users/profile` uses an explicit field whitelist. `req.body` is never spread directly into the database update. This prevents attackers from escalating privileges by injecting `role: "admin"` into a profile update request.

### IDOR prevention
Every query for a user-owned resource includes both the resource ID and `req.user.id` in the filter (`{ _id: $id, user_id: $current_user }`). This ensures ownership is enforced at the database layer, not just the application layer.

---

## Phase 5 — Listings, Bookings & Reviews

### Double-booking prevention (two-layer)
1. An explicit `findOne` conflict check before insert surfaces a clean `409` response.
2. A unique partial index on `(listing_id, requested_time)` where `status != 'cancelled'/'refunded'` provides atomic protection against race conditions between the check and the insert.

### Business logic review checks
Three conditions are enforced server-side before a review is accepted:
- The booking must be confirmed and the session time must be in the past.
- The reviewer must be the learner on the booking.
- The reviewer must not be the tutor on the listing (no self-review).

These checks cannot be bypassed by client manipulation because they are all derived from database state, not client-supplied values.

---

## Phase 6 — Stripe Payments

### Server-side price fetching
The price passed to Stripe is always fetched from the database using the `booking_id`. Any amount sent by the client in the request body is ignored. This prevents a client from modifying the price by tampering with the request payload.

**What webhook signature verification prevents:**
Stripe signs every webhook event with a secret (`STRIPE_WEBHOOK_SECRET`). The server verifies this signature using `stripe.webhooks.constructEvent()`. Without verification, an attacker could send a forged `checkout.session.completed` event to the webhook endpoint, making the server mark a booking as paid without any actual payment occurring.

### Idempotency keys
Every Stripe API call includes an `idempotencyKey` built from `bookingId + '-' + attemptNumber`. If a request is retried due to a network error, Stripe will return the result of the original call rather than creating a duplicate charge.

### Supply chain risk — Stripe SDK
The Stripe Node.js SDK is pinned in `package-lock.json`, which records the exact resolved version and integrity hash of every transitive dependency. Risks to mitigate in production:
- **Dependency confusion attacks**: ensure `stripe` is always resolved from the public npm registry, not an internal registry with a malicious package.
- **Version pinning**: do not use `^` in production `package.json` for security-critical packages; pin to an exact version.
- **Subresource integrity**: run `npm audit` in CI on every push (enforced by `.github/workflows/ci.yml`) to catch known vulnerabilities in the SDK and its dependencies.

### Refund atomicity
The Stripe refund is issued first. If the subsequent database update fails, the refund exists in Stripe and can be reconciled manually via the Stripe dashboard. This is preferable to the reverse order (update DB first, then refund), which could mark a booking as refunded without the money ever leaving Stripe.

---

## Logging (Phase 7)

### Why logs must never contain raw tokens or password hashes
If a token appears in a log file, an attacker with log-read access can replay it. If a bcrypt hash appears in a log, it can be subjected to offline brute-force. The `scrubPII` function in `logger.js` strips the fields `password`, `token`, `secret`, `refreshToken`, `cardNumber`, `cvv`, and `totpSecret` from any metadata object before the log entry is written. This is enforced by a Jest regression test (`tests/logger.test.js`).

### Log rotation and protection in production
- Use a log rotation tool such as `winston-daily-rotate-file` or an external log aggregator (e.g. Datadog, CloudWatch, Loki) so that `app.log` does not grow unbounded.
- Restrict filesystem permissions on `server/logs/` to the process user only (`chmod 700`).
- Never commit log files — `server/logs/` is in `.gitignore`. The `logs/.gitkeep` file tracks the directory itself.
- In production, ship logs to a centralised, tamper-evident store rather than the local filesystem.

### Brute-force alert
Failed login attempts are recorded in a `LoginAttempt` collection with a 10-minute MongoDB TTL index. When 3 or more failed attempts from the same IP are detected within that window, a WARN-level log entry is written. In production, wire this to an email alert via `nodemailer` or SendGrid by adding a `transporter.sendMail()` call in the handler (see the comment in `server/src/routes/auth.js`).

---

## Pen Test Findings (Phase 8)

Six vulnerabilities were identified via white-box code review and fixed. Full details including CVSS v3.1 vectors, attack payloads, and retest evidence are in [`docs/pentest-findings.md`](pentest-findings.md).

| # | Vulnerability | CVSS | Fix location |
|---|---|---|---|
| 1 | NoSQL injection — keyword search | 9.8 Critical | `listings.js` — string cast + regex escape |
| 2 | Stored XSS — bio field | 8.0 High | `users.js` — added xss-clean middleware |
| 3 | CSRF — booking endpoints | 8.8 High | `csrf.js` middleware + Axios interceptor |
| 4 | Free session bypass — confirm without payment | 8.1 High | `bookings.js` — `payment_status === 'paid'` check |
| 5 | CSP `unsafe-inline` in styleSrc | 6.1 Medium | `security.js` — removed unsafe-inline, added base-uri |
| 6 | Cookie prefix missing | 5.9 Medium | `auth.js` — renamed to `__Host-skillswap-session` |

---

## Phase 9 — Distinction Hardening

### Refresh Token Revocation List (JTI blacklist)
Clearing the `__Host-skillswap-session` cookie on logout is client-side enforcement only. An attacker who copies the refresh token before logout can replay it within its 7-day lifetime. Fix: each token carries a `jti` (JWT ID, a 16-byte random hex string). On logout and on each rotation, the `jti` is stored in the `RevokedToken` MongoDB collection with a TTL index that auto-deletes entries after 7 days (matching the token lifetime). The `/refresh` endpoint rejects any token whose `jti` is revoked.

**OWASP A07:2021** — Identification and Authentication Failures.

### Role in JWT Payload
The JWT payload previously contained only `{ user: { id } }`. The `rbac.js` middleware reads `req.user.role` — which was always `undefined`, meaning RBAC checks for `tutor` and `learner` roles silently failed. Fix: `generateTokens()` now includes `{ user: { id, role } }`. The 15-minute access token lifetime limits the window where a stale role (after demotion) could be exploited.

### HaveIBeenPwned k-Anonymity Breach Check
A password satisfying all complexity rules can still be in breach databases. `hibpService.js` implements the HIBP range API: only the first 5 hex characters of the password's SHA-1 hash are sent to the API; the full hash is never transmitted. Applied on both registration and password reset. Fails open (allows the operation) if the HIBP API is unreachable. **OWASP A07:2021**.

### Progressive Lockout Backoff
Previously: a flat 15-minute lockout after every 5 failures. Now: the lockout duration doubles with each consecutive lockout cycle (5 attempts → 15 min, 10 → 30 min, 15 → 60 min, capped at 120 min). This makes automated bypass attempts exponentially more costly while recovering automatically for genuine users.

### express-mongo-sanitize
Wired globally in `app.js` after body parsing. Strips MongoDB operator keys (`$where`, `$gt`, `$ne`, etc.) from `req.body`, `req.query`, and `req.params`. Provides defence-in-depth against NoSQL injection even if a route forgets to cast inputs to the expected type. Operators are replaced with `_` rather than silently removed to preserve the query shape for logging. **OWASP A03:2021** — Injection.

### Tamper-Evident Audit Log (Hash Chaining)
`AuditLog.js` is a MongoDB collection where each entry stores a SHA-256 hash of `(previous_hash | sequence | timestamp | userId | action | metadata)`. If any historical entry is modified or deleted, all subsequent hashes become invalid. The chain is verifiable via `GET /api/admin/audit-chain/verify` (admin-only). Inspired by certificate transparency and blockchain log integrity. **OWASP A09:2021** — Security Logging and Monitoring Failures.

### Account Deletion (GDPR Right to Erasure)
`DELETE /api/users/me` requires password confirmation (preventing CSRF-assisted deletion). It cascade-deletes password history and bookings, revokes the active refresh token, and clears the session cookie. **UK GDPR Article 17** — Right to Erasure.

### Body Size Limit
`express.json({ limit: '10kb' })` added globally. Without a size limit, an attacker could send a 100 MB JSON body to exhaust memory or CPU during JSON parsing. **OWASP A05:2021** — Security Misconfiguration.

### Environment Variable Validation
`validateEnv.js` runs before the Express app starts. In production, it exits with code 1 if any of `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`, `MONGO_URI`, `STRIPE_SECRET_KEY`, or `STRIPE_WEBHOOK_SECRET` are missing. It also validates that `ENCRYPTION_KEY` is exactly 32 bytes and `JWT_SECRET` is at least 32 characters. Prevents silent fallback to insecure hardcoded defaults.

### DevSecOps CI Pipeline
`.github/workflows/security.yml` runs on every push and PR to `main`:
- **npm audit** — flags HIGH/CRITICAL CVEs in dependencies (OWASP A06:2021)
- **CodeQL** — GitHub's semantic SAST for JavaScript/Node.js
- **Semgrep** — pattern-based SAST with `p/nodejs`, `p/owasp-top-ten`, and `p/jwt` rulesets
- **Gitleaks** — secret scanning across full git history
- **Trivy** — CVE scanning of the Docker image (base OS + npm packages)
- **OWASP ZAP baseline** — passive DAST scan against the running server

All HIGH/CRITICAL findings fail the build. This makes security a merge gate, not an afterthought.

### STRIDE Threat Model
Full threat model in `docs/threat-model.md` covering all six STRIDE categories, asset inventory, data flow diagram, trust boundaries, abuse cases, zero trust architecture mapping, and Argon2id migration strategy.
