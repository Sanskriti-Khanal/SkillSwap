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

*(To be completed in Phase 7.)*

---

## Pen Test Findings (Phase 8)

*(To be completed in Phase 8.)*
