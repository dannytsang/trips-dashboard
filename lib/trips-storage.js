import { get, put, del as deleteBlob, BlobNotFoundError } from '@vercel/blob';
import {
  createEmptyProjection,
  validateTripsProjectionEnvelope,
  validateTripsProjection,
  sha256ForObject,
} from './trips-projection.js';

export const DEFAULT_TRIPS_MANIFEST_PATH = 'trips-dashboard/current.json';
export const DEFAULT_TRIPS_OBJECT_PREFIX = 'trips-dashboard/trips/';
export const TRIPS_CHECKSUM_SIDECAR_SUFFIX = '.sha256';
export const TRIPS_MANIFEST_BLOB_PATH =
  process.env.TRIPS_DASHBOARD_MANIFEST_PATH || process.env.TRIPS_DASHBOARD_BLOB_PATH || DEFAULT_TRIPS_MANIFEST_PATH;

const ONE_MINUTE_SECONDS = 60;

export class TripsProjectionStorageError extends Error {
  constructor(message, { code = 'storage_error', cause } = {}) {
    super(message);
    this.name = 'TripsProjectionStorageError';
    this.code = code;
    this.cause = cause;
  }
}

export function hasBlobStorageEnvironment(env = process.env) {
  return Boolean(env.BLOB_READ_WRITE_TOKEN || env.BLOB_STORE_ID);
}

export function getMissingBlobStorageEnvironment(env = process.env) {
  return hasBlobStorageEnvironment(env) ? [] : ['BLOB_READ_WRITE_TOKEN or BLOB_STORE_ID'];
}

export function assertBlobStorageConfigured(env = process.env) {
  const missing = getMissingBlobStorageEnvironment(env);

  if (missing.length > 0) {
    throw new TripsProjectionStorageError(
      `Missing required Blob storage environment: ${missing.join(', ')}`,
      { code: 'storage_not_configured' },
    );
  }
}

async function streamToText(stream) {
  const response = new Response(stream);
  return response.text();
}

async function readJsonBlob(blobGet, pathname) {
  const result = await blobGet(pathname, { access: 'private', useCache: false });
  if (!result) return null;
  const text = await streamToText(result.stream);
  return { value: JSON.parse(text), result };
}

async function readTextBlob(blobGet, pathname) {
  const result = await blobGet(pathname, { access: 'private', useCache: false });
  if (!result) return null;
  const text = await streamToText(result.stream);
  return { value: text, result };
}

function toSafeStorageMetadata(result, pathname = TRIPS_MANIFEST_BLOB_PATH) {
  if (!result) return null;

  return {
    pathname: result.pathname || result.blob?.pathname || pathname,
    uploadedAt: result.uploadedAt?.toISOString?.() || result.blob?.uploadedAt?.toISOString?.() || null,
    size: result.size ?? result.blob?.size ?? null,
  };
}

function isNotFound(error) {
  return error instanceof BlobNotFoundError || error?.name === 'BlobNotFoundError';
}

function isNotFoundResult(error) {
  return isNotFound(error) || error?.status === 404 || error?.statusCode === 404;
}

function staleFromManifest(manifest, now = new Date()) {
  const generatedAt = Date.parse(manifest.generatedAt || '');
  const staleAfterMinutes = Number(manifest.staleAfterMinutes || 0);
  if (!generatedAt || !staleAfterMinutes) return false;
  return now.getTime() - generatedAt > staleAfterMinutes * 60 * 1000;
}

function emptyRead(pathname, message = 'No trips projection has been synced yet.') {
  return {
    projection: createEmptyProjection(),
    manifest: null,
    storage: { configured: true, exists: false, pathname },
    stale: true,
    message,
  };
}

export async function readTripsDashboardProjection({
  blobGet = get,
  env = process.env,
  pathname = TRIPS_MANIFEST_BLOB_PATH,
  now = new Date(),
} = {}) {
  assertBlobStorageConfigured(env);

  let manifestRead;
  try {
    manifestRead = await readJsonBlob(blobGet, pathname);
  } catch (error) {
    if (isNotFoundResult(error)) {
      return emptyRead(pathname);
    }

    throw new TripsProjectionStorageError('Failed to read trips projection manifest from Blob storage', {
      code: 'storage_read_failed',
      cause: error,
    });
  }

  if (!manifestRead) {
    return emptyRead(pathname);
  }

  try {
    const manifest = manifestRead.value;
    const trips = {};
    for (const entry of manifest.trips || []) {
      const tripRead = await readJsonBlob(blobGet, entry.path);
      if (!tripRead) {
        throw new Error(`Missing trip projection object ${entry.path}`);
      }
      trips[entry.id] = tripRead.value;
    }
    const normalised = validateTripsProjectionEnvelope({ manifest, trips }, {
      receivedAt: manifest.receivedAt || manifest.generatedAt || new Date().toISOString(),
    });

    return {
      projection: normalised.projection,
      manifest: normalised.manifest,
      storage: { configured: true, exists: true, ...toSafeStorageMetadata(manifestRead.result, pathname) },
      stale: Boolean(manifest.stale) || staleFromManifest(manifest, now),
      message: manifest.lastSync?.message || null,
    };
  } catch (error) {
    throw new TripsProjectionStorageError('Stored trips projection is invalid', {
      code: 'stored_projection_invalid',
      cause: error,
    });
  }
}

