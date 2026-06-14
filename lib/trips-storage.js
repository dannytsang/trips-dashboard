import { get, head, put, BlobNotFoundError, BlobPreconditionFailedError } from '@vercel/blob';
import { createEmptyProjection, validateTripsProjection } from './trips-projection.js';

export const DEFAULT_TRIPS_PROJECTION_PATH = 'trips-dashboard/latest.json';
export const TRIPS_PROJECTION_BLOB_PATH =
  process.env.TRIPS_DASHBOARD_BLOB_PATH || DEFAULT_TRIPS_PROJECTION_PATH;

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

function toSafeStorageMetadata(result) {
  if (!result) return null;

  return {
    pathname: result.pathname || result.blob?.pathname || TRIPS_PROJECTION_BLOB_PATH,
    uploadedAt: result.uploadedAt?.toISOString?.() || result.blob?.uploadedAt?.toISOString?.() || null,
    size: result.size ?? result.blob?.size ?? null,
  };
}

function isNotFound(error) {
  return error instanceof BlobNotFoundError || error?.name === 'BlobNotFoundError';
}

function isPreconditionFailed(error) {
  return error instanceof BlobPreconditionFailedError || error?.name === 'BlobPreconditionFailedError';
}

export async function readLatestTripsProjection({
  blobGet = get,
  env = process.env,
  pathname = TRIPS_PROJECTION_BLOB_PATH,
} = {}) {
  assertBlobStorageConfigured(env);

  let result;
  try {
    result = await blobGet(pathname, { access: 'private', useCache: false });
  } catch (error) {
    if (isNotFound(error)) {
      return {
        projection: createEmptyProjection(),
        storage: { configured: true, exists: false, pathname },
        stale: true,
        message: 'No trips projection has been synced yet.',
      };
    }

    throw new TripsProjectionStorageError('Failed to read trips projection from Blob storage', {
      code: 'storage_read_failed',
      cause: error,
    });
  }

  if (!result) {
    return {
      projection: createEmptyProjection(),
      storage: { configured: true, exists: false, pathname },
      stale: true,
      message: 'No trips projection has been synced yet.',
    };
  }

  try {
    const text = await streamToText(result.stream);
    const parsed = JSON.parse(text);
    const projection = validateTripsProjection(parsed, {
      receivedAt: parsed.receivedAt || parsed.generatedAt || new Date().toISOString(),
    });

    return {
      projection,
      storage: { configured: true, exists: true, ...toSafeStorageMetadata(result) },
      stale: false,
      message: null,
    };
  } catch (error) {
    throw new TripsProjectionStorageError('Stored trips projection is invalid', {
      code: 'stored_projection_invalid',
      cause: error,
    });
  }
}

export async function writeLatestTripsProjection(projectionInput, {
  blobHead = head,
  blobPut = put,
  env = process.env,
  pathname = TRIPS_PROJECTION_BLOB_PATH,
  now = new Date().toISOString(),
} = {}) {
  assertBlobStorageConfigured(env);

  const projection = validateTripsProjection(projectionInput, { receivedAt: now });
  const body = JSON.stringify(projection, null, 2);
  let currentEtag = null;
  let hadExistingProjection = false;

  try {
    const metadata = await blobHead(pathname);
    currentEtag = metadata.etag || null;
    hadExistingProjection = true;
  } catch (error) {
    if (!isNotFound(error)) {
      throw new TripsProjectionStorageError('Failed to inspect current trips projection Blob', {
        code: 'storage_head_failed',
        cause: error,
      });
    }
  }

  try {
    const result = await blobPut(pathname, body, {
      access: 'private',
      allowOverwrite: true,
      contentType: 'application/json; charset=utf-8',
      cacheControlMaxAge: ONE_MINUTE_SECONDS,
      ...(currentEtag ? { ifMatch: currentEtag } : {}),
    });

    return {
      projection,
      storage: {
        configured: true,
        exists: true,
        replacedExistingProjection: hadExistingProjection,
        ...toSafeStorageMetadata(result),
      },
    };
  } catch (error) {
    throw new TripsProjectionStorageError(
      isPreconditionFailed(error)
        ? 'Trips projection Blob changed during sync; last known good projection was left intact'
        : 'Failed to write trips projection to Blob storage; last known good projection was left intact',
      {
        code: isPreconditionFailed(error) ? 'storage_write_conflict' : 'storage_write_failed',
        cause: error,
      },
    );
  }
}
