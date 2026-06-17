import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const middleware = readFileSync('middleware.js', 'utf8');
const auth = readFileSync('lib/auth.js', 'utf8');
const signInPage = readFileSync('components/auth-signin-page.jsx', 'utf8');
const homePage = readFileSync('app/page.jsx', 'utf8');
const dashboardSurface = readFileSync('components/dashboard-session-surface.jsx', 'utf8');
const tripDetailSurface = readFileSync('components/trip-detail-surface.jsx', 'utf8');
const globalCss = readFileSync('app/globals.css', 'utf8');
const syncRoute = readFileSync('app/api/trips/sync/route.js', 'utf8');
const tripsRoute = readFileSync('app/api/trips/route.js', 'utf8');
const storage = readFileSync('lib/trips-storage.js', 'utf8');
const portfolio = readFileSync('lib/trips-portfolio.js', 'utf8');

assert.match(middleware, /matcher:\s*\['\/'\]/, 'middleware must protect the dashboard root');
assert.match(auth, /NEXTAUTH_URL/, 'auth config must require NEXTAUTH_URL for production callback/origin correctness');
assert.match(homePage, /redirect\('\/auth\/signin\?callbackUrl=\/'\)/, 'dashboard root must server-redirect before rendering dashboard DOM without a session');
assert.doesNotMatch(homePage, /No private trip data is bundled in this build/, 'dashboard shell must not render the public no-data banner at all');
assert.match(signInPage, /Sign in for travel intelligence/, 'sign-in page must use trips copy');
assert.doesNotMatch(signInPage, /No private trip data is bundled in this build/, 'sign-in page must not include authenticated dashboard status copy');
assert.match(globalCss, /\.auth-shell\s*\{[\s\S]*position:\s*fixed[\s\S]*z-index:\s*2147483647[\s\S]*background:/, 'sign-in shell must be a fixed opaque overlay');
assert.match(signInPage, /A private travel intelligence dashboard that summarises upcoming trips, itinerary context, and live monitoring views sourced from the travel planner\./, 'sign-in page must use the approved description');
assert.doesNotMatch(signInPage, /No live trip data or secret values are loaded/, 'sign-in page must not include the removed no-live-data note');
assert.match(signInPage, /THEME_STORAGE_KEY\s*=\s*'tsang-travel-theme'/, 'sign-in page must use the shared tsang-travel-theme storage key');
assert.match(signInPage, /window\.localStorage\.getItem\(THEME_STORAGE_KEY\)/, 'sign-in page must initialise the theme from localStorage');
assert.match(signInPage, /window\.localStorage\.setItem\(THEME_STORAGE_KEY, theme\)/, 'sign-in page must persist the theme to localStorage');
assert.match(signInPage, /className="auth-card-header"/, 'sign-in page must place the theme toggle in a top flex row above the description');
assert.match(signInPage, /className="auth-card-title"/, 'sign-in page must group the eyebrow and heading in a left-aligned title block');
assert.match(signInPage, /themeToggleLabel\s*=\s*useMemo\(\(\)\s*=>\s*'Toggle theme',\s*\[\]\)/, 'sign-in page theme toggle must use a stable Toggle theme label');
assert.match(signInPage, /aria-label=\{themeToggleLabel\}/, 'sign-in page theme toggle must bind the accessible label');
assert.match(signInPage, /theme === 'dark' \? '☀️' : '🌙'/, 'sign-in page theme toggle must be icon-only and switch between the sun and moon icons');
assert.match(signInPage, /className="secondary-action theme-toggle"/, 'sign-in page theme toggle must be a secondary action so the sign-in button stays primary');
assert.match(signInPage, /handleThemeToggle/, 'sign-in page must wire the theme toggle click handler');
assert.doesNotMatch(globalCss, /\.auth-card-title h1\s*\{[^}]*margin:\s*0\s*[;}]/, 'h1 inside .auth-card-title must keep its inline 0.35rem top margin so the toggle anchors to the eyebrow line in the meals-dashboard pattern');
assert.doesNotMatch(globalCss, /\.auth-card-title \.eyebrow\s*\{[^}]*margin:\s*0\s+0\s+\d+(?:\.\d+)?(?:rem|px)\s*[;}]/, 'eyebrow inside .auth-card-title must not have a non-zero bottom margin that compresses the heading against the toggle row');
assert.match(dashboardSurface, /signOut\(\{ callbackUrl: '\/auth\/signin\?signedOut=1' \}\)/, 'authenticated dashboard must sign out through NextAuth and return to sign-in');
assert.match(dashboardSurface, /setIsSigningOut\(true\)/, 'authenticated dashboard must hide protected content immediately during sign-out');
assert.match(dashboardSurface, /data-auth-state="signing-out"/, 'sign-out transition must render an explicit non-dashboard auth state');
assert.match(dashboardSurface, /Sign out/, 'authenticated dashboard must expose a visible sign-out action');
assert.match(globalCss, /\.secondary-action/, 'logout action must have visible button styling');
assert.match(syncRoute, /TRIPS_DASHBOARD_SYNC_SECRET/, 'sync endpoint must use machine auth secret');
assert.match(syncRoute, /timingSafeEqual/, 'sync endpoint must use constant-time bearer token comparison');
assert.match(syncRoute, /Machine authentication required/, 'sync endpoint must reject missing or bad bearer token');
assert.match(tripsRoute, /getServerSession/, 'browser-facing trips API must require server session');
assert.match(tripsRoute, /Authentication required/, 'browser-facing trips API must return explicit auth failure without relying only on middleware');
assert.match(tripsRoute, /readTripsDashboardPortfolio/, 'browser-facing trips API must read portfolio through server-side split storage helper');
assert.match(homePage, /readTripsDashboardPortfolio/, 'authenticated dashboard page must read the private split portfolio server-side');
assert.match(dashboardSurface, /Upcoming and active trips/, 'dashboard surface must render summary-list copy');
assert.match(dashboardSurface, /trip-list/, 'dashboard surface must include trip list rendering');
assert.match(dashboardSurface, /metric-grid/, 'dashboard surface must include summary metric cards');
assert.match(globalCss, /\.trip-card/, 'dashboard summary cards must have styling');
assert.match(globalCss, /@media \(prefers-color-scheme: light\)/, 'dashboard summary must support light theme');
assert.match(storage, /@vercel\/blob/, 'storage helper must use Vercel Blob SDK server-side');
assert.match(storage, /access:\s*'private'/, 'storage helper must use private Blob access');
assert.match(storage, /trips-dashboard\/current\.json/, 'storage helper must use stable current manifest path');
assert.match(storage, /trips-dashboard\/trips\//, 'storage helper must use per-trip object paths');
assert.match(storage, /\.sha256/, 'storage helper must use checksum sidecars');
assert.match(storage, /deleteBlob/, 'storage helper must delete removed or changed split objects when needed');
assert.doesNotMatch(storage, /issueSignedToken|presignUrl|getDownloadUrl/, 'storage helper must not expose signed/direct Blob URLs to clients');
assert.match(portfolio, /FORBIDDEN_KEY_PATTERNS/, 'portfolio validation must include private-data key guards');
assert.match(portfolio, /FORBIDDEN_VALUE_PATTERNS/, 'portfolio validation must include private-data value guards');

// Trip detail top bar — theme toggle must sit in the top navigation row with
// the Back link so it lands at the page's top-right, not merely the title
// header's top-right. This regression-locks the corrected FR-003 behaviour.
assert.match(
  tripDetailSurface,
  /<div\s+className="detail-topbar">[\s\S]*?<Link\s+href="\/"\s+className="back-link">[\s\S]*?className="secondary-action theme-toggle"[\s\S]*?<\/div>/,
  'trip detail must place the Back link and theme toggle together in .detail-topbar'
);
assert.doesNotMatch(
  tripDetailSurface,
  /detail-header-toggle/,
  'trip detail must not keep the theme toggle inside .detail-header-toggle; it belongs in the topbar'
);
assert.doesNotMatch(
  tripDetailSurface,
  /<div\s+className="detail-actions">/,
  'trip detail must not use a separate .detail-actions div for the theme toggle; it belongs in the topbar'
);
assert.match(
  globalCss,
  /\.detail-topbar\s*\{[^}]*display:\s*flex[^}]*justify-content:\s*space-between/,
  '.detail-topbar must be a flex row with space-between so Back sits left and the toggle sits right'
);
assert.match(
  globalCss,
  /\.detail-topbar\s+\.theme-toggle\s*\{[^}]*align-self:\s*center/,
  '.detail-topbar .theme-toggle must align within the top navigation row'
);

