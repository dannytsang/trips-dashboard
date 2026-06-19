import { get, put, del as deleteBlob, BlobNotFoundError } from '@vercel/blob';
import {
  createEmptyPortfolio,
  validateTripsPortfolioEnvelope,
  validateTripsPortfolio,
  sha256ForObject,
} from './trips-portfolio.js';

export const DEFAULT_TRIPS_MANIFEST_PATH = 'trips-dashboard/current.json';
export const DEFAULT_TRIPS_OBJECT_PREFIX = 'trips-dashboard/trips/';
export const TRIPS_CHECKSUM_SIDECAR_SUFFIX = '.sha256';
export const TRIPS_MANIFEST_BLOB_PATH =
  process.env.TRIPS_DASHBOARD_MANIFEST_PATH || process.env.TRIPS_DASHBOARD_BLOB_PATH || DEFAULT_TRIPS_MANIFEST_PATH;

const ONE_MINUTE_SECONDS = 60;

export class TripsPortfolioStorageError extends Error {
  constructor(message, { code = 'storage_error', cause } = {}) {
    super(message);
    this.name = 'TripsPortfolioStorageError';
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

function blobAuthOptions(env = process.env, extra = {}) {
  if (env.BLOB_STORE_ID) {
    return extra;
  }
  return {
    ...extra,
    token: env.BLOB_READ_WRITE_TOKEN,
  };
}

export function assertBlobStorageConfigured(env = process.env) {
  const missing = getMissingBlobStorageEnvironment(env);

  if (missing.length > 0) {
    throw new TripsPortfolioStorageError(
      `Missing required Blob storage environment: ${missing.join(', ')}`,
      { code: 'storage_not_configured' },
    );
  }
}

async function streamToText(stream) {
  const response = new Response(stream);
  return response.text();
}

async function readJsonBlob(blobGet, pathname, env = process.env) {
  const result = await blobGet(pathname, blobAuthOptions(env, { access: 'private', useCache: false }));
  if (!result) return null;
  const text = await streamToText(result.stream);
  return { value: JSON.parse(text), result };
}

async function readTextBlob(blobGet, pathname, env = process.env) {
  const result = await blobGet(pathname, blobAuthOptions(env, { access: 'private', useCache: false }));
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

function isForbiddenResult(error) {
  return error?.status === 403
    || error?.statusCode === 403
    || /403 Forbidden/i.test(String(error?.message || ''));
}

function storageReadFailureMessage(scope, error) {
  if (isForbiddenResult(error)) {
    return `Failed to read trips portfolio ${scope} from Blob storage: Vercel Blob rejected the configured credentials (403 Forbidden). Check the Production BLOB_READ_WRITE_TOKEN or Blob store binding.`;
  }
  return `Failed to read trips portfolio ${scope} from Blob storage`;
}

function parseIsoMillis(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function resolvePortfolioStaleness(portfolio, manifest, now = new Date()) {
  const nowMs = now.getTime();
  const trips = Array.isArray(portfolio?.trips) ? portfolio.trips : [];

  if (manifest?.stale) {
    return {
      stale: true,
      staleAt: null,
      reason: 'manifest-flag',
    };
  }

  const activeTrips = trips
    .map(trip => {
      const startMs = parseIsoMillis(trip?.start);
      const endMs = parseIsoMillis(trip?.end);
      return { trip, startMs, endMs };
    })
    .filter(({ startMs, endMs }) => startMs != null && endMs != null && startMs <= nowMs && nowMs < endMs)
    .sort((a, b) => a.endMs - b.endMs);

  const activeTrip = activeTrips[0] || null;
  if (activeTrip) {
    return {
      stale: nowMs >= activeTrip.endMs,
      staleAt: activeTrip.endMs,
      reason: 'active-trip-end',
    };
  }

  const upcomingTrips = trips
    .map(trip => ({ trip, startMs: parseIsoMillis(trip?.start) }))
    .filter(({ startMs }) => startMs != null && startMs > nowMs)
    .sort((a, b) => a.startMs - b.startMs);

  const nextTrip = upcomingTrips[0] || null;
  if (nextTrip) {
    return {
      stale: nowMs >= nextTrip.startMs,
      staleAt: nextTrip.startMs,
      reason: 'next-trip-start',
    };
  }

  const generatedAt = parseIsoMillis(manifest?.generatedAt);
  const staleAfterMinutes = Number(manifest?.staleAfterMinutes || 0);
  if (generatedAt && staleAfterMinutes > 0) {
    const staleAt = generatedAt + staleAfterMinutes * 60 * 1000;
    return {
      stale: nowMs >= staleAt,
      staleAt,
      reason: 'manifest-threshold',
    };
  }

  return {
    stale: Boolean(manifest?.stale),
    staleAt: null,
    reason: manifest?.stale ? 'manifest-flag' : 'none',
  };
}

function emptyRead(pathname, message = 'No trips portfolio has been synced yet.') {
  return {
    portfolio: createEmptyPortfolio(),
    manifest: null,
    storage: { configured: true, exists: false, pathname },
    stale: true,
    message,
  };
}

export async function readTripsDashboardPortfolio({
  blobGet = get,
  env = process.env,
  pathname = TRIPS_MANIFEST_BLOB_PATH,
  now = new Date(),
} = {}) {
  assertBlobStorageConfigured(env);

  let manifestRead;
  try {
    manifestRead = await readJsonBlob(blobGet, pathname, env);
  } catch (error) {
    if (isNotFoundResult(error)) {
      return emptyRead(pathname);
    }

    throw new TripsPortfolioStorageError(storageReadFailureMessage('manifest', error), {
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
      const tripRead = await readJsonBlob(blobGet, entry.path, env);
      if (!tripRead) {
        throw new Error(`Missing trip portfolio object ${entry.path}`);
      }
      trips[entry.id] = tripRead.value;
    }
    const normalised = validateTripsPortfolioEnvelope({ manifest, trips }, {
      receivedAt: manifest.receivedAt || manifest.generatedAt || new Date().toISOString(),
    });

    return {
      portfolio: normalised.portfolio,
      manifest: normalised.manifest,
      storage: { configured: true, exists: true, ...toSafeStorageMetadata(manifestRead.result, pathname) },
      stale: resolvePortfolioStaleness(normalised.portfolio, manifest, now).stale,
      message: manifest.lastSync?.message || null,
    };
  } catch (error) {
    throw new TripsPortfolioStorageError('Stored trips portfolio is invalid', {
      code: 'stored_portfolio_invalid',
      cause: error,
    });
  }
}

async function readExistingManifest(blobGet, pathname, env = process.env) {
  try {
    const read = await readJsonBlob(blobGet, pathname, env);
    return read?.value || null;
  } catch (error) {
    if (isNotFoundResult(error)) return null;
    throw new TripsPortfolioStorageError(storageReadFailureMessage('manifest', error), {
      code: 'storage_read_failed',
      cause: error,
    });
  }
}

async function readExistingChecksum(blobGet, sidecarPath, env = process.env) {
  try {
    const read = await readTextBlob(blobGet, sidecarPath, env);
    return read?.value?.trim() || null;
  } catch (error) {
    if (isNotFoundResult(error)) return null;
    throw new TripsPortfolioStorageError('Failed to inspect current trip checksum sidecar', {
      code: 'storage_read_failed',
      cause: error,
    });
  }
}

function jsonBody(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

async function putJson(blobPut, pathname, value, env = process.env) {
  return blobPut(pathname, jsonBody(value), blobAuthOptions(env, {
    access: 'private',
    allowOverwrite: true,
    contentType: 'application/json; charset=utf-8',
    cacheControlMaxAge: ONE_MINUTE_SECONDS,
  }));
}

async function putText(blobPut, pathname, value, env = process.env) {
  return blobPut(pathname, value.endsWith('\n') ? value : `${value}\n`, blobAuthOptions(env, {
    access: 'private',
    allowOverwrite: true,
    contentType: 'text/plain; charset=utf-8',
    cacheControlMaxAge: ONE_MINUTE_SECONDS,
  }));
}

async function deleteIfAny(blobDelete, pathnames, env = process.env) {
  const filtered = [...new Set(pathnames.filter(Boolean))];
  if (filtered.length === 0) return;
  await blobDelete(filtered.length === 1 ? filtered[0] : filtered, blobAuthOptions(env));
}

export async function writeTripsDashboardPortfolio(portfolioInput, {
  blobGet = get,
  blobPut = put,
  blobDelete = deleteBlob,
  env = process.env,
  pathname = TRIPS_MANIFEST_BLOB_PATH,
  now = new Date().toISOString(),
} = {}) {
  assertBlobStorageConfigured(env);

  const normalised = validateTripsPortfolioEnvelope(portfolioInput, { receivedAt: now });
  const existingManifest = await readExistingManifest(blobGet, pathname, env);
  const desiredEntries = normalised.manifest.trips;
  const desiredIds = new Set(desiredEntries.map(entry => entry.id));

  try {
    for (const existingEntry of existingManifest?.trips || []) {
      if (!desiredIds.has(existingEntry.id)) {
        await deleteIfAny(blobDelete, [existingEntry.path, existingEntry.sidecarPath], env);
      }
    }

    for (const entry of desiredEntries) {
      const trip = normalised.tripsById[entry.id];
      const checksum = sha256ForObject(trip);
      const existingChecksum = await readExistingChecksum(blobGet, entry.sidecarPath, env);
      if (existingChecksum === checksum) {
        continue;
      }
      if (existingChecksum) {
        await deleteIfAny(blobDelete, [entry.path, entry.sidecarPath], env);
      }
      await putJson(blobPut, entry.path, trip, env);
      await putText(blobPut, entry.sidecarPath, checksum, env);
    }

    const manifestToWrite = {
      ...normalised.manifest,
      receivedAt: now,
      tripCount: desiredEntries.length,
      stale: false,
      lastSync: normalised.manifest.lastSync || { status: 'ok', message: null },
    };
    const result = await putJson(blobPut, pathname, manifestToWrite, env);

    return {
      portfolio: validateTripsPortfolio({
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
        replacedExistingPortfolio: Boolean(existingManifest),
        ...toSafeStorageMetadata(result, pathname),
      },
    };
  } catch (error) {
    if (error instanceof TripsPortfolioStorageError) {
      throw error;
    }
    throw new TripsPortfolioStorageError(
      'Failed to write trips portfolio to Blob storage; last known good portfolio was left intact',
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
  assertBlobStorageConfigured(env);
  const pathname = `${DEFAULT_TRIPS_OBJECT_PREFIX}${tripId}.json`;
  try {
    const read = await readJsonBlob(blobGet, pathname, env);
    return read?.value ?? null;
  } catch (error) {
    if (isNotFoundResult(error)) {
      return null;
    }
    throw new TripsPortfolioStorageError(storageReadFailureMessage(`object ${pathname}`, error),
      { code: 'storage_read_failed', cause: error },
    );
  }
}
