import assert from 'node:assert/strict';
import { ReadableStream } from 'node:stream/web';
import { ProjectionValidationError, validateTripsProjection } from '../lib/trips-projection.js';
import {
  DEFAULT_TRIPS_PROJECTION_PATH,
  readLatestTripsProjection,
  TripsProjectionStorageError,
  writeLatestTripsProjection,
} from '../lib/trips-storage.js';

function streamFromString(text) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

const validProjection = {
  generatedAt: '2026-06-14T20:00:00.000Z',
  trips: [
    {
      id: 'trip_eastbourne_safe_fixture',
      title: 'Eastbourne fixture',
      status: 'planned',
      start: '2026-07-01T09:00:00+01:00',
      end: '2026-07-02T18:00:00+01:00',
      destination: 'Eastbourne',
      travellers: ['Danny'],
      planningReadiness: 'ready',
      monitoring: { enabled: true, active: false },
      nextAction: 'No action required',
    },
  ],
};

const normalised = validateTripsProjection(validProjection, { receivedAt: '2026-06-14T20:01:00.000Z' });
assert.equal(normalised.schemaVersion, 1);
assert.equal(normalised.generatedAt, validProjection.generatedAt);
assert.equal(normalised.receivedAt, '2026-06-14T20:01:00.000Z');
assert.equal(normalised.trips.length, 1);

assert.throws(
  () => validateTripsProjection({ trips: [{ id: 'x', title: 'Bad', status: 'planned', google_calendar_event_id: 'secret' }] }),
  ProjectionValidationError,
  'raw source identifiers must fail validation',
);

assert.throws(
  () => validateTripsProjection({ trips: [{ id: 'x', title: 'Bad', status: 'planned', notes: 'google_calendar:family/abc' }] }),
  ProjectionValidationError,
  'raw google calendar source values must fail validation',
);

await assert.rejects(
  () => readLatestTripsProjection({ env: {}, blobGet: async () => null }),
  error => error instanceof TripsProjectionStorageError && error.code === 'storage_not_configured',
  'storage reads must fail closed without Blob env',
);

const emptyRead = await readLatestTripsProjection({
  env: { BLOB_READ_WRITE_TOKEN: 'test-token' },
  blobGet: async () => null,
});
assert.equal(emptyRead.storage.exists, false);
assert.equal(emptyRead.stale, true);
assert.deepEqual(emptyRead.projection.trips, []);

const storedRead = await readLatestTripsProjection({
  env: { BLOB_READ_WRITE_TOKEN: 'test-token' },
  blobGet: async pathname => ({
    statusCode: 200,
    stream: streamFromString(JSON.stringify(validProjection)),
    headers: new Headers(),
    blob: {
      pathname,
      contentType: 'application/json',
      size: 123,
      uploadedAt: new Date('2026-06-14T20:02:00.000Z'),
      etag: 'etag-one',
      url: 'https://private.example.invalid/blob',
      downloadUrl: 'https://private.example.invalid/blob?download=1',
      contentDisposition: 'inline',
      cacheControl: 'private, no-store',
    },
  }),
});
assert.equal(storedRead.storage.exists, true);
assert.equal(storedRead.storage.pathname, DEFAULT_TRIPS_PROJECTION_PATH);
assert.equal(storedRead.storage.url, undefined, 'storage metadata must not expose direct Blob URL');
assert.equal(storedRead.projection.trips[0].title, 'Eastbourne fixture');

let putBody = null;
const writeResult = await writeLatestTripsProjection(validProjection, {
  env: { BLOB_READ_WRITE_TOKEN: 'test-token' },
  now: '2026-06-14T20:03:00.000Z',
  blobHead: async pathname => ({ pathname, etag: 'etag-existing', uploadedAt: new Date(), size: 10 }),
  blobPut: async (pathname, body, options) => {
    putBody = body;
    assert.equal(pathname, DEFAULT_TRIPS_PROJECTION_PATH);
    assert.equal(options.access, 'private');
    assert.equal(options.allowOverwrite, true);
    assert.equal(options.ifMatch, 'etag-existing');
    assert.equal(options.contentType, 'application/json; charset=utf-8');
    return {
      pathname,
      uploadedAt: new Date('2026-06-14T20:04:00.000Z'),
      size: Buffer.byteLength(body),
      url: 'https://private.example.invalid/blob',
      downloadUrl: 'https://private.example.invalid/blob?download=1',
    };
  },
});
assert.equal(writeResult.storage.replacedExistingProjection, true);
assert.equal(writeResult.storage.url, undefined, 'write result must not expose direct Blob URL');
assert.equal(JSON.parse(putBody).receivedAt, '2026-06-14T20:03:00.000Z');

let putCalled = false;
await assert.rejects(
  () => writeLatestTripsProjection(
    { trips: [{ id: 'x', title: 'Bad', status: 'planned', rawEvidence: 'nope' }] },
    {
      env: { BLOB_READ_WRITE_TOKEN: 'test-token' },
      blobHead: async () => ({ etag: 'should-not-be-read' }),
      blobPut: async () => { putCalled = true; },
    },
  ),
  ProjectionValidationError,
  'invalid projection must be rejected before write',
);
assert.equal(putCalled, false, 'invalid projection must not overwrite last known good Blob');

await assert.rejects(
  () => writeLatestTripsProjection(validProjection, {
    env: { BLOB_READ_WRITE_TOKEN: 'test-token' },
    blobHead: async () => ({ etag: 'etag-existing' }),
    blobPut: async () => {
      const error = new Error('precondition failed');
      error.name = 'BlobPreconditionFailedError';
      throw error;
    },
  }),
  error => error instanceof TripsProjectionStorageError
    && error.code === 'storage_write_conflict'
    && /left intact/.test(error.message),
  'write conflicts must preserve last known good projection',
);

console.log('Blob storage checks passed.');