async function readExistingManifest(blobGet, pathname) {
  try {
    const read = await readJsonBlob(blobGet, pathname);
    return read?.value || null;
  } catch (error) {
    if (isNotFoundResult(error)) return null;
    throw new TripsProjectionStorageError('Failed to inspect current trips projection manifest', {
      code: 'storage_read_failed',
      cause: error,
    });
  }
}

async function readExistingChecksum(blobGet, sidecarPath) {
  try {
    const read = await readTextBlob(blobGet, sidecarPath);
    return read?.value?.trim() || null;
  } catch (error) {
    if (isNotFoundResult(error)) return null;
    throw new TripsProjectionStorageError('Failed to inspect current trip checksum sidecar', {
      code: 'storage_read_failed',
      cause: error,
    });
  }
}

function jsonBody(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

async function putJson(blobPut, pathname, value) {
  return blobPut(pathname, jsonBody(value), {
    access: 'private',
    allowOverwrite: true,
    contentType: 'application/json; charset=utf-8',
    cacheControlMaxAge: ONE_MINUTE_SECONDS,
  });
}

async function putText(blobPut, pathname, value) {
  return blobPut(pathname, value.endsWith('\n') ? value : `${value}\n`, {
    access: 'private',
    allowOverwrite: true,
    contentType: 'text/plain; charset=utf-8',
    cacheControlMaxAge: ONE_MINUTE_SECONDS,
  });
}

async function deleteIfAny(blobDelete, pathnames) {
  const filtered = [...new Set(pathnames.filter(Boolean))];
  if (filtered.length === 0) return;
  await blobDelete(filtered.length === 1 ? filtered[0] : filtered);
}

export async function writeTripsDashboardProjection(projectionInput, {
  blobGet = get,
  blobPut = put,
  blobDelete = deleteBlob,
  env = process.env,
  pathname = TRIPS_MANIFEST_BLOB_PATH,
  now = new Date().toISOString(),
} = {}) {
  assertBlobStorageConfigured(env);

  const normalised = validateTripsProjectionEnvelope(projectionInput, { receivedAt: now });
  const existingManifest = await readExistingManifest(blobGet, pathname);
  const desiredEntries = normalised.manifest.trips;
  const desiredIds = new Set(desiredEntries.map(entry => entry.id));

  try {
    for (const existingEntry of existingManifest?.trips || []) {
      if (!desiredIds.has(existingEntry.id)) {
        await deleteIfAny(blobDelete, [existingEntry.path, existingEntry.sidecarPath]);
      }
    }

    for (const entry of desiredEntries) {
      const trip = normalised.tripsById[entry.id];
      const checksum = sha256ForObject(trip);
      const existingChecksum = await readExistingChecksum(blobGet, entry.sidecarPath);
      if (existingChecksum === checksum) {
        continue;
      }
      if (existingChecksum) {
        await deleteIfAny(blobDelete, [entry.path, entry.sidecarPath]);
      }
      await putJson(blobPut, entry.path, trip);
      await putText(blobPut, entry.sidecarPath, checksum);
    }

    const manifestToWrite = {
      ...normalised.manifest,
      receivedAt: now,
      tripCount: desiredEntries.length,
      stale: false,
      lastSync: normalised.manifest.lastSync || { status: 'ok', message: null },
    };
    const result = await putJson(blobPut, pathname, manifestToWrite);

    return {
      projection: validateTripsProjection({
        schemaVersion: 1,
        generatedAt: manifestToWrite.generatedAt,
        receivedAt: now,
        trips: desiredEntries.map(entry => normalised.tripsById[entry.id]),
        summary: {
          tripCount: desiredEntries.length,
          staleAfterMinutes: manifestToWrite.staleAfterMinutes ?? null,
          lastSync: manifestToWrite.lastSync,
        },
      }, { receivedAt: now }),
      manifest: manifestToWrite,
      storage: {
        configured: true,
        exists: true,
        replacedExistingProjection: Boolean(existingManifest),
        ...toSafeStorageMetadata(result, pathname),
      },
    };
  } catch (error) {
    if (error instanceof TripsProjectionStorageError) {
      throw error;
    }
    throw new TripsProjectionStorageError(
      'Failed to write trips projection to Blob storage; last known good projection was left intact',
      {
        code: 'storage_write_failed',
        cause: error,
      },
    );
  }
}

/**
 * Read a single trip object by ID from private Blob storage.
 * Used by the trip detail page to fetch a specific trip.
 * Returns null if the trip is not found.
 */
export async function readTripById(
  tripId,
  { blobGet = get, env = process.env } = {},
) {
  const pathname = `${DEFAULT_TRIPS_OBJECT_PREFIX}${tripId}.json`;
  try {
    const read = await readJsonBlob(blobGet, pathname);
    return read?.value ?? null;
  } catch (error) {
    if (isNotFoundResult(error)) {
      return null;
    }
    throw new TripsProjectionStorageError(
      `Failed to read trip object ${pathname} from Blob storage`,
      { code: 'storage_read_failed', cause: error },
    );
  }
}

// Backwards-compatible aliases for older source checks/imports while the repo finishes migrating.
export const DEFAULT_TRIPS_PROJECTION_PATH = DEFAULT_TRIPS_MANIFEST_PATH;
export const TRIPS_PROJECTION_BLOB_PATH = TRIPS_MANIFEST_BLOB_PATH;
export const readLatestTripsProjection = readTripsDashboardProjection;
export const writeLatestTripsProjection = writeTripsDashboardProjection;
