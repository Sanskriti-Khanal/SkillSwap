require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const BASE = 'http://localhost:3000/api';

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method, headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const User = require('./src/models/User');
  const PasswordResetToken = require('./src/models/PasswordResetToken');

  const stamp = Date.now();
  const localEmail = `verify-forgot-local-${stamp}@example.com`;
  const googleEmail = `verify-forgot-google-${stamp}@example.com`;
  const originalPasswordHash = await bcrypt.hash('OriginalPassw0rd!123', 12);

  const localUser = await new User({ email: localEmail, password_hash: originalPasswordHash, role: 'learner', google_id: `verify-forgot-${stamp}` }).save();
  const googleUser = await new User({ email: googleEmail, role: 'learner', google_id: `verify-forgot-google-${stamp}` }).save(); // no password_hash

  console.log('=== Test A: forgot-password for an existing local-password account ===');
  let res = await req('POST', '/auth/password/forgot', { email: localEmail, 'g-recaptcha-response': 'test' });
  console.log(res.status, res.data);
  let tokenDoc = await PasswordResetToken.findOne({ user_id: localUser._id });
  console.log('token created?', !!tokenDoc, tokenDoc ? { expires_at: tokenDoc.expires_at, used_at: tokenDoc.used_at } : null);

  console.log('\n=== Test B: forgot-password for a non-existent email (must return IDENTICAL generic response) ===');
  const resB = await req('POST', '/auth/password/forgot', { email: `nobody-${stamp}@example.com`, 'g-recaptcha-response': 'test' });
  console.log(resB.status, resB.data);
  console.log('responses identical (no enumeration)?', JSON.stringify(res.data) === JSON.stringify(resB.data));

  console.log('\n=== Test C: forgot-password for a Google-only account (no password) — must also return the SAME generic response, no token created ===');
  const resC = await req('POST', '/auth/password/forgot', { email: googleEmail, 'g-recaptcha-response': 'test' });
  console.log(resC.status, resC.data);
  const googleTokenDoc = await PasswordResetToken.findOne({ user_id: googleUser._id });
  console.log('token created for google-only account (should be null)?', googleTokenDoc);

  console.log('\n=== Test D: redeem the reset link (simulating clicking the emailed link) ===');
  // Simulate "the email that would have been sent" by generating our own raw token the
  // same way the route does, and inserting the matching hash directly — this exercises
  // the exact same redemption code path the real emailed link would hit.
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  await PasswordResetToken.deleteMany({ user_id: localUser._id });
  await PasswordResetToken.create({ user_id: localUser._id, token_hash: tokenHash, expires_at: new Date(Date.now() + 30 * 60 * 1000) });

  const newPassword = 'BrandNewPassw0rd!456';
  res = await req('POST', '/auth/password/reset-with-token', { token: rawToken, newPassword });
  console.log(res.status, res.data);

  const updatedUser = await User.findById(localUser._id);
  const passwordActuallyChanged = await bcrypt.compare(newPassword, updatedUser.password_hash);
  console.log('password actually updated in DB?', passwordActuallyChanged);

  console.log('\n=== Test E: replay the SAME token (must fail — single use) ===');
  res = await req('POST', '/auth/password/reset-with-token', { token: rawToken, newPassword: 'AnotherPassw0rd!789' });
  console.log(res.status, res.data);

  console.log('\n=== Test F: expired token (must fail) ===');
  const expiredRaw = crypto.randomBytes(32).toString('hex');
  const expiredHash = crypto.createHash('sha256').update(expiredRaw).digest('hex');
  await PasswordResetToken.create({ user_id: localUser._id, token_hash: expiredHash, expires_at: new Date(Date.now() - 1000) });
  res = await req('POST', '/auth/password/reset-with-token', { token: expiredRaw, newPassword: 'YetAnotherPassw0rd!012' });
  console.log(res.status, res.data);

  console.log('\n=== Test G: garbage/invalid token (must fail generically, not crash) ===');
  res = await req('POST', '/auth/password/reset-with-token', { token: 'not-a-real-token', newPassword: 'YetAnotherPassw0rd!012' });
  console.log(res.status, res.data);

  console.log('\n--- cleanup ---');
  await PasswordResetToken.deleteMany({ user_id: { $in: [localUser._id, googleUser._id] } });
  await User.deleteMany({ _id: { $in: [localUser._id, googleUser._id] } });
  console.log('cleaned up all test records');

  await mongoose.connection.close();
}

main().catch(async (err) => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
