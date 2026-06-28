import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions, getMissingAuthEnvironment } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Reads trustworthy build/deployment metadata for the authenticated dashboard.
 * Never exposes commit SHAs, branch names, deployment URLs, environment names,
 * secrets, private trip IDs, or raw hosting metadata.
 *
 * @returns {Promise<{ builtAt: string | null }>}
 */
export async function readBuildInfo() {
  const raw = process.env.VERCEL_DEPLOYMENT_TIMESTAMP;
  let builtAt = null;
  if (raw) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
      builtAt = new Date(parsed * 1000).toISOString();
    }
  }
  return { builtAt };
}

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

  const data = await readBuildInfo();

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
