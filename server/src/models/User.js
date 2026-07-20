const mongoose = require('mongoose');
const { encryptField, decryptField, decryptFieldTolerant, hashForLookup } = require('../utils/fieldEncryption');

// SECURITY: email and mfa_secret are PII/secrets encrypted at rest with
// AES-256-GCM (see utils/fieldEncryption.js). Both use transparent Mongoose
// get/set transforms — application code reads/writes `user.email` and
// `user.mfa_secret` exactly as before; encryption happens on assignment,
// decryption happens on read, automatically.
//
// email specifically also needs to be looked up by exact value (login,
// registration's duplicate check) — GCM ciphertext is non-deterministic
// (a random IV per encryption), so `findOne({ email })` can never match
// against it. `email_lookup_hash` is a deterministic HMAC of the normalized
// address, used ONLY for equality lookups (see User.findByEmail below);
// `email` itself stays the source of truth for display.
//
// MIGRATION NOTE: this field started out as plaintext. `email`'s getter
// uses decryptFieldTolerant (returns unrecognized input unchanged rather
// than throwing) and findByEmail falls back to a raw plaintext match, so
// accounts created before this shipped keep working — and get opportunistically
// upgraded to encrypted+hashed the next time findByEmail locates them (see
// the static below). No flag-day migration required. A batch script
// (scripts/migrateEncryptPII.js) can also eagerly migrate the rest. Full
// strategy: docs/key-management.md.
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    set: (v) => (v ? encryptField(String(v).trim().toLowerCase()) : v),
    get: (v) => decryptFieldTolerant(v),
  },
  // Deterministic lookup key for email — see comment above. sparse+unique
  // (not plain unique) for the same reason google_id below is sparse: a
  // unique index over a field ABSENT on multiple documents fails to build/
  // insert, and pre-migration legacy rows have no hash yet.
  email_lookup_hash: {
    type: String,
    unique: true,
    sparse: true,
    select: false, // internal lookup key, never part of the API-facing user object
  },
  // Required for local (password) accounts; absent for Google-only accounts.
  password_hash: {
    type: String,
    required: function () { return !this.google_id; },
  },
  // Set once a Google sign-in creates or links this account. Sparse+unique so multiple
  // local-only accounts (no google_id at all) don't collide on the index. Deliberately no
  // `default: null` — a sparse index only skips documents where the field is ABSENT, not
  // documents where it's explicitly null, so a default of null defeats the sparse behavior
  // and makes every second local signup fail with a duplicate-key error.
  google_id: {
    type: String,
    unique: true,
    sparse: true,
  },
  mfa_enabled: {
    type: Boolean,
    default: false,
  },
  // No legacy plaintext exists for this field (checked live: 0 rows had
  // mfa_secret set before this shipped), so it uses the strict codec —
  // any malformed value throws instead of silently returning garbage.
  mfa_secret: {
    type: String,
    default: null,
    set: (v) => encryptField(v),
    get: (v) => decryptField(v),
  },
  password_changed_at: {
    type: Date,
    default: Date.now,
  },
  failed_attempts: {
    type: Number,
    default: 0,
  },
  locked_until: {
    type: Date,
  },
  role: {
    type: String,
    enum: ['learner', 'tutor', 'both', 'admin'],
    default: 'learner',
  },
  bio: {
    type: String,
    maxLength: 500,
  },
  skills: {
    type: [String],
    default: [],
  },
  hourly_rate: {
    type: Number,
    min: 0,
  },
  availability_days: {
    type: [String],
    default: [],
  },
  profile_photo_url: {
    type: String,
  }
}, {
  timestamps: true,
  // Getters (the decrypt transforms above) run on direct property access
  // by default already; these two make them also run when a document is
  // serialized via res.json()/JSON.stringify() or .toObject(), which every
  // route in this app relies on for email to come back decrypted.
  toJSON: { getters: true },
  toObject: { getters: true },
});

// Keeps email_lookup_hash in sync whenever email changes (including on
// creation) — reads `this.email` AFTER the setter above has already run,
// so the getter transform hands back the plaintext to hash, not ciphertext.
// Mongoose 9 removed callback-style (`next`) hooks — a plain function that
// just returns (or a real async function) is how you signal "done" now.
userSchema.pre('validate', function () {
  if (this.isModified('email') && this.email) {
    this.email_lookup_hash = hashForLookup(this.email);
  }
});

// The one place the app should look up a user by email — encapsulates the
// hash-lookup + legacy-plaintext-fallback dance so no route has to know
// about the migration state of any given account.
userSchema.statics.findByEmail = async function (email) {
  if (!email) return null;
  const normalized = String(email).trim().toLowerCase();

  const byHash = await this.findOne({ email_lookup_hash: hashForLookup(normalized) });
  if (byHash) return byHash;

  // Fallback for accounts created before email encryption shipped: their
  // stored value is still the raw plaintext string, so a direct equality
  // match against the (unencrypted-at-rest) field works.
  //
  // MUST use the raw driver collection, not `this.findOne({ email })` —
  // Mongoose applies a SchemaType's custom `set` transform to query filter
  // values too, not just document assignment. Querying via the model would
  // silently re-encrypt `normalized` with a fresh random IV before sending
  // it to MongoDB, which can never match anything (GCM ciphertext is
  // non-deterministic — confirmed by this exact failure mode in testing).
  const rawLegacy = await this.collection.findOne({ email: normalized });
  if (!rawLegacy) return null;

  // Opportunistically re-save so the setter encrypts it and the
  // pre-validate hook backfills the hash — fully migrated from here on.
  const legacy = this.hydrate(rawLegacy);
  legacy.email = normalized; // reassigning re-triggers the encrypting setter
  await legacy.save();
  return legacy;
};

module.exports = mongoose.model('User', userSchema);
