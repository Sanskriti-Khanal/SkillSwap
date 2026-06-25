# SkillSwap — STRIDE Threat Model

**Version:** 1.0  
**Date:** 2026-06-23  
**Author:** Development team  
**Methodology:** STRIDE per element (Microsoft STRIDE, adapted for OWASP Top 10)

---

## 1. System Overview

SkillSwap is a peer skill-exchange marketplace. Users register as learners, tutors, or both. Tutors create skill listings; learners book sessions and pay via Stripe. Reviews are submitted after completed sessions.

---

## 2. Asset Inventory

| Asset | Sensitivity | Location |
|---|---|---|
| User credentials (email + bcrypt hash) | HIGH | MongoDB `users` |
| TOTP secrets (AES-256 encrypted) | HIGH | MongoDB `users.mfa_secret` |
| JWT signing secret (`JWT_SECRET`) | CRITICAL | Environment variable |
| Stripe secret key | CRITICAL | Environment variable |
| Stripe webhook secret | CRITICAL | Environment variable |
| AES encryption key (`ENCRYPTION_KEY`) | CRITICAL | Environment variable |
| Session cookies (`__Host-skillswap-session`) | HIGH | Browser / HTTP-only cookie |
| Audit logs | MEDIUM | MongoDB `auditlogs` + `logs/app.log` |
| Booking/payment records | MEDIUM | MongoDB `bookings` |
| Personal data (email, bio, skills) | MEDIUM | MongoDB `users` |

---

## 3. Data Flow Diagram

```
[Browser]
    │  HTTPS (TLS)
    ▼
[React SPA] ──── Axios (Bearer token + CSRF header) ────▶ [Express API]
                                                               │
                          ┌────────────────────────────────────┤
                          │                                    │
                    [MongoDB Atlas]                    [Stripe API]
                     (users, bookings,                (checkout sessions,
                      listings, logs)                  webhooks, refunds)
```

**Trust boundaries:**
1. **Browser ↔ API**: untrusted network — all data validated server-side; TLS enforced.
2. **API ↔ MongoDB**: trusted internal network in production (Atlas VPC peering); credentials in env vars.
3. **API ↔ Stripe**: trusted HTTPS with webhook signature verification; Stripe is a PCI-DSS Level 1 provider.
4. **Webhook ↔ API**: `stripe-signature` header verified before processing — prevents forged payment events.

---

## 4. STRIDE Analysis

### 4.1 Spoofing

| Threat | Attack | Control |
|---|---|---|
| Credential theft | Attacker guesses weak password | bcrypt cost 12 + HIBP check + zxcvbn score |
| Session hijacking | Steal `__Host-skillswap-session` cookie | HttpOnly + Secure + SameSite=Strict + __Host- prefix |
| JWT replay after logout | Copy token before logout | JTI-based revocation list (RevokedToken) |
| MFA bypass | Brute-force TOTP window | speakeasy default ±1 window; rate limiter blocks rapid attempts |
| Forged webhook | Send fake Stripe event | `stripe.webhooks.constructEvent()` verifies HMAC-SHA256 signature |
| Subdomain cookie injection | cdn.skillswap.com sets `session=FORGED` | `__Host-` prefix forbids Domain attribute and subdomains |

### 4.2 Tampering

| Threat | Attack | Control |
|---|---|---|
| Audit log deletion | Attacker with DB access deletes entries | SHA-256 hash chaining — gaps or edits break the chain |
| Price manipulation | Client sends `amount=1` in payment request | Price always fetched from DB (`listing.price_per_session`) |
| Role escalation via profile update | `PATCH /profile { "role": "admin" }` | Explicit field allowlist; `role` not in allowed fields |
| Booking status bypass | Call `/confirm` without paying | `payment_status !== 'paid'` checked server-side |
| Parameter pollution | `?keyword[$ne]=x` → NoSQL injection | `express-mongo-sanitize` + explicit `String()` cast |

### 4.3 Repudiation

| Threat | Attack | Control |
|---|---|---|
| User denies creating booking | No audit trail | `logEvent(userId, 'booking.created', ...)` — tamper-evident chain |
| Admin denies role change | No admin action log | `logEvent(adminId, 'admin.role_changed', { targetUserId, previousRole, newRole })` |
| Payment denied | "I never paid" | Stripe webhook event stored with `bookingId` in AuditLog |

### 4.4 Information Disclosure

| Threat | Attack | Control |
|---|---|---|
| Password hash extraction | DB dump | bcrypt (not reversible); not returned in any API response |
| TOTP secret extraction | DB dump | AES-256-CBC encrypted at rest |
| PII in logs | Log read access | `scrubPII()` redacts password, token, secret, cardNumber, cvv |
| Stack traces | Unhandled exceptions | Global error handler returns generic "Internal Server Error" |
| User enumeration | `POST /login` → "User not found" vs "Wrong password" | Both cases return identical `{ msg: 'Invalid Credentials' }` |
| TOTP secret in QR code URL | Man-in-the-middle | TLS enforced; HSTS preload configured |

