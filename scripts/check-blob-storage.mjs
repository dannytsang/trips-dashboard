import assert from 'node:assert/strict';
import { ReadableStream } from 'node:stream/web';
import {
  PortfolioValidationError,
  canonicalJson,
  sha256ForObject,
  validateTripsPortfolio,
  validateTripsPortfolioEnvelope,
} from '../lib/trips-portfolio.js';
import {
  DEFAULT_TRIPS_MANIFEST_PATH,
  getMissingBlobStorageEnvironment,
  hasBlobStorageEnvironment,
  readTripsDashboardPortfolio,
  TripsPortfolioStorageError,
  writeTripsDashboardPortfolio,
} from '../lib/trips-storage.js';

function streamFromString(text) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

function blobResult(pathname, value) {
  return {
    statusCode: 200,
    stream: streamFromString(typeof value === 'string' ? value : JSON.stringify(value)),
    headers: new Headers(),
    blob: {
      pathname,
      contentType: 'application/json',
      size: 123,
      uploadedAt: new Date('2026-06-14T20:02:00.000Z'),
      etag: 'etag-one',
      url: 'https://private.example.invalid/blob',
      downloadUrl: 'https://private.example.invalid/blob?download=1',
    },
  };
}

const tripA = {
  schemaVersion: 1,
  id: 'trip-a',
  title: 'Eastbourne fixture',
  status: 'planned',
  start: '2026-07-01T09:00:00+01:00',
  end: '2026-07-02T18:00:00+01:00',
  destinationLabel: 'Eastbourne',
  travellers: ['Danny'],
  planning: { readiness: 'ready', nextAction: null },
  monitoring: { enabled: true, active: false, lastCheckedAt: null, summary: 'Monitoring configured' },
  legs: [{ label: 'Home to Eastbourne', mode: 'driving', start: '2026-07-01T09:00:00+01:00', end: null }],
};

const tripB = {
  ...tripA,
  id: 'trip-b',
  title: 'Birmingham fixture',
  destinationLabel: 'Birmingham',
  start: '2026-08-01T09:00:00+01:00',
  end: '2026-08-01T20:00:00+01:00',
};

const checksumA = sha256ForObject(tripA);
const checksumB = sha256ForObject(tripB);

const splitEnvelope = {
  manifest: {
    schemaVersion: 1,
    generatedAt: '2026-06-14T20:00:00.000Z',
    staleAfterMinutes: 360,
    tripCount: 2,
    stale: false,
    lastSync: { status: 'ok', message: null },
    trips: [
      {
        id: 'trip-a',
        path: 'trips-dashboard/trips/trip-a.json',
        sha256: checksumA,
        sidecarPath: 'trips-dashboard/trips/trip-a.sha256',
        sortStart: tripA.start,
        status: tripA.status,
        title: tripA.title,
        destinationLabel: tripA.destinationLabel,
      },
      {
        id: 'trip-b',
        path: 'trips-dashboard/trips/trip-b.json',
        sha256: checksumB,
        sidecarPath: 'trips-dashboard/trips/trip-b.sha256',
        sortStart: tripB.start,
        status: tripB.status,
        title: tripB.title,
        destinationLabel: tripB.destinationLabel,
      },
    ],
  },
  trips: {
    'trip-a': tripA,
    'trip-b': tripB,
  },
};

const normalised = validateTripsPortfolioEnvelope(splitEnvelope, { receivedAt: '2026-06-14T20:01:00.000Z' });
assert.equal(normalised.manifest.schemaVersion, 1);
assert.equal(normalised.manifest.generatedAt, splitEnvelope.manifest.generatedAt);
assert.equal(normalised.portfolio.trips.length, 2);
assert.equal(normalised.portfolio.trips[0].title, 'Eastbourne fixture');
assert.equal(canonicalJson(tripA).startsWith('{"destinationLabel"'), true, 'canonical JSON must be deterministic and key-sorted');

assert.throws(
  () => validateTripsPortfolio({ trips: [{ id: 'x', title: 'Bad', status: 'planned', google_calendar_event_id: 'secret' }] }),
  PortfolioValidationError,
  'raw source identifiers must fail validation',
);

assert.throws(
  () => validateTripsPortfolioEnvelope({
    manifest: splitEnvelope.manifest,
    trips: { 'trip-a': { ...tripA, notes: 'google_calendar:family/abc' }, 'trip-b': tripB },
  }),
  PortfolioValidationError,
  'raw google calendar source values must fail validation',
);

