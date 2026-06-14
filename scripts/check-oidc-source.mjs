import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const middleware = readFileSync('middleware.js', 'utf8');
const auth = readFileSync('lib/auth.js', 'utf8');
const signInPage = readFileSync('components/auth-signin-page.jsx', 'utf8');
const syncRoute = readFileSync('app/api/trips/sync/route.js', 'utf8');
const tripsRoute = readFileSync('app/api/trips/route.js', 'utf8');

assert.match(middleware, /matcher:\s*\['\/'\]/, 'middleware must protect the dashboard root');
assert.match(auth, /NEXTAUTH_URL/, 'auth config must require NEXTAUTH_URL for production callback/origin correctness');
assert.match(signInPage, /Sign in for travel intelligence/, 'sign-in page must use trips copy');
assert.match(signInPage, /No live trip data or secret values are loaded/, 'sign-in page must state no data/secret loading');
assert.match(syncRoute, /TRIPS_DASHBOARD_SYNC_SECRET/, 'sync endpoint must use machine auth secret');
assert.match(syncRoute, /timingSafeEqual/, 'sync endpoint must use constant-time bearer token comparison');
assert.match(syncRoute, /Machine authentication required/, 'sync endpoint must reject missing or bad bearer token');
assert.match(tripsRoute, /getServerSession/, 'browser-facing trips API must require server session');
assert.match(tripsRoute, /Authentication required/, 'browser-facing trips API must return explicit auth failure without relying only on middleware');

console.log('OIDC source checks passed.');