### 4.5 Denial of Service

| Threat | Attack | Control |
|---|---|---|
| Credential stuffing | 10,000 login attempts/second | `authRateLimiter`: 5 req/min per IP; progressive account lockout |
| API flooding | Exhaust server threads | `apiSlowDown`: delay after 30 req/min; `express-rate-limit` globally |
| Regex DoS (ReDoS) | `?keyword=a++++...+` | Special chars escaped before `$regex`; no catastrophic backtracking |
| Large payload | `POST /api/listings { body: 10MB }` | `express.json({ limit: '10kb' })` should be set (see recommendation) |
| Double-booking race | Concurrent POST /bookings | Unique partial index on `(listing_id, requested_time)` in MongoDB |

### 4.6 Elevation of Privilege

| Threat | Attack | Control |
|---|---|---|
| Learner becomes admin | `PATCH /profile { "role": "admin" }` | Field whitelist; role changes only via `PATCH /admin/users/:id/role` |
| IDOR — view other user booking | `GET /bookings/OTHER_USER_ID` | Ownership check: `learner_id === req.user.id || tutor_id === req.user.id` |
| Tutor reviews own listing | `POST /reviews { booking_id: own_booking }` | `req.user.id !== booking.tutor_id.toString()` enforced |
| Learner books own listing | `POST /bookings { listing_id: own_listing }` | `listing.tutor_id.toString() === req.user.id` → 400 |
| Token from different device | Stolen token replayed | Device fingerprint (SHA-256 of IP + UA) bound to JWT payload |

---

## 5. Abuse Cases

| Abuse Case | Actor | Impact | Mitigation |
|---|---|---|---|
| Free session (no payment) | Learner | Financial loss for tutor | `payment_status === 'paid'` required to confirm |
| Fake payment webhook | External attacker | Mark booking paid without payment | Stripe HMAC signature verification |
| Mass account registration | Bot | SPAM, resource exhaustion | hCaptcha on register + rate limit |
| Credential stuffing | Bot | Account takeover | Rate limit + lockout + HIBP breach check |
| Admin scraping user PII | Malicious admin | Privacy breach | Audit log of all admin actions; data minimisation on export |
| Review bombing | Learner | Reputation damage | One review per booking enforced at DB layer |

---

## 6. Zero Trust Architecture

SkillSwap follows Zero Trust principles: **never trust, always verify**.

| Principle | Implementation |
|---|---|
| Verify explicitly | Every request authenticated via JWT; role re-read on admin actions |
| Least privilege | RBAC: learners cannot create listings; tutors cannot access admin panel |
| Assume breach | All secrets in env vars, not code; logs ship to external store; audit chain detects insider tampering |
| Micro-segmentation | MongoDB Atlas VPC peering; no public DB endpoint in production |
| Short-lived credentials | Access tokens expire in 15 minutes; refresh tokens rotated on each use |
| Device trust | JWT bound to device fingerprint (IP + User-Agent hash) |

---

## 7. Argon2id Migration Strategy

**Current state:** bcrypt with cost factor 12 (~250 ms per hash).

**Why migrate to Argon2id?**  
Argon2id won the 2015 Password Hashing Competition. Unlike bcrypt (CPU-only), Argon2id uses memory-hardness, making GPU/ASIC attacks economically infeasible even at scale. OWASP currently recommends Argon2id as the first-choice algorithm.

**Migration approach (zero-downtime, non-breaking):**

1. Install `argon2` npm package.
2. On every **successful login** (when the plaintext password is available):
   - Detect whether `password_hash` starts with `$2b$` (bcrypt) or `$argon2id$` (already migrated).
   - If bcrypt: re-hash with Argon2id and overwrite `password_hash`.
3. For password **verification**, try Argon2id first; fall back to bcrypt for unmigrated hashes.
4. After 90 days (one forced-password-expiry cycle), all active users are migrated. Inactive accounts remain on bcrypt until next login.

**This approach:**
- Requires no mass rehash job or downtime.
- Is fully backwards-compatible.
- Completes automatically as users log in.

**Recommended Argon2id parameters (OWASP 2024):**
- `memoryCost`: 65536 (64 MiB)
- `timeCost`: 3 (iterations)
- `parallelism`: 4
- `hashLength`: 32

---

## 8. Residual Risks

| Risk | Likelihood | Impact | Accepted? |
|---|---|---|---|
| bcrypt before Argon2id migration | Low | Medium | Yes — bcrypt cost 12 is still acceptable; migration planned |
| Flat log file on disk | Medium | Medium | Yes — production should use CloudWatch/Loki; noted in security-decisions.md |
| HIBP API outage (fail-open) | Low | Low | Yes — fail-open is safer than blocking all registrations |
| Device fingerprint changes on VPN | Low | Low | Yes — user simply re-authenticates; not a security regression |
