#!/usr/bin/env node
// Batch-migrates any User documents still storing a plaintext `email`
// (accounts created before field-level encryption shipped) to encrypted
// storage + a lookup hash, in one pass.
//
// NOT required for correctness — User.findByEmail() already migrates each
// account lazily, the first time someone looks it up (see models/User.js).
// This script exists for operators who want an eager, one-time cutover
// (e.g. before decommissioning read access to the collection, or before an
// audit) instead of waiting for organic logins to migrate everyone.
//
// Safe to re-run: already-migrated documents (email already ciphertext) are
// skipped. Dry-run by default — pass --apply to actually write changes.
//
// Usage:
//   node scripts/migrateEncryptPII.js            # reports what WOULD change
//   node scripts/migrateEncryptPII.js --apply     # actually migrates

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const { isEncrypted } = require('../src/utils/fieldEncryption');

const APPLY = process.argv.includes('--apply');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected. Mode: ${APPLY ? 'APPLY (writing changes)' : 'DRY RUN (no writes — pass --apply to migrate)'}`);

  // Raw driver read — deliberately bypasses the schema's decrypt getter so
  // we see exactly what's stored, not a decrypted/passthrough view of it.
  const rawUsers = await mongoose.connection.collection('users').find({}).toArray();

  let migrated = 0;
  let alreadyDone = 0;
  let failed = 0;

  for (const raw of rawUsers) {
    if (isEncrypted(raw.email)) {
      alreadyDone++;
      continue;
    }

    console.log(`${APPLY ? 'Migrating' : 'Would migrate'}: ${raw._id} (${raw.email})`);
    if (!APPLY) { migrated++; continue; }

    try {
      const doc = User.hydrate(raw);
      doc.email = String(raw.email).trim().toLowerCase(); // triggers the encrypting setter + pre-validate hash hook
      await doc.save();
      migrated++;
    } catch (err) {
      console.error(`  FAILED for ${raw._id}: ${err.message}`);
      failed++;
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Already encrypted: ${alreadyDone}`);
  console.log(`${APPLY ? 'Migrated' : 'Would migrate'}: ${migrated}`);
  if (failed) console.log(`Failed: ${failed}`);

  if (!APPLY && migrated > 0) {
    console.log('\nThis was a dry run. Re-run with --apply to write these changes.');
  }

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Migration script crashed:', err);
  process.exit(1);
});