// Trip detail map — must be embedded inside the Legs section (not its own
// collapsible) and must render as inline SVG (no third-party tile image
// dependency that can rate-limit and silently fail).
const tripMap = readFileSync('components/trip-map.jsx', 'utf8');
assert.match(
  tripDetailSurface,
  /<DetailSection\s+title="Legs"[\s\S]*?<TripMap[\s\S]*?<\/DetailSection>/,
  'trip detail must embed TripMap inside the Legs DetailSection'
);
assert.doesNotMatch(
  tripDetailSurface,
  /<SectionCollapsible\s+title="Map"/,
  'trip detail must not render Map as its own collapsible section; it lives inside Legs'
);
// TripMap must use an embedded OpenStreetMap iframe (raster tiles at
// street/city resolution). Real OSM tiles look dramatically better than
// our previous simplified Natural Earth SVG basemap — the user flagged
// that the SVG output looked like a data issue (markers spanning India
// to UK). The iframe is the right primitive: zero API key, native zoom,
// proper raster tiles. Spec 010 FR-009 + FR-027.
//
// The literal <iframe> JSX element uses src={embed.src} — embed.src is
// a URLSearchParams-composed value, so the iframe and the URL hostname
// are on different lines. We assert on the element shape and the URL
// shape separately, both within the same TripMap source file.
assert.match(
  tripDetailSurface,
  /<TripMap\s+legs=\{trip\.legs\}\s+homeBase=\{trip\.homeBase\}/,
  'trip detail must pass homeBase to TripMap so the OSM marker avoids the home return waypoint (spec 010 FR-027 marker rule)'
);
assert.match(
  tripMap,
  /<iframe/,
  'TripMap must use an <iframe> element'
);
assert.match(
  tripMap,
  /openstreetmap\.org\/export\/embed\.html/,
  'TripMap must build the OpenStreetMap /export/embed.html URL'
);
// URLSearchParams is composed from named keys, not raw "key=value"
// strings, so the assertions below match the JS shape rather than the
// final encoded URL.
assert.match(
  tripMap,
  /URLSearchParams\(\s*\{\s*bbox/,
  'TripMap iframe URL must include a bbox parameter (URLSearchParams key)'
);
assert.match(
  tripMap,
  /URLSearchParams\([\s\S]*?marker:/,
  'TripMap iframe URL must include a marker parameter (URLSearchParams key)'
);
assert.match(
  tripMap,
  /layer:\s*'mapnik'/,
  'TripMap iframe URL must pin layer=mapnik for consistent rendering'
);
assert.match(
  tripMap,
  /w\.precision\s*!==\s*'home'\s*&&\s*w\.precision\s*!==\s*'exact'/,
  'TripMap must filter out home/exact precision waypoints from the iframe URL (spec 010 FR-027 privacy contract)'
);
assert.match(
  tripMap,
  /homeBase\?\.town|homeBase\?\?null|homeBase\s*=\s*null/,
  'TripMap must read the home base town from props so the OSM marker avoids the home return (spec 010 FR-027 marker rule)'
);
assert.match(
  tripMap,
  /nonHomeVisible|nonHomeWaypoints|nonHome/,
  'TripMap must select the marker as the last non-home visible waypoint (spec 010 FR-027 marker rule)'
);
assert.match(
  tripMap,
  /wp\.geocodeLabel\s*\|\|\s*wp\.label/,
  'TripMap must prefer geocodeLabel over label for the Nominatim lookup (spec 010 FR-026)'
);
assert.match(
  globalCss,
  /\.trip-map-iframe\s*\{/,
  '.trip-map-iframe must have visible styling'
);
assert.match(
  globalCss,
  /\.trip-map-attribution\s*\{/,
  '.trip-map-attribution must style the OSM copyright line'
);
// TripMap provider switch (spec 010 — optional Google Maps Embed support).
// We do NOT require the Google path to be present — OSM is the default
// and the dashboard must work on every preview deploy without a key.
// The assertions below are positive existence checks for the wiring
// (env-aware resolver + Google URL builder) so a future regression that
// breaks the provider switch fails the build.
assert.match(
  tripMap,
  /resolveProvider\(mapProvider,\s*envProvider/,
  'TripMap must call resolveProvider with the prop, env var, and key gate'
);
assert.match(
  tripMap,
  /NEXT_PUBLIC_GMAPS_PROVIDER/,
  'TripMap must read NEXT_PUBLIC_GMAPS_PROVIDER for the provider switch'
);
assert.match(
  tripMap,
  /NEXT_PUBLIC_GMAPS_EMBED_KEY/,
  'TripMap must read NEXT_PUBLIC_GMAPS_EMBED_KEY for the Google Maps Embed key'
);
assert.match(
  tripMap,
  /google\.com\/maps\/embed\/v1\/place/,
  'TripMap Google path must build the Maps Embed v1 place URL'
);
// TripMapStrip (spec 010 FR-032..035) — per-leg directions strip.
// The trip detail surface must render BOTH TripMap and TripMapStrip
// inside the same leg-detail-map block. The strip is a sibling of
// TripMap, not a replacement. The TripMapStrip element must use the
// camelCase tag (compiled from trip-map-strip.jsx) and must pass
// `legs` and `homeBase` so the strip can apply the same privacy
// contract.
assert.match(
  tripDetailSurface,
  /<TripMapStrip\s+legs=\{trip\.legs\}\s+homeBase=\{trip\.homeBase\}\s*\/>/,
  'trip detail must embed TripMapStrip with legs and homeBase inside the leg-detail-map block (spec 010 FR-032)'
);
assert.match(
  tripDetailSurface,
  /leg-detail-map-strip/,
  'trip detail must wrap TripMapStrip in a .leg-detail-map-strip container so the strip has its own heading + border'
);
assert.match(
  tripDetailSurface,
  /leg-detail-map-strip-heading/,
  'trip detail must render a heading for the directions strip (spec 010 FR-035)'
);
const tripMapStrip = readFileSync('components/trip-map-strip.jsx', 'utf8');
assert.match(
  tripMapStrip,
  /google\.com\/maps\/embed\/v1\/directions/,
  'TripMapStrip must build the Maps Embed v1 directions URL (not place mode)'
);
assert.match(
  tripMapStrip,
  /NEXT_PUBLIC_GMAPS_EMBED_KEY/,
  'TripMapStrip must read NEXT_PUBLIC_GMAPS_EMBED_KEY for the directions iframe'
);
assert.match(
  tripMapStrip,
  /NEXT_PUBLIC_GMAPS_PROVIDER/,
  'TripMapStrip must read NEXT_PUBLIC_GMAPS_PROVIDER for the provider gate'
);
assert.match(
  globalCss,
  /\.leg-detail-map\s*\{/,
  '.leg-detail-map must style the embedded map region in the Legs section'
);

console.log('OIDC source checks passed.');
