import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions, getMissingAuthEnvironment } from '@/lib/auth';
import {
  readTripsDashboardPortfolio,
  TripsPortfolioStorageError,
} from '@/lib/trips-storage';

export const runtime = 'nodejs';
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

  try {
    const { portfolio, storage, stale, message, mode } = await readTripsDashboardPortfolio();

    return NextResponse.json(
      {
        ...portfolio,
        storage,
        stale,
        message,
        mode,
      },
      {
        headers: {
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      },
    );
  } catch (error) {
    const message = error instanceof TripsPortfolioStorageError
      ? error.message
      : 'Failed to read trips portfolio';

    return NextResponse.json(
      {
        error: message,
        storage: { configured: true },
      },
      { status: 502 },
    );
  }
}
