# Vercel Blob Storage — Setup & Gotchas

## Private Blob Reading from Next.js Server Components

**Critical gotcha:** Next.js page server components default to the **Edge runtime** where:
- `process.env.YOUR_VAR` is **unavailable** for custom env vars (only public vars exposed)
- `fetch('/relative-url')` fails with `TypeError: Failed to parse URL`

Private blob URLs also require a **Bearer auth token** — the token must be explicitly passed.

### The Fix

**1. In your page server component (`app/page.tsx`):**
```typescript
export const runtime = 'nodejs';
```
This forces the page to run in the Node.js serverless runtime where your env vars are available.

**2. Guard auth checks against static generation crashes:**
During `next build`, the page is statically generated — auth env vars won't exist yet. Check before calling auth assertions:
```typescript
import { getMissingAuthEnvironment } from '@/lib/auth';

export default async function Page() {
  if (getMissingAuthEnvironment().length > 0) {
    redirect('/auth/signin');
  }
  // ...
}
```

**3. Read the blob via `@vercel/blob` + fetch with auth header:**
```typescript
import { list } from '@vercel/blob';

export async function getDashboardData() {
  const token = process.env.BLOB_READ_WRITE_TOKEN ?? '';

  const blobs = await list({ prefix: 'your-data-file.json' });
  const latest = blobs.blobs[0];
  if (!latest) return getEmptyState();

  const res = await fetch(latest.url, {
    headers: { Authorization: 'Bearer ' + token },
  });
  if (!res.ok) return getEmptyState();

  return JSON.parse(await res.text());
}
```

**4. Env vars needed:**
- `BLOB_READ_WRITE_TOKEN` — encrypted, Production + Preview (set via `vercel env add`)
- `BLOB_STORE_NAME` — auto-created by Vercel Blob integration
- `BLOB_STORE_ID` — auto-created by Vercel Blob integration

### Writing to Blob (from sync scripts)

Use the `/api/blob-write` endpoint pattern with a POST handler:

```typescript
// app/api/blob-write/route.ts
import { put } from '@vercel/blob';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('x-dashboard-secret');
  if (authHeader !== process.env.DASHBOARD_DATA_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  await put('data-file.json', JSON.stringify(body), {
    access: 'private',
    token: process.env.BLOB_READ_WRITE_TOKEN,
    allowOverwrite: true,
  });

  return NextResponse.json({ ok: true });
}
```

### Relevant Logs for Debugging

- `[dashboard-data] BLOB_READ_WRITE_TOKEN length: 0` → token not available (still on Edge runtime)
- `[dashboard-data] blob fetch failed: 403` → private blob URL needs Bearer auth
- `TypeError: Failed to parse URL from /api/...` → relative URL in Edge runtime (use @vercel/blob directly)
- `error ε GET / 200 [page] session: authenticated` → page crashed but returned 200 (edge error)
