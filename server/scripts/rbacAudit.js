#!/usr/bin/env node
// RBAC enforcement audit — programmatically hits a representative set of
// endpoints as each role (anonymous, learner, tutor, admin) and checks the
// actual HTTP status against what the route's access-control comments claim
// it should be. Prints a pass/fail table and writes a JSON report.
//
// This is a reporting/audit tool, not a CI test suite — it needs a running
// server and creates/deletes real (throwaway) test accounts and data
// against whatever MONGO_URI the server is using. Do not point it at a
// database with real user data you care about.
//
// Usage:
//   node index.js &                          # start the server first
//   node scripts/rbacAudit.js                 # defaults to http://localhost:3000
//   BASE_URL=http://localhost:3999 node scripts/rbacAudit.js

require('dotenv').config();
const mongoose = require('mongoose');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const RUN_ID = Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Minimal per-role cookie jar. Needed for two things: the double-submit
// CSRF cookie (bookings/reviews/payments/etc. are mounted behind
// csrfProtection — a mutating request with no X-CSRF-Token header gets a
// blanket 403 regardless of RBAC, which would masquerade as an RBAC
// failure if we didn't handle it) and simply because a real client would
// carry cookies across requests in the same session.
function makeCookieJar() {
  const cookies = new Map();
  return {
    header: () => [...cookies].map(([k, v]) => `${k}=${v}`).join('; '),
    capture(res) {
      const setCookies = res.headers.getSetCookie?.() || [];
      for (const sc of setCookies) {
        const pair = sc.split(';')[0];
        const idx = pair.indexOf('=');
        cookies.set(pair.slice(0, idx), pair.slice(idx + 1));
      }
    },
    get csrfToken() { return cookies.get('csrf-token'); },
  };
}

