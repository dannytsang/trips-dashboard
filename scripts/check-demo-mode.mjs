import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  readTripById,
  readTripsDashboardPortfolio,
  resolveTripsDashboardMode,
  TripsPortfolioStorageError,
} from '../lib/trips-storage.js';

const demoMode = resolveTripsDashboardMode({});
assert.equal(demoMode.mode, 'demo');
assert.equal(demoMode.isDemo, true);
assert.equal(demoMode.dataSourceLabel, 'Demo data');
assert.match(demoMode.bannerMessage, /Demo mode/i);

const productionMode = resolveTripsDashboardMode({ BLOB_READ_WRITE_TOKEN: 'test-token' });
assert.equal(productionMode.mode, 'production');
assert.equal(productionMode.isDemo, false);
assert.equal(productionMode.bannerMessage, null);

const demoPortfolio = await readTripsDashboardPortfolio({ env: {} });
assert.equal(demoPortfolio.mode.isDemo, true);
assert.equal(demoPortfolio.storage.configured, false);
assert.equal(demoPortfolio.storage.source, 'static-demo-fixtures');
assert.ok(demoPortfolio.portfolio.trips.length >= 3, 'demo fixtures should include at least three representative trips');
assert.equal(demoPortfolio.message, demoMode.bannerMessage);

const demoTrip = await readTripById('demo-family-day-trip', { env: {} });
assert.ok(demoTrip, 'demo trip should be available without Blob credentials');
assert.equal(demoTrip.id, 'demo-family-day-trip');
assert.match(demoTrip.title, /Demo/i);

await assert.rejects(
  () => readTripsDashboardPortfolio({
    env: { BLOB_READ_WRITE_TOKEN: 'test-token' },
    blobGet: async () => { throw new Error('Vercel Blob: Failed to fetch blob: 403 Forbidden'); },
  }),
  error => error instanceof TripsPortfolioStorageError && error.code === 'storage_read_failed',
  'configured Blob failures must remain errors and must not fall back to demo mode',
);

const sessionSurfaceSource = readFileSync(new URL('../components/dashboard-session-surface.jsx', import.meta.url), 'utf8');
assert.match(sessionSurfaceSource, /portfolioMode\?\.isDemo/);
assert.match(sessionSurfaceSource, /🧪 Demo mode\./);

const detailSurfaceSource = readFileSync(new URL('../components/trip-detail-surface.jsx', import.meta.url), 'utf8');
assert.match(detailSurfaceSource, /dashboardMode\?\.isDemo/);
assert.match(detailSurfaceSource, /🧪 Demo mode\./);

const syncRouteSource = readFileSync(new URL('../app/api/trips/sync/route.js', import.meta.url), 'utf8');
assert.match(syncRouteSource, /readOnly: true/);
assert.match(syncRouteSource, /static-demo-fixtures/);

console.log('Demo mode resolver and demo-read fallback assertions passed.');
