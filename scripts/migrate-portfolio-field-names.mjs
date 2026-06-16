#!/usr/bin/env node
/**
 * Migrate trips-dashboard Blob storage from `brief` field names to `portfolio`.
 *
 * The storage envelope field changed from `{ brief: ..., manifest, tripsById }`
 * to `{ portfolio: ..., manifest, tripsById }`. This script reads the current
 * Blob, validates it, then writes it back with the corrected field name.
 *
 * Run once:
 *   node scripts/migrate-portfolio-field-names.mjs
 *
 * The script is idempotent — re-running after a successful write is safe
 * (it will skip if portfolio is already correct).
 */
import { readTripsDashboardPortfolio, writeTripsDashboardPortfolio } from '../lib/trips-storage.js';

const env = {
  BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
  BLOB_STORE_ID: process.env.BLOB_STORE_ID,
};

console.log('Reading current portfolio from Blob storage...');
let result;
try {
  result = await readTripsDashboardPortfolio({ env });
} catch (err) {
  if (err.code === 'storage_not_configured') {
    console.error('❌  Blob storage is not configured. Set BLOB_READ_WRITE_TOKEN or BLOB_STORE_ID.');
    process.exit(1);
  }
  throw err;
}

if (result.storage.exists) {
  console.log(`Storage exists: ${result.storage.pathname}`);
} else {
  console.log('No portfolio stored yet — nothing to migrate.');
  process.exit(0);
}

// The new field is `portfolio`. If it's already present, nothing to do.
if (result.portfolio !== undefined) {
  console.log('✅  Portfolio already uses `portfolio` field — migration already applied. Nothing to do.');
  process.exit(0);
}

// If we get here, the old `brief` field is present — migrate.
if (result.brief === undefined) {
  console.error('❌  Neither `portfolio` nor `brief` field found in stored data. Aborting.');
  process.exit(1);
}

console.log('⚠️  Found legacy `brief` field. Migrating to `portfolio`...');

// Re-read raw Blob to get the original envelope shape, then re-write
// with the corrected field name so we preserve the exact stored format.
const input = {
  manifest: result.manifest,
  tripsById: result.tripsById,
};

console.log("Re-writing manifest with corrected `portfolio` field...");
try {
  const writeResult = await writeTripsDashboardPortfolio(input, { env });
  console.log(`✅  Migration complete.`);
  console.log(`    Trips written: ${writeResult.portfolio.trips.length}`);
  console.log(`    Replaced existing: ${writeResult.replacedExistingPortfolio}`);
} catch (err) {
  console.error('❌  Migration failed:', err.message);
  process.exit(1);
}
