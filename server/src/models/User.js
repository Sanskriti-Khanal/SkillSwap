const mongoose = require('mongoose');
const { encryptField, decryptField, decryptFieldTolerant, hashForLookup } = require('../utils/fieldEncryption');

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


  const rawLegacy = await this.collection.findOne({ email: normalized });
  if (!rawLegacy) return null;


  const legacy = this.hydrate(rawLegacy);
  legacy.email = normalized; // reassigning re-triggers the encrypting setter
  await legacy.save();
  return legacy;
};

module.exports = mongoose.model('User', userSchema);
