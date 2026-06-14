import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions, getMissingAuthEnvironment } from '@/lib/auth';
import {
  getMissingBlobStorageEnvironment,
  readTripsDashboardProjection,
  TripsProjectionStorageError,
} from '@/lib/trips-storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  const missingAuth = getMissingAuthEnvironment();

  if (missingAuth.length > 0) {
    return NextResponse.json(
      { error: 'Authentication configuration incomplete' },
      { status: 503 },
    );
  }

  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const missingStorage = getMissingBlobStorageEnvironment();

  if (missingStorage.length > 0) {
    return NextResponse.json(
      {
        error: 'Trips projection storage is not configured',
        storage: { configured: false },
      },
      { status: 503 },
    );
  }

  try {
    const { projection, storage, stale, message } = await readTripsDashboardProjection();

    return NextResponse.json(
      {
        ...projection,
        storage,
        stale,
        message,
      },
      {
        headers: {
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      },
    );
  } catch (error) {
    const message = error instanceof TripsProjectionStorageError
      ? error.message
      : 'Failed to read trips projection';

    return NextResponse.json(
      {
        error: message,
        storage: { configured: true },
      },
      { status: 502 },
    );
  }
}
