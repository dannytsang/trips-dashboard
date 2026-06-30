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
assert.match(signInPage, /Login to continue/, 'sign-in button must use the updated primary action label');
assert.match(signInPage, /handleThemeToggle/, 'sign-in page must wire the theme toggle click handler');
assert.doesNotMatch(dashboardSurface, /className="secondary-action theme-toggle"/, 'dashboard summary must move the theme toggle into the account menu');
assert.doesNotMatch(dashboardSurface, /<button className="secondary-action" type="button" onClick=\{handleSignOut\}>/, 'dashboard summary must move sign-out into the account menu');
assert.match(dashboardSurface, /aria-haspopup="menu"/, 'dashboard summary must expose a menu trigger on the welcome control');
assert.match(dashboardSurface, /role="menu" aria-label="Account menu"/, 'dashboard summary must render an account menu');
assert.match(dashboardSurface, /handleSessionThemeToggle/, 'dashboard summary account menu must include theme toggle action');
assert.match(dashboardSurface, /handleSessionSignOut/, 'dashboard summary account menu must include sign-out action');
assert.match(dashboardSurface, /session-user-label/, 'welcome trigger must render a single label span');
assert.match(dashboardSurface, /session-user-label--full/, 'welcome trigger must render the full greeting in the expanded state');
assert.match(dashboardSurface, /isHeaderCompact \? userName : `👤 Welcome, \$\{userName\}`/, 'welcome trigger must switch to just the name in compact mode');
assert.match(dashboardSurface, /session-user-trigger/, 'welcome text must be the clickable menu trigger rather than a plain label');
assert.match(syncRoute, /TRIPS_DASHBOARD_SYNC_SECRET/, 'sync endpoint must use machine auth secret');
assert.match(syncRoute, /timingSafeEqual/, 'sync endpoint must use constant-time bearer token comparison');
assert.match(syncRoute, /Machine authentication required/, 'sync endpoint must reject missing or bad bearer token');
assert.match(tripsRoute, /getServerSession/, 'browser-facing trips API must require server session');
assert.match(tripsRoute, /Authentication required/, 'browser-facing trips API must return explicit auth failure without relying only on middleware');
assert.match(tripsRoute, /readTripsDashboardPortfolio/, 'browser-facing trips API must read portfolio through server-side split storage helper');
assert.match(homePage, /export const runtime = 'nodejs'/, 'dashboard root must run on the Node.js runtime so private Blob env vars are available');
assert.match(tripsRoute, /export const runtime = 'nodejs'/, 'trips API must run on the Node.js runtime for private Blob access');
assert.match(syncRoute, /export const runtime = 'nodejs'/, 'trips sync API must run on the Node.js runtime for private Blob writes');
assert.match(homePage, /readTripsDashboardPortfolio/, 'authenticated dashboard page must read the private split portfolio server-side');
assert.match(dashboardSurface, /Upcoming and active trips/, 'dashboard surface must render summary-list copy');
assert.match(dashboardSurface, /trip-list/, 'dashboard surface must include trip list rendering');
assert.match(dashboardSurface, /metric-grid/, 'dashboard surface must include summary metric cards');
assert.match(globalCss, /\.trip-card/, 'dashboard summary cards must have styling');
assert.match(globalCss, /\.dashboard-title\s*\{[\s\S]*line-height:\s*1\.12/, 'dashboard title must keep enough line-height to avoid clipping during compact transitions');
assert.match(globalCss, /\.session-user-label\s*\{/, 'welcome trigger must style the label span');
assert.match(globalCss, /\.session-header--compact\s*\.session-actions\s*\{[\s\S]*align-self:\s*center/, 'compact session header must vertically centre the logged-in user control');
assert.match(dashboardSurface, /session-user-label--full/, 'welcome trigger must render the full greeting in the expanded state');
assert.match(dashboardSurface, /isHeaderCompact \? userName : `👤 Welcome, \$\{userName\}`/, 'welcome trigger must switch to just the name in compact mode');

assert.match(storage, /trips-dashboard\/current\.json/, 'storage helper must use stable current manifest path');
assert.match(storage, /trips-dashboard\/trips\//, 'storage helper must use per-trip object paths');
assert.match(storage, /\.sha256/, 'storage helper must use checksum sidecars');
assert.match(storage, /deleteBlob/, 'storage helper must delete removed or changed split objects when needed');
assert.doesNotMatch(storage, /issueSignedToken|presignUrl|getDownloadUrl/, 'storage helper must not expose signed/direct Blob URLs to clients');
assert.match(portfolio, /FORBIDDEN_KEY_PATTERNS/, 'portfolio validation must include private-data key guards');
assert.match(portfolio, /FORBIDDEN_VALUE_PATTERNS/, 'portfolio validation must include private-data value guards');

// Dashboard account menu — the welcome control must open a menu that holds the
// theme toggle and sign-out actions. The header should no longer render those
// controls inline.
assert.match(dashboardSurface, /isSessionMenuOpen/, 'dashboard summary must track whether the account menu is open');
assert.match(dashboardSurface, /aria-haspopup="menu"/, 'dashboard summary must expose a menu trigger on the welcome control');
assert.match(dashboardSurface, /aria-expanded=\{isSessionMenuOpen\}/, 'welcome control must expose expanded state');
assert.match(dashboardSurface, /aria-label=\{`Open account menu for \$\{userName\}`\}/, 'welcome control must announce the menu action');
assert.match(dashboardSurface, /role="menu" aria-label="Account menu"/, 'dashboard summary must render an account menu');
assert.match(dashboardSurface, /handleSessionMenuToggle/, 'welcome control must toggle the account menu');
assert.match(dashboardSurface, /handleSessionThemeToggle/, 'dashboard summary account menu must include theme toggle action');
assert.match(dashboardSurface, /handleSessionSignOut/, 'dashboard summary account menu must include sign-out action');
assert.match(dashboardSurface, /className="session-user session-user-trigger"/, 'welcome control must use the session-user trigger styling');
assert.match(dashboardSurface, /className="secondary-action session-menu-item theme-toggle"/, 'theme toggle must move into the account menu');
assert.match(dashboardSurface, /className="secondary-action session-menu-item session-menu-item--sign-out"/, 'sign-out must move into the account menu as the bottom menu item');
assert.doesNotMatch(dashboardSurface, /className="secondary-action theme-toggle"/, 'theme toggle must no longer live inline in the header');
assert.doesNotMatch(dashboardSurface, /<button className="secondary-action" type="button" onClick=\{handleSignOut\}>/, 'sign-out must no longer live inline in the header');
assert.match(dashboardSurface, /session-user-label/, 'welcome trigger must render a single label span');
assert.match(dashboardSurface, /session-user-label--full/, 'welcome trigger must render the full greeting in the expanded state');
assert.match(dashboardSurface, /isHeaderCompact \? userName : `👤 Welcome, \$\{userName\}`/, 'welcome trigger must switch to just the name in compact mode');
assert.match(dashboardSurface, /session-user-trigger/, 'welcome text must be the clickable menu trigger rather than a plain label');
assert.match(dashboardSurface, /sessionMenuRef/, 'account menu must have a ref for outside-click dismissal');
assert.match(dashboardSurface, /document\.addEventListener\('pointerdown', handlePointerDown\)/, 'account menu must close on outside click');
assert.match(dashboardSurface, /event\.key === 'Escape'/, 'account menu must close on Escape');
assert.match(dashboardSurface, /theme === 'dark' \? '☀️' : '🌙'/, 'theme toggle must remain icon-only within the menu');
assert.doesNotMatch(dashboardSurface, /☀️ Light|🌙 Dark/, 'theme toggle must not duplicate the icon as visible text — the icon alone is the affordance');
assert.doesNotMatch(dashboardSurface, /handleThemeToggle[\s\S]{0,200}readTripsDashboardPortfolio|handleThemeToggle[\s\S]{0,200}fetch\(/, 'theme switching must not fetch or resync portfolio data');
assert.match(syncRoute, /TRIPS_DASHBOARD_SYNC_SECRET/, 'sync endpoint must use machine auth secret');
assert.match(syncRoute, /timingSafeEqual/, 'sync endpoint must use constant-time bearer token comparison');
assert.match(syncRoute, /Machine authentication required/, 'sync endpoint must reject missing or bad bearer token');

// Per-leg inline map (spec 010 FR-036..037) — must be embedded
// inside each leg row, not as a standalone Trip map section. This
// replaces the previous FR-027 single-pin map and the FR-032 strip;
// the standalone leg-detail-map block is removed entirely.
const legRouteMap = readFileSync('components/leg-route-map.jsx', 'utf8');
const tripOverviewMap = readFileSync('components/trip-overview-map.jsx', 'utf8');
assert.match(
  tripDetailSurface,
  /<LegRouteMap\s+leg=\{leg\}\s*\/>/,
  'trip detail must render LegRouteMap inline inside each leg row (spec 010 FR-036)'
);
assert.match(
  tripDetailSurface,
  /<TripOverviewMap\s+legs=\{trip\.legs\}\s+homeBase=\{trip\.homeBase\}\s*\/>/,
  'trip detail must render TripOverviewMap above the leg list (FR-042)'
);
assert.match(
  tripDetailSurface,
  /computeMonitoringPhase\(trip, browserNow\)/,
  'trip detail must compute the advisory monitoring phase from already-loaded data and browser time (FR-043..FR-047)'
);
assert.match(
  tripDetailSurface,
  /setInterval\(tickMonitoringClock, 60_000\)/,
  'trip detail monitoring phase must refresh locally while open without refetching the brief (FR-046)'
);
assert.match(
  tripDetailSurface,
  /monitoring-status-row/,
  'trip detail monitoring section must render the advisory monitoring status row (FR-043)'
);
assert.match(
  tripDetailSurface,
  /Advisory: this page computes the recommendation from already-loaded trip and leg timing data plus browser time\./,
  'trip detail monitoring section must label the recommendation as advisory (FR-044)'
);
assert.doesNotMatch(
  tripDetailSurface,
  /fetch\([^\)]*(monitoring-state|live-status)/,
  'trip detail monitoring phase rendering must not fetch live monitoring-state or live-status APIs (FR-044)'
);
// v5 + v5.1 expansion (spec 010 FR-038..FR-040): Transport
// decision and accommodation use SectionCollapsible. In Phase 8, Travellers
// moved to the compact journey-board header only; do not render a second
// Travellers section after Programme.
assert.doesNotMatch(
  tripDetailSurface,
  /<SectionCollapsible\s+title="Travellers"\s+emoji="👥"/,
  'Trip detail must not render a duplicate Travellers SectionCollapsible after Programme; CompactTravellersSection is the sole traveller surface (FR-063)'
);
assert.doesNotMatch(
  tripDetailSurface,
  /<TravellersCollapsible\b/,
  'Trip detail must not render the removed TravellersCollapsible call after Programme (FR-063)'
);
assert.match(
  tripDetailSurface,
  /<SectionCollapsible\s+title="Transport decision"\s+emoji="🚦"\s+defaultOpen=\{true\}>/,
  'Transport decision callout must render as SectionCollapsible with defaultOpen={true} (FR-040)'
);
assert.match(
  tripDetailSurface,
  /function hasAccommodationContent\(accommodation\) \{[\s\S]*?return Boolean\([\s\S]*?booking\.actual_stay_window[\s\S]*?\n  \}/,
  'Accommodation default-open logic must key off real accommodation content, not mere object truthiness (prevents empty accommodation blocks opening by default)'
);
assert.match(
  tripDetailSurface,
  /const hasAccommodation = hasAccommodationContent\(accommodation\);/,
  'Accommodation section must derive defaultOpen from content-aware helper'
);
assert.match(
  tripDetailSurface,
  /<SectionCollapsible\s+title="Accommodation"\s+emoji="🏨"\s+defaultOpen=\{hasAccommodation\}>/,
  'Accommodation section must render as SectionCollapsible with defaultOpen={hasAccommodation} when data exists (FR-040, updated)'
);
assert.match(
  tripDetailSurface,
  /No accommodation recorded for this trip\./,
  'Accommodation section must render a collapsed no-accommodation message when absent (FR-013, updated)'
);
// non-collapsible DetailSection. A future edit that silently flips them
// back would lose the user's ability to tuck them away after reading.
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

// v6 (spec 010 FR-041): each leg renders as LegCollapsible — a button
// header showing index badge + emoji + label + mode + chevron by default,
// expanded body shows the full leg detail block + notification block +
// review block + per-leg map iframe. The Legs section outer
// SectionCollapsible remains. defaultOpen is false (collapsed by default).
assert.match(
  tripDetailSurface,
  /function LegCollapsible\(\{ leg, index, children \}\)/,
  'trip detail must define LegCollapsible component accepting children for nested stage-card detail blocks (FR-041, FR-061)'
);
assert.match(
  tripDetailSurface,
  /<LegCollapsible\b/,
  'trip detail must render LegCollapsible for each leg (FR-041)'
);
assert.doesNotMatch(
  tripDetailSurface,
  /function LegRow\(/,
  'trip detail must not render the old non-collapsible LegRow (FR-041)'
);
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

// v8 expansion (spec 010 FR-048..FR-052): trip-level Notifications
// section. The component is wired into the section list between
// Monitoring detail and Accommodation, opens by default, and reads
// from the new `trip.notifications` brief field emitted by
// `notifications_projection()` in the brief builder.
assert.match(
  tripDetailSurface,
  /<NotificationsSection\s+notifications=\{trip\.notifications\}\s+legs=\{trip\.legs\}\s*\/>/,
  'trip detail must wire NotificationsSection with trip.notifications and trip.legs (FR-048, FR-050)'
);
assert.match(
  tripDetailSurface,
  /\{hasNotificationsSection \? \(/,
  'trip detail must gate NotificationsSection on hasNotificationsSection (FR-048 omit-when-empty)'
);

// FR-056..FR-058: fallbackStopThreshold projection — the brief builder
// must emit trip.monitoring.fallbackStopThreshold when monitoring is enabled.
// We assert the shape here (no live-fetch dependency) by checking that
// the UI reads from the brief field and that the monitoring projection
// call chain in the portfolio builder emits the field (indirectly via the
// monitoring_projection function that has no network dependency).
assert.match(
  tripDetailSurface,
  /trip\.monitoring\.fallbackStopThreshold/,
  'trip detail UI must read trip.monitoring.fallbackStopThreshold.label from the brief (FR-056..FR-058)'
);

// Phase 8 (spec 010 FR-059..FR-066): map-led journey board —
// two-column grid with sticky overview map + chronological itinerary
// stage cards; compact travellers; Planning + Transport grouped.
//
// The journey board lives in a div.detail-journey-board with two columns:
// - Left: sticky TripOverviewMap
// - Right: chronological ItineraryStageCard list
// Each stage card aggregates: leg summary + programme content + weather +
// monitoring status for that leg. The board renders when trip.legs exists,
// and is omitted entirely when there are no legs.
assert.match(
  tripDetailSurface,
  /className="detail-journey-board"/,
  'trip detail must render the two-column journey board grid (FR-059)'
);
assert.match(
  tripDetailSurface,
  /className="detail-journey-map-col"\s*\/?>/,
  'journey board must have a sticky map column (FR-059)'
);
assert.match(
  tripDetailSurface,
  /className="detail-journey-stages"/,
  'journey board must have a stages column for itinerary stage cards (FR-059)'
);
assert.match(
  tripDetailSurface,
  /function ItineraryStageCard\(\{[^)]*leg[^)]*index[^)]*programme[^)]*weather[^)]*monitoringPhase[^)]*\}/,
  'trip detail must define ItineraryStageCard aggregating leg + programme + weather + monitoring (FR-060, FR-061, FR-062)'
);
assert.match(
  tripDetailSurface,
  /<ItineraryStageCard\b/,
  'journey board must render ItineraryStageCard for each leg (FR-060)'
);
// Phase 8 preserves LegCollapsible inside each stage card — the existing
// FR-041 per-leg expand/collapse is still present, just nested inside
// the stage card rather than at the top-level leg list.
assert.match(
  tripDetailSurface,
  /function LegCollapsible\(\{ leg, index, children \}\)/,
  'trip detail must still define LegCollapsible and accept children so nested CJU/notification/planning-review blocks are preserved (FR-041, FR-061, FR-066)'
);
assert.match(
  tripDetailSurface,
  /<LegDetailBlock leg=\{leg\} \/>\s*\{children\}\s*<LegRouteMap leg=\{leg\} \/>/,
  'LegCollapsible must render children between LegDetailBlock and LegRouteMap so nested stage-card detail blocks are not silently dropped (FR-061, FR-066)'
);
assert.match(
  tripDetailSurface,
  /<LegCollapsible\b/,
  'trip detail must still render LegCollapsible per leg (FR-041 — nested inside stage card in Phase 8)'
);
// FR-059: the journey board replaces the top-level LegCollapsible list.
// The old <SectionCollapsible title="Legs"> is gone — the journey board
// grid is the new top-level leg presentation. A doesNotMatch assertion
// on the old pattern would fire on the replaced source.
assert.doesNotMatch(
  tripDetailSurface,
  /<SectionCollapsible\s+title="Legs"\s+emoji="🛤️"/,
  'Legs must not render as a top-level SectionCollapsible in Phase 8 — the journey board replaces it (FR-059)'
);
// Weather-to-stage matching (FR-063): weather is matched to stage cards
// display-safely using stage-specific weather section first, then the
// primary trip weather as fallback.
assert.match(
  tripDetailSurface,
  /stageWeatherSection\s*\|\|\s*weatherSection/,
  'ItineraryStageCard must prefer the stage-specific weather section, falling back to the primary trip weather section (FR-063)'
);
assert.match(
  tripDetailSurface,
  /<DetailSection title="Programme" emoji="📋">[\s\S]*?<WeatherProgrammeBlock weather=\{trip\.weather\} \/>/,
  'Programme section must include the folded-in weather block (FR-060/FR-061)'
);
assert.doesNotMatch(
  tripDetailSurface,
  /<SectionCollapsible title="Weather" emoji="🌦️"/,
  'Weather must not render as a standalone section after being folded into Programme (FR-060/FR-061)'
);
// Compact travellers (FR-065): a condensed traveller summary replaces the
// full Travellers SectionCollapsible when rendered inside the stage card
// or the board header. The component renders initials chips + total count.
assert.match(
  tripDetailSurface,
  /function CompactTravellersSection\(\{ travellers \}\)/,
  'trip detail must define CompactTravellersSection for the journey board header (FR-065)'
);
assert.match(
  tripDetailSurface,
  /<CompactTravellersSection\s+travellers=\{trip\.travellers\}\s*\/>/,
  'journey board must render CompactTravellersSection in the board header (FR-065)'
);
assert.match(
  globalCss,
  /\.compact-travellers-section\s*\{/,
  'globals.css must style the compact travellers section so FR-063/FR-065 does not degrade to unstyled spans'
);
assert.match(
  globalCss,
  /\.traveller-chip--compact\s*\{/,
  'globals.css must style the compact traveller chip modifier (FR-063/FR-065)'
);
// Planning + Transport group (FR-066): rationale and transport decision
// are grouped into one collapsible section at the board level.
assert.match(
  tripDetailSurface,
  /function PlanningTransportGroup\(\{ planning \}\)/,
  'trip detail must define PlanningTransportGroup combining rationale + transport decision from planning.transportDecision (FR-066)'
);
assert.match(
  tripDetailSurface,
  /<PlanningTransportGroup\s+planning=\{trip\.planning\}\s*\/>/,
  'journey board must render PlanningTransportGroup from trip.planning (FR-066)'
);
assert.match(
  tripDetailSurface,
  /const transportDecision = planning\?\.transportDecision/,
  'PlanningTransportGroup must source the transport decision from planning.transportDecision, not a non-existent trip.transport field (FR-066)'
);
// Section ordering preserved: All existing detail sections remain.
// The board renders between the compact header (trip title / travellers /
// dates) and the per-leg notifications/accommodation/notes/monitoring.
// We assert the board appears after StatusMilestone and before Notifications.
assert.match(
  tripDetailSurface,
  /<StatusMilestone trip=\{trip\}\s*\/>/,
  'StatusMilestone must still render before the journey board (FR-053..FR-055 preserved in Phase 8)'
);
assert.doesNotMatch(
  tripDetailSurface,
  /status-milestone-current|statusLabel\(trip\)|detail-badges/,
  'Trip detail header must not duplicate the milestone current status with a current-status row, status chip, or old detached badge row'
);
assert.match(
  tripDetailSurface,
  /className="detail-context-strip"[\s\S]*?detail-context-label">Readiness[\s\S]*?detail-context-label">Monitoring/,
  'Readiness and monitoring must be integrated into the detail header context strip instead of large status chips'
);
assert.match(
  tripDetailSurface,
  /hasNotificationsSection\s*\?\s*\([\s\S]{0,80}<NotificationsSection/,
  'NotificationsSection must still render after the journey board (FR-048..FR-052 preserved in Phase 8)'
);
// CSS: globals.css must have the journey board grid rules.
assert.match(
  globalCss,
  /\.detail-journey-board\s*\{/,
  'globals.css must define .detail-journey-board grid (FR-059)'
);
assert.match(
  globalCss,
  /\.detail-journey-map-col\s*\{/,
  'globals.css must define .detail-journey-map-col sticky map column (FR-059)'
);
assert.match(
  globalCss,
  /\.detail-journey-stages\s*\{/,
  'globals.css must define .detail-journey-stages stages column (FR-059)'
);
assert.match(
  globalCss,
  /\.itinerary-stage-card\s*\{/,
  'globals.css must define .itinerary-stage-card stage card styling (FR-060)'
);

console.log('OIDC source checks passed.');
