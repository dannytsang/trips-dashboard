import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { ProjectionValidationError } from '@/lib/trips-projection';
import {
  getMissingBlobStorageEnvironment,
  TripsProjectionStorageError,
  writeTripsDashboardProjection,
} from '@/lib/trips-storage';

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

export async function POST(request) {
  const expectedToken = expectedBearerToken();

  if (!expectedToken) {
    return NextResponse.json(
      { error: 'Sync endpoint is not configured' },
      { status: 503 },
    );
  }

  const token = readBearerToken(request);

  if (!tokensMatch(token, expectedToken)) {
    return NextResponse.json({ error: 'Machine authentication required' }, { status: 401 });
  }

  const missingStorage = getMissingBlobStorageEnvironment();

  if (missingStorage.length > 0) {
    return NextResponse.json(
      {
        error: 'Trips projection storage is not configured',
        accepted: false,
      },
      { status: 503 },
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload', accepted: false }, { status: 400 });
  }

  try {
    const result = await writeTripsDashboardProjection(payload);

    return NextResponse.json({
      accepted: true,
      generatedAt: result.projection.generatedAt,
      receivedAt: result.projection.receivedAt,
      storage: result.storage,
    });
  } catch (error) {
    if (error instanceof ProjectionValidationError) {
      return NextResponse.json(
        {
          error: error.message,
          details: error.details,
          accepted: false,
        },
        { status: 400 },
      );
    }

    if (error instanceof TripsProjectionStorageError) {
      return NextResponse.json(
        {
          error: error.message,
          accepted: false,
          lastKnownGoodPreserved: true,
        },
        { status: error.code === 'storage_not_configured' ? 503 : 502 },
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to sync trips projection',
        accepted: false,
        lastKnownGoodPreserved: true,
      },
      { status: 502 },
    );
  }
}