await assert.rejects(
  () => readTripsDashboardPortfolio({ env: {}, blobGet: async () => null }),
  error => error instanceof TripsPortfolioStorageError && error.code === 'storage_not_configured',
  'storage reads must fail closed without Blob env',
);
assert.equal(hasBlobStorageEnvironment({ BLOB_STORE_ID: 'auto-store-id' }), true, 'BLOB_STORE_ID can authenticate private Blob through Vercel OIDC on the Node.js runtime');
assert.deepEqual(getMissingBlobStorageEnvironment({ BLOB_STORE_ID: 'auto-store-id' }), []);

await assert.rejects(
  () => readTripsDashboardPortfolio({
    env: { BLOB_READ_WRITE_TOKEN: 'bad-token' },
    blobGet: async () => { throw new Error('Vercel Blob: Failed to fetch blob: 403 Forbidden'); },
  }),
  error => error instanceof TripsPortfolioStorageError
    && error.code === 'storage_read_failed'
    && /credentials \(403 Forbidden\)/.test(error.message),
  'forbidden Blob reads must surface an actionable credential failure',
);

const emptyRead = await readTripsDashboardPortfolio({
  env: { BLOB_READ_WRITE_TOKEN: 'test-token' },
  blobGet: async () => null,
});
assert.equal(emptyRead.storage.exists, false);
assert.equal(emptyRead.stale, true);
assert.deepEqual(emptyRead.portfolio.trips, []);

const storedRead = await readTripsDashboardPortfolio({
  env: { BLOB_READ_WRITE_TOKEN: 'test-token' },
  blobGet: async pathname => {
    if (pathname === DEFAULT_TRIPS_MANIFEST_PATH) return blobResult(pathname, splitEnvelope.manifest);
    if (pathname === 'trips-dashboard/trips/trip-a.json') return blobResult(pathname, tripA);
    if (pathname === 'trips-dashboard/trips/trip-b.json') return blobResult(pathname, tripB);
    return null;
  },
});
assert.equal(storedRead.storage.exists, true);
assert.equal(storedRead.storage.pathname, DEFAULT_TRIPS_MANIFEST_PATH);
assert.equal(storedRead.storage.url, undefined, 'storage metadata must not expose direct Blob URL');
assert.equal(storedRead.portfolio.trips[0].title, 'Eastbourne fixture');
assert.equal(storedRead.portfolio.trips[1].title, 'Birmingham fixture');

const futureTrip = {
  ...tripA,
  id: 'trip-future',
  title: 'Future fixture',
  start: '2026-06-20T09:00:00.000Z',
  end: '2026-06-20T18:00:00.000Z',
};
const futureChecksum = sha256ForObject(futureTrip);
const futureRead = await readTripsDashboardPortfolio({
  env: { BLOB_READ_WRITE_TOKEN: 'test-token' },
  now: new Date('2026-06-18T00:00:00.000Z'),
  blobGet: async pathname => {
    if (pathname === DEFAULT_TRIPS_MANIFEST_PATH) {
      return blobResult(pathname, {
        schemaVersion: 1,
        generatedAt: '2026-06-01T00:00:00.000Z',
        staleAfterMinutes: 1,
        tripCount: 1,
        stale: false,
        lastSync: { status: 'ok', message: null },
        trips: [
          {
            id: 'trip-future',
            path: 'trips-dashboard/trips/trip-future.json',
            sha256: futureChecksum,
            sidecarPath: 'trips-dashboard/trips/trip-future.sha256',
            sortStart: futureTrip.start,
            status: futureTrip.status,
            title: futureTrip.title,
            destinationLabel: futureTrip.destinationLabel,
          },
        ],
      });
    }
    if (pathname === 'trips-dashboard/trips/trip-future.json') return blobResult(pathname, futureTrip);
    return null;
  },
});
assert.equal(futureRead.stale, false, 'a future trip should keep the portfolio current until that trip starts');

const activeTrip = {
  ...tripA,
  id: 'trip-active',
  title: 'Active fixture',
  start: '2026-06-18T09:00:00.000Z',
  end: '2026-06-18T18:00:00.000Z',
};
const activeChecksum = sha256ForObject(activeTrip);
const activeRead = await readTripsDashboardPortfolio({
  env: { BLOB_READ_WRITE_TOKEN: 'test-token' },
  now: new Date('2026-06-18T12:00:00.000Z'),
  blobGet: async pathname => {
    if (pathname === DEFAULT_TRIPS_MANIFEST_PATH) {
      return blobResult(pathname, {
        schemaVersion: 1,
        generatedAt: '2026-06-01T00:00:00.000Z',
        staleAfterMinutes: 1,
        tripCount: 1,
        stale: false,
        lastSync: { status: 'ok', message: null },
        trips: [
          {
            id: 'trip-active',
            path: 'trips-dashboard/trips/trip-active.json',
            sha256: activeChecksum,
            sidecarPath: 'trips-dashboard/trips/trip-active.sha256',
            sortStart: activeTrip.start,
            status: activeTrip.status,
            title: activeTrip.title,
            destinationLabel: activeTrip.destinationLabel,
          },
        ],
      });
    }
    if (pathname === 'trips-dashboard/trips/trip-active.json') return blobResult(pathname, activeTrip);
    return null;
  },
});
assert.equal(activeRead.stale, false, 'an in-progress trip should keep the portfolio current until that trip ends');