async function api(method, path, { token, body, userAgent = 'rbac-audit', jar } = {}) {
  const headers = { 'Content-Type': 'application/json', 'User-Agent': userAgent };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (jar) {
    headers['Cookie'] = jar.header();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && jar.csrfToken) {
      headers['X-CSRF-Token'] = jar.csrfToken;
    }
  }
  const res = await fetch(`${BASE_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (jar) jar.capture(res);
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON response, fine */ }
  return { status: res.status, data };
}

// authRateLimiter (5 req/min per IP, shared across /register and /login) is
// easy for a script that bootstraps 4 accounts to trip — which would then
// look exactly like a raft of RBAC failures (every subsequent call gets a
// 401 because the token never came back). Pace bootstrap calls to respect
// it rather than working around a rate limiter this same audit exists to
// help verify.
async function loginAs(email, password, { skipRegister = false } = {}) {
  const userAgent = `rbac-audit-${email}`;
  const jar = makeCookieJar();
  if (!skipRegister) {
    await api('POST', '/api/auth/register', { body: { email, password, 'g-recaptcha-response': 'test' }, jar });
    await sleep(15000);
  }
  const loginRes = await api('POST', '/api/auth/login', { body: { email, password, 'g-recaptcha-response': 'test' }, userAgent, jar });
  await sleep(15000);
  const token = loginRes.data?.accessToken;
  const meRes = await api('GET', '/api/users/me', { token, userAgent, jar });
  // Prime the CSRF cookie via any csrfProtection-wrapped GET before this
  // session is used for a mutating call.
  await api('GET', '/api/bookings', { token, userAgent, jar });
  return { token, userAgent, userId: meRes.data?._id, jar };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const User = require('../src/models/User');
  const Listing = require('../src/models/Listing');
  const Booking = require('../src/models/Booking');

  const PASSWORD = 'Xk9#mQuietForest72!';
  const emails = {
    learner: `rbac-learner-${RUN_ID}@example.com`,
    tutor: `rbac-tutor-${RUN_ID}@example.com`,
    admin: `rbac-admin-${RUN_ID}@example.com`,
    otherLearner: `rbac-other-${RUN_ID}@example.com`,
  };

  console.log(`RBAC audit against ${BASE_URL} — bootstrapping test accounts...`);
  const learner = await loginAs(emails.learner, PASSWORD);
  let tutor = await loginAs(emails.tutor, PASSWORD);
  let admin = await loginAs(emails.admin, PASSWORD);
  const otherLearner = await loginAs(emails.otherLearner, PASSWORD);

  // Promote tutor/admin roles directly via the DB — there's no self-service
  // way to become a tutor/admin (by design: tutor requires admin approval,
  // admin requires an existing admin), so bootstrapping test accounts for
  // an RBAC audit has to go around the API the same way a seed script would.
  // MUST look up by _id, not `{ email: ... }` — email has a schema-level
  // encrypting setter that Mongoose also applies to query filter values,
  // so a plain-string email filter silently matches nothing (see the
  // identical bug, and the fix, in User.findByEmail in models/User.js).
  const tutorAccount = await User.findByEmail(emails.tutor);
  const adminAccount = await User.findByEmail(emails.admin);
  await User.updateOne({ _id: tutorAccount._id }, { role: 'tutor' });
  await User.updateOne({ _id: adminAccount._id }, { role: 'admin' });
  // Tokens embed role at login time — re-login to pick up the promoted role.
  // skipRegister: the account already exists; registering again would just
  // burn another authRateLimiter slot for a guaranteed 400.
  tutor = await loginAs(emails.tutor, PASSWORD, { skipRegister: true });
  admin = await loginAs(emails.admin, PASSWORD, { skipRegister: true });

  // Seed one listing (as tutor) and one booking (as learner) so ownership-
  // gated routes have a real resource to test against.
  const listingRes = await api('POST', '/api/listings', {
    token: tutor.token, userAgent: tutor.userAgent, jar: tutor.jar,
    body: { title: 'RBAC audit listing', description: 'test', skill_category: 'test', price_per_session: 10, duration_minutes: 30 },
  });
  const listingId = listingRes.data?._id;
  if (!listingId) console.error('WARNING: seed listing creation failed:', listingRes.status, listingRes.data);

  const bookingRes = await api('POST', '/api/bookings', {
    token: learner.token, userAgent: learner.userAgent, jar: learner.jar,
    body: { listing_id: listingId, requested_time: new Date(Date.now() + 86400000).toISOString() },
  });
  const bookingId = bookingRes.data?._id;
  if (!bookingId) console.error('WARNING: seed booking creation failed:', bookingRes.status, bookingRes.data);

  const FAKE_ID = '000000000000000000000000';

  // Each case: method, path (or a function of the seeded IDs), and the
  // expected status per role. A role missing from `expected` is not tested
  // for that case (e.g. a mutating action we don't want every role attempting).
  const cases = [
    // --- Public / anonymous ---
    { name: 'Browse listings (public)', method: 'GET', path: '/api/listings', expected: { anon: 200, learner: 200, tutor: 200, admin: 200 } },
    { name: 'View single listing (public)', method: 'GET', path: () => `/api/listings/${listingId}`, expected: { anon: 200, learner: 200, tutor: 200, admin: 200 } },
    { name: 'GET /users/me without token', method: 'GET', path: '/api/users/me', expected: { anon: 401, learner: 200, tutor: 200, admin: 200 } },

    // --- Role-gated creation (listings: tutor/both/admin only) ---
    { name: 'Create listing as learner (should be denied)', method: 'POST', path: '/api/listings', asRole: 'learner',
      body: { title: 'x', description: 'x', skill_category: 'x', price_per_session: 1, duration_minutes: 30 }, expected: { learner: 403 } },
    { name: 'Create listing as tutor (should succeed)', method: 'POST', path: '/api/listings', asRole: 'tutor',
      body: { title: 'x', description: 'x', skill_category: 'x', price_per_session: 1, duration_minutes: 30 }, expected: { tutor: 201 } },

    // --- IDOR: booking ownership (requireOwnership middleware) ---
    { name: "Cancel someone else's booking (IDOR)", method: 'PATCH', path: () => `/api/bookings/${bookingId}/cancel`, asRole: 'otherLearner', expected: { otherLearner: 403 } },
    { name: 'Cancel own booking', method: 'PATCH', path: () => `/api/bookings/${bookingId}/cancel`, asRole: 'learner', expected: { learner: 200 } },

    // --- IDOR: profile ownership ---
    { name: "View another user's private profile (IDOR)", method: 'GET', path: () => `/api/users/${tutor.userId}/profile`, asRole: 'learner', expected: { learner: 403 } },
    { name: 'View own private profile', method: 'GET', path: () => `/api/users/${learner.userId}/profile`, asRole: 'learner', expected: { learner: 200 } },

    // --- Admin-only routes ---
    { name: 'List all users as learner (should be denied)', method: 'GET', path: '/api/admin/users', expected: { learner: 403, tutor: 403, admin: 200 } },
    { name: 'List tutor applications as tutor (should be denied)', method: 'GET', path: '/api/admin/tutor-applications', expected: { tutor: 403, admin: 200 } },
    { name: 'Security alerts as learner (should be denied)', method: 'GET', path: '/api/admin/security-alerts', expected: { learner: 403, admin: 200 } },
    { name: 'Block IP as non-admin (should be denied)', method: 'POST', path: '/api/admin/block-ip', body: { ip_address: '203.0.113.99', reason: 'audit test' }, expected: { learner: 403, tutor: 403 } },

    // --- Nonexistent resource handling (should 404, not leak via 500) ---
    { name: 'GET nonexistent booking', method: 'GET', path: () => `/api/bookings/${FAKE_ID}`, asRole: 'learner', expected: { learner: 404 } },
    { name: 'GET nonexistent listing', method: 'GET', path: () => `/api/listings/${FAKE_ID}`, expected: { anon: 404 } },
  ];

  const tokensByRole = {
    anon: { token: null, userAgent: 'rbac-audit-anon', jar: makeCookieJar() },
    learner, tutor, admin, otherLearner,
  };

  const results = [];
  for (const c of cases) {
    const path = typeof c.path === 'function' ? c.path() : c.path;
    const roles = c.asRole ? [c.asRole] : Object.keys(c.expected);
    for (const role of roles) {
      if (c.expected[role] == null) continue;
      const { token, userAgent, jar } = tokensByRole[role];
      const { status } = await api(c.method, path, { token, userAgent, jar, body: c.body });
      const expected = c.expected[role];
      results.push({ case: c.name, role, method: c.method, path, expected, actual: status, pass: status === expected });
    }
  }

  console.log('\n--- RBAC Audit Results ---');
  const colWidth = { case: 48, role: 14, expected: 9, actual: 9 };
  console.log(
    'CASE'.padEnd(colWidth.case) + 'ROLE'.padEnd(colWidth.role) + 'EXPECTED'.padEnd(colWidth.expected) + 'ACTUAL'.padEnd(colWidth.actual) + 'RESULT'
  );
  let passCount = 0;
  for (const r of results) {
    if (r.pass) passCount++;
    console.log(
      r.case.padEnd(colWidth.case) + r.role.padEnd(colWidth.role) +
      String(r.expected).padEnd(colWidth.expected) + String(r.actual).padEnd(colWidth.actual) +
      (r.pass ? 'PASS' : 'FAIL ⚠️')
    );
  }
  console.log(`\n${passCount}/${results.length} checks passed.`);

  const fs = require('fs');
  const path = require('path');
  const reportPath = path.join(__dirname, `rbac-audit-report-${RUN_ID}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({ baseUrl: BASE_URL, ranAt: new Date().toISOString(), results }, null, 2));
  console.log(`Full report written to ${reportPath}`);

  console.log('\nCleaning up test data...');
  const testUsers = await User.find({ email: { $in: Object.values(emails) } }).select('_id');
  const testUserIds = testUsers.map((u) => u._id);
  await Listing.deleteMany({ tutor_id: { $in: testUserIds } });
  await Booking.deleteMany({ $or: [{ learner_id: { $in: testUserIds } }, { tutor_id: { $in: testUserIds } }] });
  await User.deleteMany({ _id: { $in: testUserIds } });
  console.log('Done.');

  await mongoose.disconnect();
  process.exit(passCount === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error('RBAC audit script crashed:', err);
  process.exit(1);
});
