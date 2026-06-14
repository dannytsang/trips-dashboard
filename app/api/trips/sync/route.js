import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

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

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return NextResponse.json({ error: 'Sync payload must be an object' }, { status: 400 });
  }

  return NextResponse.json(
    {
      error: 'Private trips projection store is not implemented yet',
      accepted: false,
    },
    { status: 501 },
  );
}
