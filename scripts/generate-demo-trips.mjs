import fs from 'node:fs/promises';
import path from 'node:path';
import {
  DEMO_TRIPS_BY_ID,
  DEMO_TRIPS_MANIFEST,
  DEMO_TRIPS_PORTFOLIO,
} from '../lib/trips-demo-fixtures.js';
import { canonicalJson, sha256ForObject } from '../lib/trips-portfolio.js';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const OUT_DIR = path.join(ROOT, 'lib', 'fixtures', 'demo');
const TRIPS_DIR = path.join(OUT_DIR, 'trips');

await fs.mkdir(TRIPS_DIR, { recursive: true });

await fs.writeFile(
  path.join(OUT_DIR, 'current.json'),
  `${canonicalJson({
    schemaVersion: DEMO_TRIPS_PORTFOLIO.schemaVersion,
    generatedAt: DEMO_TRIPS_PORTFOLIO.generatedAt,
    receivedAt: DEMO_TRIPS_PORTFOLIO.receivedAt,
    summary: DEMO_TRIPS_PORTFOLIO.summary,
    manifest: DEMO_TRIPS_MANIFEST,
    trips: DEMO_TRIPS_BY_ID,
  })}\n`,
  'utf8',
);

for (const entry of DEMO_TRIPS_MANIFEST.trips) {
  const trip = DEMO_TRIPS_BY_ID[entry.id];
  const tripPath = path.join(TRIPS_DIR, `${entry.id}.json`);
  const checksumPath = path.join(TRIPS_DIR, `${entry.id}.sha256`);
  await fs.writeFile(tripPath, `${JSON.stringify(trip, null, 2)}\n`, 'utf8');
  await fs.writeFile(checksumPath, `${sha256ForObject(trip)}\n`, 'utf8');
}

console.log(`Wrote demo trip fixtures to ${OUT_DIR}`);
