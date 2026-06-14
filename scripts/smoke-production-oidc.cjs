const assert = require('node:assert/strict');

const baseUrl = process.env.TRIPS_DASHBOARD_PRODUCTION_URL || 'https://tsang-travel.vercel.app';

async function request(path, { method = 'GET', body, redirect = 'manual', headers = {} } = {}) {
  const response = await fetch(new URL(path, baseUrl), {
    method,
    body,
    redirect,
    headers,
  });
  const text = await response.text();
  return { response, text };
}

function assertNoProtectedDashboardDom(text, context, { allowAuthSignOutCopy = false } = {}) {
  assert.equal(text.includes('id="dashboard-title"'), false, `${context} must not render dashboard heading DOM`);
  assert.equal(text.includes('Welcome,'), false, `${context} must not render authenticated welcome copy`);
  if (!allowAuthSignOutCopy) {
    assert.equal(text.includes('Sign out'), false, `${context} must not render authenticated logout control`);
  }
  assert.equal(text.includes('trips-dashboard/current.json'), false, `${context} must not expose Blob manifest path`);
  assert.equal(text.includes('trips-dashboard/trips/'), false, `${context} must not expose Blob trip object path`);
}

async function main() {
  const root = await request('/');
  assert.equal(root.response.status, 307, 'anonymous / must redirect before rendering dashboard content');
  assert.match(root.response.headers.get('location') || '', /^\/auth\/signin\?callbackUrl=%2F/, 'anonymous / must redirect to sign-in');
  assertNoProtectedDashboardDom(root.text, 'anonymous root redirect response');

  const signin = await request('/auth/signin', { redirect: 'follow' });
  assert.equal(signin.response.status, 200, '/auth/signin must render');
  assert.match(signin.text, /Sign in for travel intelligence/, 'sign-in page must show trips sign-in copy');
  assert.match(signin.text, /Private trip summaries, itinerary context, and future travel monitoring views are protected by Authentik\./, 'sign-in page must show the approved description');
  assert.doesNotMatch(signin.text, /No live trip data or secret values are loaded/, 'sign-in page must not show the removed no-live-data note');
  assertNoProtectedDashboardDom(signin.text, 'sign-in page');

  const trips = await request('/api/trips');
  assert.equal(trips.response.status, 401, 'anonymous /api/trips must be rejected');
  assert.deepEqual(JSON.parse(trips.text), { error: 'Authentication required' }, 'anonymous trips API must return explicit JSON auth failure');

  const sync = await request('/api/trips/sync', {
    method: 'POST',
    body: '{}',
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(sync.response.status, 401, 'anonymous /api/trips/sync must be rejected');
  assert.deepEqual(JSON.parse(sync.text), { error: 'Machine authentication required' }, 'sync API must require machine auth, not browser session alone');

  const session = await request('/api/auth/session');
  assert.equal(session.response.status, 200, 'NextAuth session route must remain reachable');
  assert.deepEqual(JSON.parse(session.text), {}, 'anonymous session route must not contain user data');

  const signout = await request('/api/auth/signout?callbackUrl=%2Fauth%2Fsignin%3FsignedOut%3D1');
  assert.equal(signout.response.status, 200, 'NextAuth signout route must remain reachable');
  assertNoProtectedDashboardDom(signout.text, 'anonymous signout route', { allowAuthSignOutCopy: true });

  console.log(`Production OIDC smoke passed for ${baseUrl}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
