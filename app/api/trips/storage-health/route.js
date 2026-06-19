import { timingSafeEqual } from 'node:crypto';
import { get } from '@vercel/blob';
import { NextResponse } from 'next/server';
import {
  getMissingBlobStorageEnvironment,
  resolveTripsDashboardMode,
  TRIPS_MANIFEST_BLOB_PATH,
} from '@/lib/trips-storage';
import { getDemoTripsDashboardPortfolio } from '@/lib/trips-demo-fixtures';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function expectedBearerToken() {
  return process.env.TRIPS_DASHBOARD_SYNC_SECRET || null;
}

function readBearerToken(request) {
  const header = request.headers.get('authorization') || '';
  const parts = header.trim().split(/\s+/);

  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1];
}

function tokensMatch(actual, expected) {
  if (!actual || !expected) return false;

  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualBuffer, expectedBuffer);
}

function safeError(error) {
  return {
    name: error?.name || 'Error',
    message: String(error?.message || 'Unknown Blob error').slice(0, 500),
    code: error?.code || null,
    status: error?.status || error?.statusCode || null,
  };
}

export async function GET(request) {
  const expectedToken = expectedBearerToken();
  const token = readBearerToken(request);

  if (!tokensMatch(token, expectedToken)) {
    return NextResponse.json({ error: 'Machine authentication required' }, { status: 401 });
  }

  const mode = resolveTripsDashboardMode();
  const missingStorage = getMissingBlobStorageEnvironment();
  const report = {
    ok: false,
    runtime: 'nodejs',
    manifestPath: TRIPS_MANIFEST_BLOB_PATH,
    env: {
      hasBlobReadWriteToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      hasBlobStoreId: Boolean(process.env.BLOB_STORE_ID),
      missingStorage,
    },
    manifest: null,
  };

  if (mode.isDemo) {
    const demo = getDemoTripsDashboardPortfolio();
    return NextResponse.json({
      ...report,
      ok: true,
      demoMode: true,
      mode,
      manifest: {
        exists: true,
        pathname: TRIPS_MANIFEST_BLOB_PATH,
        size: null,
        contentType: 'application/json',
        firstByte: '{',
        parsesAsJson: true,
        schemaVersion: demo.manifest.schemaVersion,
        tripCount: demo.manifest.tripCount,
        generatedAt: demo.manifest.generatedAt,
      },
    });
  }

  if (missingStorage.length > 0) {
    return NextResponse.json(report, { status: 503 });
  }

  try {
    const result = await get(TRIPS_MANIFEST_BLOB_PATH, {
      access: 'private',
      useCache: false,
    });

    if (!result) {
      report.manifest = { exists: false };
      return NextResponse.json(report, { status: 404 });
    }

    const text = await new Response(result.stream).text();
    report.ok = true;
    report.manifest = {
      exists: true,
      pathname: result.blob?.pathname || TRIPS_MANIFEST_BLOB_PATH,
      size: result.blob?.size ?? null,
      contentType: result.blob?.contentType || null,
      firstByte: text.slice(0, 1),
      parsesAsJson: false,
    };

    try {
      const parsed = JSON.parse(text);
      report.manifest.parsesAsJson = true;
      report.manifest.schemaVersion = parsed?.schemaVersion ?? null;
      report.manifest.tripCount = Array.isArray(parsed?.trips) ? parsed.trips.length : null;
      report.manifest.generatedAt = parsed?.generatedAt || null;
    } catch (error) {
      report.ok = false;
      report.manifest.parseError = safeError(error);
      return NextResponse.json(report, { status: 502 });
    }

    return NextResponse.json(report);
  } catch (error) {
    report.manifest = { error: safeError(error) };
    return NextResponse.json(report, { status: 502 });
  }
}
