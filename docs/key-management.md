# Field-Level Encryption: Key Management Strategy

## What's encrypted, and why only this

| Field | Model | Encrypted? | Reasoning |
|---|---|---|---|
| `email` | User | Yes | The only genuinely sensitive PII field on the user record. |
| `mfa_secret` | User | Yes | A TOTP seed — equivalent to a password if it leaks. |
| `bio`, `skills`, `hourly_rate`, `availability_days`, `profile_photo_url` | User | **No** | Deliberately public. These are displayed on tutor profile pages to any visitor (see `GET /users/:id/public-profile`, `GET /listings`). Encrypting them would break the product — a tutor's bio has to be readable by the learners deciding whether to book them. |

Field-level encryption is for data that's sensitive *and* not meant to be broadly readable. Applying it to already-public fields adds engineering cost (key management, migration risk) for zero confidentiality benefit.

## Algorithm: AES-256-GCM, not AES-256-CBC

The codebase previously had one encryption utility (`utils/encryption.js`, now removed), used only for `mfa_secret`, using AES-256-CBC. It's replaced by `utils/fieldEncryption.js`, using AES-256-GCM. GCM is an [AEAD](https://en.wikipedia.org/wiki/Authenticated_encryption) mode — it provides both confidentiality and integrity in one primitive:

- **CBC has no built-in integrity check.** A single flipped bit in CBC ciphertext decrypts to garbage *silently* — there's no signal that tampering occurred. Combined with certain error-handling patterns, CBC without a separate MAC is vulnerable to padding-oracle attacks.
- **GCM's auth tag detects tampering.** Any modification to the ciphertext, IV, or (in this implementation) the version prefix causes decryption to throw instead of returning corrupted data.

## Stored format

```
v<key-version>:<iv-hex>:<auth-tag-hex>:<ciphertext-hex>
```

Example: `v1:f11d4754778563d7b2ab70b8:11758b8849277f671c303e1812791372:e0d52e...`

- **IV**: 12 random bytes per encryption (GCM's recommended nonce size — not 16, which is the CBC convention). Never reused across encryptions, even for the same plaintext under the same key — this is why the same email encrypted twice produces two different ciphertexts.
- **Auth tag**: GCM's 16-byte integrity tag, checked on every decrypt.
- **Version prefix**: which entry in `ENCRYPTION_KEYS` was used — see rotation below.

## Key configuration

Production sets `ENCRYPTION_KEYS`, a JSON object mapping version number → 32-byte key (64 hex characters):

```
ENCRYPTION_KEYS={"1":"a1b2c3...64 hex chars total","2":"f9e8d7...64 hex chars total"}
```

Encryption always uses the **highest** version present (the "current" key). Decryption reads the version prefix off the stored value and looks up *that specific* key — so a row encrypted under version 1 keeps decrypting correctly forever, even after version 2 becomes current for new writes.

Development has no `ENCRYPTION_KEYS` set up by default — `fieldEncryption.js` falls back to deriving a single version-1 key from the existing `ENCRYPTION_KEY` variable (already required for other purposes in this app), so the feature works locally without extra setup. **This fallback does not satisfy production requirements** — `config/validateEnv.js` should be extended to require `ENCRYPTION_KEYS` in production before this ships to a real deployment (not yet wired in — see "Known gaps" below).

## Key rotation procedure

1. Generate a new 32-byte key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
2. Add it to `ENCRYPTION_KEYS` under the next version number, **keeping all prior versions in the object**: `{"1": "<old key>", "2": "<new key>"}`.
3. Deploy. From this point, all *new* writes (registrations, MFA setups, and any row an application code path re-saves) encrypt under version 2. All *existing* rows still decrypt correctly under version 1 — nothing breaks.
4. Optionally, force a re-encryption pass so old rows move to version 2 (useful if version 1 is suspected compromised and you want it retired quickly): run a script analogous to `scripts/migrateEncryptPII.js`, but instead of checking `isEncrypted()`, check whether the version prefix is below the current version, then re-save.
5. Once no row references version 1 (confirm via a query for `email` values starting with `v1:`), remove it from `ENCRYPTION_KEYS`. Any row still on version 1 at that point becomes **permanently undecryptable** — do not remove a version until step 4's sweep confirms zero rows use it.

## The lookup-hash problem (why email needs two fields)

GCM's non-deterministic IV means the same plaintext email encrypts to different ciphertext every time. That's the whole point (semantic security), but it means `db.users.findOne({ email: <ciphertext> })` can never match — login and registration both need to find a user *by* email.

The fix is a **blind index**: `email_lookup_hash` stores `HMAC-SHA256(normalized_email, pepper)` — deterministic (same input always produces the same hash, so it's queryable) but non-reversible (you cannot recover the email from the hash). `User.findByEmail(email)` queries this field; `email` itself stays the source of truth for display and is never queried directly.

The pepper (`LOOKUP_HASH_PEPPER`, falling back to `ENCRYPTION_KEY` in dev) is **deliberately a separate secret from the encryption keys** — compromising one must not compromise the other. In production, set `LOOKUP_HASH_PEPPER` to its own independently-generated value.

## Migration: how existing plaintext data is handled

This feature shipped against a database that already had real user accounts with plaintext `email` values. Two options existed:

1. **Flag-day migration**: encrypt all existing rows in the same deploy that ships the encrypting getter/setter. Rejected — if the migration script fails partway, or a row is missed, the very next login for that account throws instead of degrading gracefully. For a field as critical as login identity, that's an unacceptable failure mode for a one-shot cutover.
2. **Dual-read, lazy-write migration** (what's implemented): the `email` getter is *tolerant* — it returns non-ciphertext-shaped input unchanged instead of throwing, so an unmigrated row still reads back correctly. `findByEmail()` tries the hash lookup first; if that misses, it falls back to a raw plaintext match via the driver directly (bypassing the schema's query-cast, which would otherwise silently re-encrypt the lookup value — see the comment in `User.js` for the exact bug this caused during testing). On a match, it opportunistically re-saves the account, which encrypts `email` and backfills the hash. From that point on, the account is fully migrated.

New registrations are encrypted immediately (the setter runs on every assignment, including `new User({ email })`). Existing accounts migrate the first time they're looked up by email — typically their next login. `scripts/migrateEncryptPII.js --apply` performs the same migration eagerly, in one batch, for operators who don't want to wait on organic traffic.

**This repository's 3 real user accounts have not been migrated** — the dry run (`scripts/migrateEncryptPII.js`, no `--apply`) was run and confirmed all 3 would migrate cleanly, but actually applying it was left as a deliberate decision for whoever operates this deployment, not something to do silently as a side effect of a feature request.

## Known gaps / follow-ups

- `config/validateEnv.js` does not yet require `ENCRYPTION_KEYS`/`LOOKUP_HASH_PEPPER` in production — it should be extended to fail closed if they're missing, the same way it already does for `JWT_SECRET` and `ENCRYPTION_KEY`.
- No automated re-encryption-on-rotation job exists yet (step 4 above is a manual/scripted procedure, not a background worker).
- Key storage itself (where `ENCRYPTION_KEYS` actually lives in production — a secrets manager vs. a plain environment variable) is a deployment-platform decision outside this application's code; whatever is chosen, the keys must never be committed to source control or logged.