const delCalls = [];
const putCalls = [];
const writeResult = await writeTripsDashboardPortfolio(splitEnvelope, {
  env: { BLOB_READ_WRITE_TOKEN: 'test-token' },
  now: '2026-06-14T20:03:00.000Z',
  blobGet: async pathname => {
    if (pathname === DEFAULT_TRIPS_MANIFEST_PATH) {
      return blobResult(pathname, {
        ...splitEnvelope.manifest,
        trips: [
          splitEnvelope.manifest.trips[0],
          { id: 'removed-trip', path: 'trips-dashboard/trips/removed-trip.json', sidecarPath: 'trips-dashboard/trips/removed-trip.sha256', sha256: 'old', sortStart: '2026-06-20T09:00:00+01:00', status: 'planned', title: 'Removed', destinationLabel: 'Removed' },
        ],
      });
    }
    if (pathname === 'trips-dashboard/trips/trip-a.sha256') return blobResult(pathname, checksumA + '\n');
    if (pathname === 'trips-dashboard/trips/trip-b.sha256') return null;
    return null;
  },
  blobPut: async (pathname, body, options) => {
    putCalls.push({ pathname, body, options });
    assert.equal(options.access, 'private');
    assert.equal(options.allowOverwrite, true);
    assert.equal(options.contentType.includes('charset=utf-8'), true);
    assert.equal(options.token, 'test-token');
    return { pathname, uploadedAt: new Date('2026-06-14T20:04:00.000Z'), size: Buffer.byteLength(body) };
  },
  blobDelete: async (pathnames, options) => {
    assert.equal(options.token, 'test-token');
    delCalls.push(...(Array.isArray(pathnames) ? pathnames : [pathnames]));
  },
});

assert.equal(writeResult.storage.exists, true);
assert.equal(writeResult.storage.pathname, DEFAULT_TRIPS_MANIFEST_PATH);
assert.equal(writeResult.portfolio.trips.length, 2);
assert.deepEqual(
  putCalls.map(call => call.pathname),
  [
    'trips-dashboard/trips/trip-b.json',
    'trips-dashboard/trips/trip-b.sha256',
    DEFAULT_TRIPS_MANIFEST_PATH,
  ],
  'unchanged trip-a must not be re-uploaded; new trip-b and manifest must be written',
);
assert.deepEqual(
  delCalls,
  [
    'trips-dashboard/trips/removed-trip.json',
    'trips-dashboard/trips/removed-trip.sha256',
  ],
  'removed trip object and checksum sidecar must be deleted in v1',
);
assert.equal(JSON.parse(putCalls.at(-1).body).receivedAt, '2026-06-14T20:03:00.000Z');

let putCalled = false;
await assert.rejects(
  () => writeTripsDashboardPortfolio(
    {
      manifest: splitEnvelope.manifest,
      trips: { 'trip-a': { ...tripA, rawEvidence: 'nope' }, 'trip-b': tripB },
    },
    {
      env: { BLOB_READ_WRITE_TOKEN: 'test-token' },
      blobGet: async () => { throw new Error('should not inspect storage before validation'); },
      blobPut: async () => { putCalled = true; },
    },
  ),
  PortfolioValidationError,
  'invalid portfolio must be rejected before write',
);
assert.equal(putCalled, false, 'invalid portfolio must not overwrite last known good Blob');

await assert.rejects(
  () => writeTripsDashboardPortfolio(splitEnvelope, {
    env: { BLOB_READ_WRITE_TOKEN: 'test-token' },
    blobGet: async pathname => {
      if (pathname === DEFAULT_TRIPS_MANIFEST_PATH) return blobResult(pathname, splitEnvelope.manifest);
      return null;
    },
    blobPut: async pathname => {
      if (pathname === DEFAULT_TRIPS_MANIFEST_PATH) {
        throw new Error('manifest write failed');
      }
      return { pathname, uploadedAt: new Date(), size: 1 };
    },
  }),
  error => error instanceof TripsPortfolioStorageError
    && error.code === 'storage_write_failed'
    && /left intact/.test(error.message),
  'manifest write failures must preserve last known good portfolio',
);

console.log('Blob storage checks passed.');
