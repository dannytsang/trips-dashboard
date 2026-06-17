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

// Per-leg inline map (spec 010 FR-036..037) — must be embedded
// inside each leg row, not as a standalone Trip map section. This
// replaces the previous FR-027 single-pin map and the FR-032 strip;
// the standalone leg-detail-map block is removed entirely.
const legRouteMap = readFileSync('components/leg-route-map.jsx', 'utf8');
assert.match(
  tripDetailSurface,
  /<LegRouteMap\s+leg=\{leg\}\s*\/>/,
  'trip detail must render LegRouteMap inline inside each leg row (spec 010 FR-036)'
);
assert.doesNotMatch(
  tripDetailSurface,
  /<SectionCollapsible\s+title="Map"/,
  'trip detail must not render Map as its own collapsible section'
);
// Regression check (FR-036): the standalone trip map section is
// removed. A future regression that re-adds the FR-027 single-pin
// map or the FR-032 strip inside the Legs DetailSection would
// re-introduce the overview map Danny asked to remove.
assert.doesNotMatch(
  tripDetailSurface,
  /<TripMap\s/,
  'trip detail must not render the standalone TripMap (FR-036 removes the FR-027 overview section)'
);
assert.doesNotMatch(
  tripDetailSurface,
  /<TripMapStrip\s/,
  'trip detail must not render the standalone TripMapStrip (FR-036 removes the FR-032 strip)'
);
assert.doesNotMatch(
  tripDetailSurface,
  /leg-detail-map-strip/,
  'trip detail must not reference the .leg-detail-map-strip container (removed by FR-036)'
);
// v5 + v5.1 expansion (spec 010 FR-038..FR-040): Travellers, Transport
// decision, Legs+Map, and Accommodation render as SectionCollapsible
// with defaultOpen={true} — Danny asked for the four primary sections
// to be collapsible, all starting open on first load. Accommodation
// was added in v5.1 (2026-06-18) after Danny confirmed it should
// match the v5 contract.
assert.match(
  tripDetailSurface,
  /<SectionCollapsible\s+title="Travellers"\s+emoji="👥"\s+defaultOpen=\{true\}>/,
  'Travellers section must render as SectionCollapsible with defaultOpen={true} (FR-040)'
);
assert.match(
  tripDetailSurface,
  /<SectionCollapsible\s+title="Transport decision"\s+emoji="🚦"\s+defaultOpen=\{true\}>/,
  'Transport decision callout must render as SectionCollapsible with defaultOpen={true} (FR-040)'
);
assert.match(
  tripDetailSurface,
  /<SectionCollapsible\s+title="Legs"\s+emoji="🛤️"\s+defaultOpen=\{true\}>/,
  'Legs+Map section must render as SectionCollapsible with defaultOpen={true} (FR-040)'
);
assert.match(
  tripDetailSurface,
  /<SectionCollapsible\s+title="Accommodation"\s+emoji="🏨"\s+defaultOpen=\{true\}>/,
  'Accommodation section must render as SectionCollapsible with defaultOpen={true} (FR-040, v5.1)'
);
// Regression check (FR-038): the four primary sections must not
// regress to non-collapsible DetailSection. A future edit that
// silently flips them back would lose the user's ability to tuck
// them away after reading.
assert.doesNotMatch(
  tripDetailSurface,
  /<DetailSection\s+title="Travellers"/,
  'Travellers must not regress to non-collapsible DetailSection (FR-038)'
);
assert.doesNotMatch(
  tripDetailSurface,
  /<DetailSection\s+title="Transport decision"/,
  'Transport decision callout must not regress to non-collapsible DetailSection (FR-038)'
);
assert.doesNotMatch(
  tripDetailSurface,
  /<DetailSection\s+title="Legs"/,
  'Legs+Map section must not regress to non-collapsible DetailSection (FR-038)'
);
// Note: there is no <DetailSection title="Accommodation"> regression
// check any more — under v5.1 the Accommodation call site is now
// SectionCollapsible, so a doesNotMatch assertion for that exact
// DetailSection would fire legitimately on the current code.
// The four positive-existence assertions above are the new contract.
// LegRouteMap must build both provider iframe URLs (FR-036). We
// assert on the source shape, not the final URL.
assert.match(
  legRouteMap,
  /google\.com\/maps\/embed\/v1\/directions/,
  'LegRouteMap must build the Google Maps Embed v1 directions URL (FR-036, provider=google)'
);
assert.match(
  legRouteMap,
  /openstreetmap\.org\/export\/embed\.html/,
  'LegRouteMap must build the OSM embed URL (FR-036, provider=osm)'
);
assert.match(
  legRouteMap,
  /NEXT_PUBLIC_GMAPS_PROVIDER/,
  'LegRouteMap must read NEXT_PUBLIC_GMAPS_PROVIDER for the provider gate'
);
assert.match(
  legRouteMap,
  /NEXT_PUBLIC_GMAPS_EMBED_KEY/,
  'LegRouteMap must read NEXT_PUBLIC_GMAPS_EMBED_KEY for the Google directions iframe'
);
assert.match(
  legRouteMap,
  /<iframe/,
  'LegRouteMap must render an <iframe> element'
);
assert.match(
  legRouteMap,
  /loading="lazy"/,
  'LegRouteMap iframe must use loading="lazy" (FR-034 CLS guard)'
);
assert.match(
  legRouteMap,
  /aspect-ratio:\s*4\s*\/\s*3|aspectRatio:\s*['"]4\s*\/\s*3['"]/,
  'LegRouteMap must reserve iframe space with aspect-ratio 4/3 (FR-034 CLS guard)'
);
// Privacy contract (FR-027 reuse). The component must filter out
// home/exact precision endpoints.
assert.match(
  legRouteMap,
  /precision\s*===\s*['"]home['"]|precision\s*===\s*['"]exact['"]/,
  'LegRouteMap must filter out home/exact precision endpoints (FR-027 privacy contract)'
);
// GeocodeLabel override (FR-026 reuse).
assert.match(
  legRouteMap,
  /geocodeLabel\s*\|\|\s*wp\.label|geocodeInput\s*=\s*wp\.geocodeLabel\s*\|\|\s*wp\.label/,
  'LegRouteMap must prefer geocodeLabel over label for the Nominatim lookup (spec 010 FR-026)'
);
// Geocode cache: a module-level Map dedupes waypoint lookups across
// the multiple LegRouteMap instances on the same page.
assert.match(
  legRouteMap,
  /geocodeCache\s*=\s*new Map\(\)/,
  'LegRouteMap must share a module-level geocode cache across instances (FR-036 dedup)'
);
assert.match(
  globalCss,
  /\.leg-route-map\s*\{/,
  '.leg-route-map must have visible styling'
);
assert.match(
  globalCss,
  /\.leg-route-map-iframe\s*\{/,
  '.leg-route-map-iframe must reserve space and style the inline iframe'
);
assert.match(
  globalCss,
  /\.leg-route-map-attribution\s*\{/,
  '.leg-route-map-attribution must style the provider copyright line'
);
// FR-032 supersession: the FR-027 standalone map and the FR-032
// strip classes are no longer rendered on the trip detail page. The
// CSS rules are kept (the source files are kept for backwards
// compatibility) but the trip detail JSX does not reference them.
// We assert that the trip detail source does not reference the
// removed class names. The CSS rules themselves can stay.

console.log('OIDC source checks passed.');
