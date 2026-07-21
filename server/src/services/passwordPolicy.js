const zxcvbn = require('zxcvbn');
const bcrypt = require('bcrypt');
const PasswordHistory = require('../models/PasswordHistory');
const { isPasswordPwned } = require('./hibpService');

// Single source of truth for password rules — was previously duplicated as
// three near-identical express-validator chains (register, /password/reset,
// /password/reset-with-token) plus a separate, unenforced zxcvbn call and a

const POLICY = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: true,
  minZxcvbnScore: 2,
  expiryDays: 90,
  historyDepth: 5,
};

function checkComplexity(password) {
  const errors = [];
  if (!password || password.length < POLICY.minLength) errors.push(`Password must be at least ${POLICY.minLength} characters long`);
  if (POLICY.requireUppercase && !/[A-Z]/.test(password || '')) errors.push('Password must contain at least one uppercase letter');
  if (POLICY.requireLowercase && !/[a-z]/.test(password || '')) errors.push('Password must contain at least one lowercase letter');
  if (POLICY.requireNumber && !/[0-9]/.test(password || '')) errors.push('Password must contain at least one number');
  if (POLICY.requireSpecialChar && !/[\W_]/.test(password || '')) errors.push('Password must contain at least one special character');
  return errors;
}

// userInputs: values zxcvbn should penalize if they appear in the password
// (email, name, etc.) — e.g. "alice2024" scores artificially high on its own
// but should score low if the account email is alice@example.com.
function evaluateStrength(password, userInputs = []) {
  return zxcvbn(password || '', userInputs);
}

async function checkBreached(password) {
  return isPasswordPwned(password);
}

// Full server-side gate for a brand-new password (registration, or any reset
// flow) — complexity rules + zxcvbn score + HIBP breach check. Does NOT check
// reuse history (that needs a userId; see checkHistory — a new registration
// has no history yet, so it's a separate step callers opt into).
async function validateNewPassword(password, { userInputs = [] } = {}) {
  const errors = checkComplexity(password);
  const strength = evaluateStrength(password, userInputs);
  if (strength.score < POLICY.minZxcvbnScore) {
    errors.push(strength.feedback?.warning || 'Password is too weak or easily guessable — try adding an uncommon word or phrase');
  }
  let breachCount = 0;
  if (errors.length === 0) {
    breachCount = await checkBreached(password);
    if (breachCount > 0) {
      errors.push(`This password has appeared in ${breachCount.toLocaleString()} data breach(es). Please choose a different password.`);
    }
  }

  return { valid: errors.length === 0, errors, score: strength.score, feedback: strength.feedback, breachCount };
}

// Checks the last `historyDepth` password hashes for this user — bcrypt.compare
// is intentionally sequential (not Promise.all) so a match short-circuits
// without hashing against every remaining history entry.
async function checkHistory(userId, newPassword) {
  const history = await PasswordHistory.find({ userId }).sort({ createdAt: -1 }).limit(POLICY.historyDepth);
  for (const record of history) {
    if (await bcrypt.compare(newPassword, record.password_hash)) {
      return { reused: true };
    }
  }
  return { reused: false };
}

function isPasswordExpired(user) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - POLICY.expiryDays);
  return user.password_changed_at < cutoff;
}

// Shared by both authenticated "change password" and emailed-token "reset
// password" flows: breach check, reuse-history check, hash + save + record.
// Returns { ok: true } or { ok: false, status, msg } so callers can respond
// with the right HTTP status without duplicating this logic.
async function applyNewPassword(user, newPassword) {
  const breachCount = await checkBreached(newPassword);
  if (breachCount > 0) {
    return {
      ok: false, status: 400,
      msg: `This password has appeared in ${breachCount.toLocaleString()} data breach(es). Please choose a different password.`,
    };
  }

  const { reused } = await checkHistory(user.id, newPassword);
  if (reused) {
    return { ok: false, status: 400, msg: 'Password has been used recently. Please choose a different password.' };
  }

  const salt = await bcrypt.genSalt(12);
  const password_hash = await bcrypt.hash(newPassword, salt);

  user.password_hash = password_hash;
  user.password_changed_at = Date.now();
  await user.save();

  await PasswordHistory.create({ userId: user.id, password_hash });

  return { ok: true };
}

module.exports = {
  POLICY,
  checkComplexity,
  evaluateStrength,
  checkBreached,
  validateNewPassword,
  checkHistory,
  isPasswordExpired,
  applyNewPassword,
};
