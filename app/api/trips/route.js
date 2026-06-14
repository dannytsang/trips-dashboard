import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions, getMissingAuthEnvironment } from '@/lib/auth';

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

  return NextResponse.json({
    trips: [],
    generatedAt: null,
    message: 'Private trips projection store is not wired yet.',
  });
}
