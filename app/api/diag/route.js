// TEMP diagnostic endpoint — receives hydration mismatch reports from
// the in-browser script installed in app/layout.jsx. Logs to Vercel
// runtime so we can identify the exact component / text that mismatches.
// Remove once #418 is fixed.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const body = await request.text();
    // eslint-disable-next-line no-console
    console.log('[HYDRATION-DIAG]', body);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
