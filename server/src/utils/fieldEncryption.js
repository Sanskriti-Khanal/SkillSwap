const crypto = require('crypto');

// SECURITY: Versioned AES-256-GCM field-level encryption for PII.
//
// Stored format: v<version>:<iv_hex>:<authTag_hex>:<ciphertext_hex>
//
// Why GCM, not the CBC this replaces (see the now-retired utils/encryption.js):
// GCM is authenticated — the tag detects any tampering with the ciphertext,
// IV, or which key/version it claims to be under. CBC has none of that: a
// flipped bit silently decrypts to garbage instead of failing loudly, and
// CBC without a MAC is vulnerable to padding-oracle attacks if a decrypt
// failure ever leaks to a response.
//
// Key versioning: ENCRYPTION_KEYS is a JSON object of
// { "1": "<64-hex-char key>", "2": "<64-hex-char key>" }. Encryption always
// uses the highest version present ("current"). Decryption reads the
// version prefix off the stored value and looks up THAT key — rotating in
// a new key (add version 2, keep version 1 registered) never breaks
// existing rows; they keep decrypting under the old key until something
// re-encrypts them (see scripts/migrateEncryptPII.js). Full rotation
// procedure: docs/key-management.md.
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12; // 96 bits — the GCM-recommended nonce size (CBC uses 16; GCM does not)
const ALGORITHM = 'aes-256-gcm';
const CIPHERTEXT_SHAPE = /^v(\d+):([0-9a-f]+):([0-9a-f]+):([0-9a-f]+)$/;

function loadKeys() {
  const raw = process.env.ENCRYPTION_KEYS;
  if (raw) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('ENCRYPTION_KEYS must be valid JSON: {"1":"<64-hex-char key>"}');
    }
    const keys = {};
    for (const [version, hex] of Object.entries(parsed)) {
      const buf = Buffer.from(hex, 'hex');
      if (buf.length !== KEY_LENGTH) {
        throw new Error(`ENCRYPTION_KEYS version ${version} must decode to ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex chars), got ${buf.length}`);
      }
      keys[version] = buf;
    }
    if (Object.keys(keys).length === 0) throw new Error('ENCRYPTION_KEYS is set but has no entries');
    return keys;
  }

  // Dev fallback: derive a single version-1 key from ENCRYPTION_KEY (already
  // required elsewhere in this app) so this module works without new env
  // setup locally. Production MUST set ENCRYPTION_KEYS explicitly — see
  // docs/key-management.md. This fallback intentionally does NOT satisfy
  // config/validateEnv.js's production requirements.
  const legacy = process.env.ENCRYPTION_KEY;
  if (legacy) {
    return { '1': crypto.createHash('sha256').update(legacy).digest() };
  }

  throw new Error('Neither ENCRYPTION_KEYS nor ENCRYPTION_KEY is set — field encryption cannot run');
}

let _keys = null;
function getKeys() {
  if (!_keys) _keys = loadKeys();
  return _keys;
}

function currentVersion() {
  const versions = Object.keys(getKeys()).map(Number);
  return String(Math.max(...versions));
}

function encryptField(plaintext) {
  if (plaintext == null || plaintext === '') return plaintext;
  const version = currentVersion();
  const key = getKeys()[version];
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `v${version}:${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

// Strict decrypt — throws on anything that isn't well-formed versioned
// ciphertext or an unregistered key version. Use for fields with no legacy
// plaintext data (e.g. mfa_secret, where 0 rows exist under the old scheme).
function decryptField(stored) {
  if (stored == null || stored === '') return stored;
  const match = CIPHERTEXT_SHAPE.exec(String(stored));
  if (!match) throw new Error('decryptField: not well-formed ciphertext (expected v<version>:iv:authTag:ciphertext)');
  const [, version, ivHex, authTagHex, ciphertextHex] = match;
  const key = getKeys()[version];
  if (!key) throw new Error(`decryptField: no key registered for version ${version}`);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextHex, 'hex')), decipher.final()]);
  return plaintext.toString('utf8');
}

// Tolerant decrypt — for fields migrating from plaintext (e.g. email).
// Returns non-ciphertext-shaped input UNCHANGED instead of throwing, so a
// row that hasn't been through the encrypting setter yet (created before
// this feature shipped) still reads back correctly instead of crashing
// every request that touches it. See User.js and docs/key-management.md
// for the lazy-migration pattern this enables.
function decryptFieldTolerant(stored) {
  if (stored == null || stored === '') return stored;
  if (!CIPHERTEXT_SHAPE.test(String(stored))) return stored;
  return decryptField(stored);
}

function isEncrypted(stored) {
  return stored != null && CIPHERTEXT_SHAPE.test(String(stored));
}

// Deterministic, non-reversible lookup value for an encrypted field that
// still needs equality queries (email: login/registration must find a user
// by address, but GCM ciphertext is non-deterministic — the same plaintext
// encrypts differently every time via its random IV, so `findOne({email})`
// can never match against ciphertext). HMAC-SHA256 with a dedicated pepper,
// deliberately never the encryption key — compromising one must not
// compromise the other.
function hashForLookup(value) {
  if (value == null) return value;
  const pepper = process.env.LOOKUP_HASH_PEPPER || process.env.ENCRYPTION_KEY;
  if (!pepper) throw new Error('LOOKUP_HASH_PEPPER (or ENCRYPTION_KEY fallback) is not set');
  return crypto.createHmac('sha256', pepper).update(String(value).trim().toLowerCase()).digest('hex');
}

module.exports = { encryptField, decryptField, decryptFieldTolerant, isEncrypted, hashForLookup, currentVersion };
