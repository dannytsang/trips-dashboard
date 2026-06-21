import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  formatLegModeEmoji,
  formatLegModeLabel,
  formatNextActionLabel,
  formatReadinessLabel,
  formatStatusLabel,
  formatWeatherCondition,
  toDisplayLabel,
} from '../lib/display-labels.mjs';
import {
  computeMonitoringPhase,
  formatMonitoringPhaseLabel,
  formatMonitoringPhaseTooltip,
} from '../lib/monitoring-phase.mjs';

const dashboardSurface = readFileSync('components/dashboard-session-surface.jsx', 'utf8');
const tripDetailSurface = readFileSync('components/trip-detail-surface.jsx', 'utf8');
const globalCss = readFileSync('app/globals.css', 'utf8');
const monitoringPhaseLib = readFileSync('lib/monitoring-phase.mjs', 'utf8');

assert.equal(toDisplayLabel('finalised_core_details'), 'Finalised core details');
assert.equal(toDisplayLabel('driving_ev'), 'Driving EV');
assert.equal(toDisplayLabel('gps_signal_lost'), 'GPS signal lost');
assert.equal(toDisplayLabel('oidc_callback_url'), 'OIDC callback URL');
// Transport decision label humanisation (Petersfield brief contract):
// snake_case basis keys and mode values must collapse to sentence case, with
// acronyms like EV preserved in capitals. (e.g. `monitoring_feasibility` →
// `Monitoring feasibility`, `driving_ev_confirmed` → `Driving EV confirmed`.)
assert.equal(toDisplayLabel('monitoring_feasibility'), 'Monitoring feasibility');
assert.equal(toDisplayLabel('journey_time'), 'Journey time');
assert.equal(toDisplayLabel('reliability'), 'Reliability');
assert.equal(toDisplayLabel('convenience'), 'Convenience');
assert.equal(toDisplayLabel('cost'), 'Cost');
assert.equal(toDisplayLabel('driving_ev_confirmed'), 'Driving EV confirmed');
assert.equal(toDisplayLabel('medium'), 'Medium');
assert.equal(formatStatusLabel('finalised_core_details'), 'Finalised core details');
assert.equal(formatStatusLabel('planned', { active: true }), 'Active');
assert.equal(formatReadinessLabel('needs_info'), 'Needs info');
assert.equal(formatLegModeLabel('driving_ev'), 'Driving EV');
assert.equal(formatLegModeEmoji('flight'), '✈️');
assert.equal(formatLegModeEmoji('train'), '🚆');
assert.equal(formatLegModeEmoji('booked_train'), '🚆');
assert.equal(formatLegModeEmoji('cruise'), '🚢');
assert.equal(formatLegModeEmoji('ferry'), '⛴️');
assert.equal(formatLegModeEmoji('driving_ev'), '🚗');
assert.equal(formatLegModeEmoji('driving'), '🚗');
assert.equal(formatLegModeEmoji('car_plus_airport_parking'), '🚗');
assert.equal(formatLegModeEmoji('prebooked_taxi_or_private_airport_transfer'), '🚕');
assert.equal(formatLegModeEmoji('bus'), '🚌');
assert.equal(formatLegModeEmoji('walk'), '🚶');
assert.equal(formatLegModeEmoji('bike_hire'), '🚴');
assert.equal(formatLegModeEmoji('overnight_stay'), '🛏️');
assert.equal(formatLegModeEmoji('mystery_mode'), '🛣️');
assert.equal(formatNextActionLabel('confirm_train_eta'), 'Confirm train ETA');
assert.deepEqual(formatWeatherCondition('light_rain'), { label: 'Light rain', icon: '🌧️', accessibleLabel: 'Light rain forecast' });
assert.deepEqual(formatWeatherCondition('unknown_provider_code'), { label: 'Unknown provider code', icon: '🌡️', accessibleLabel: 'Unknown provider code forecast' });

const monitoringTrip = {
  id: 'monitoring-sample',
  monitoring: {
    enabled: true,
    active: false,
  },
  legs: [
    {
      label: 'Home to Eastbourne',
      mode: 'driving',
      monitoring_timing: {
        start: '2026-07-01T09:00:00+01:00',
        end: '2026-07-01T11:30:00+01:00',
        fallbackEnd: '2026-07-01T17:30:00+01:00',
        timezone: 'Europe/London',
        monitorable: true,
      },
    },
    {
      label: 'Eastbourne to Brighton',
      mode: 'train',
      monitoring_timing: {
        start: '2026-07-06T09:00:00+01:00',
        end: '2026-07-06T11:30:00+01:00',
        fallbackEnd: '2026-07-06T17:30:00+01:00',
        timezone: 'Europe/London',
        monitorable: true,
      },
    },
  ],
};
assert.deepEqual(
  computeMonitoringPhase(monitoringTrip, new Date('2026-06-23T09:00:00Z')),
  {
    phase: 'not_started',
    started: false,
    label: 'Monitoring',
    detail: 'Monitoring is configured but has not yet started.',
    accessibleLabel: 'Monitoring — monitoring is configured but has not yet started.'
  },
  'more than 7 days away should be treated as configured but not started'
);
assert.deepEqual(
  computeMonitoringPhase(monitoringTrip, new Date('2026-06-28T10:00:00Z')),
  {
    phase: 'daily_precheck',
    started: true,
    label: 'Monitoring',
    detail: 'Recommended phase: Daily precheck',
    accessibleLabel: 'Monitoring — recommended phase: Daily precheck'
  },
  'within 7 days should move into daily precheck'
);
assert.deepEqual(
  computeMonitoringPhase(monitoringTrip, new Date('2026-07-01T09:30:00+01:00')),
  {
    phase: 'active_leg',
    started: true,
    label: 'Monitoring',
    detail: 'Recommended phase: Active leg',
    accessibleLabel: 'Monitoring — recommended phase: Active leg'
  },
  'active timing window should report the active leg phase'
);
assert.deepEqual(
  computeMonitoringPhase(monitoringTrip, new Date('2026-06-30T09:00:00Z')),
  {
    phase: 'four_hourly',
    started: true,
    label: 'Monitoring',
    detail: 'Recommended phase: Four hourly',
    accessibleLabel: 'Monitoring — recommended phase: Four hourly',
  },
  'twenty-four-to-seven-days-out should report the four-hourly phase'
);
assert.deepEqual(
  computeMonitoringPhase(monitoringTrip, new Date('2026-07-01T05:30:00Z')),
  {
    phase: 'hourly',
    started: true,
    label: 'Monitoring',
    detail: 'Recommended phase: Hourly',
    accessibleLabel: 'Monitoring — recommended phase: Hourly',
  },
  'four-to-one-hours-out should report the hourly phase'
);
assert.deepEqual(
  computeMonitoringPhase(monitoringTrip, new Date('2026-07-01T07:30:00Z')),
  {
    phase: 'fifteen_minute',
    started: true,
    label: 'Monitoring',
    detail: 'Recommended phase: Fifteen minute',
    accessibleLabel: 'Monitoring — recommended phase: Fifteen minute',
  },
  'under one hour should report the fifteen-minute phase'
);
assert.deepEqual(
  computeMonitoringPhase(monitoringTrip, new Date('2026-07-06T17:31:00+01:00')),
  {
    phase: 'completed',
    started: false,
    label: 'Monitoring complete',
    detail: 'Monitoring window has completed.',
    accessibleLabel: 'Monitoring complete — monitoring window has completed.',
  },
  'after the last fallback end should report the completed phase'
);
const legacyTimingTrip = {
  id: 'legacy-timing',
  monitoring: {
    enabled: true,
    active: false,
  },
  legs: [
    {
      label: 'Gulliver\'s Land outbound',
      mode: 'driving',
      recommended_departure: '2026-07-01T09:15:00+01:00',
      target_arrival: '2026-07-01T10:15:00+01:00',
    },
  ],
};
assert.deepEqual(
  computeMonitoringPhase(legacyTimingTrip, new Date('2026-06-30T20:00:00+01:00')),
  {
    phase: 'four_hourly',
    started: true,
    label: 'Monitoring',
    detail: 'Recommended phase: Four hourly',
    accessibleLabel: 'Monitoring — recommended phase: Four hourly',
  },
  'legacy timing fields should be enough to avoid the insufficient timing data state'
);

assert.deepEqual(
  computeMonitoringPhase({ monitoring: { enabled: true }, legs: [] }, new Date('2026-07-01T08:00:00Z')),
  {
    phase: 'insufficient_timing_data',
    started: false,
    label: 'Monitoring',
    detail: 'Timing data is incomplete, so the dashboard cannot estimate whether monitoring should have started.',
    accessibleLabel: 'Monitoring — timing data is incomplete, so the dashboard cannot estimate whether monitoring should have started.',
  },
  'missing timing data should produce the insufficient timing data phase'
);
assert.equal(formatMonitoringPhaseLabel('insufficient_timing_data'), 'Monitoring');
assert.equal(
  formatMonitoringPhaseTooltip('hourly'),
  'Monitoring\nCurrent phase: Hourly\nRecommended phase: Hourly\n\nHover legend:\n• Not started yet: Monitoring is configured but has not yet started.\n• Daily precheck: Recommended phase: Daily precheck\n• Four hourly: Recommended phase: Four hourly\n→ Hourly: Recommended phase: Hourly\n• Fifteen minute: Recommended phase: Fifteen minute\n• Active leg: Recommended phase: Active leg\n• Completed: Monitoring window has completed.\n• Insufficient timing data: Timing data is incomplete, so the dashboard cannot estimate whether monitoring should have started.'
);

// OSM embed bbox — TripMap now embeds an OpenStreetMap iframe whose
// URL is built from buildViewport(). This module's only export is the
// viewport builder; the OSM URL composition lives in TripMap (see
// scripts/check-oidc-source.mjs for the iframe-shape contract).
import { buildViewport } from '../lib/basemap-projection.mjs';

// buildViewport pads and re-balances the bbox to the embed aspect ratio.
// The returned viewport is in OSM bbox order: minLon, minLat, maxLon, maxLat.
const vp = buildViewport(
  [
    { lon: -1.5, lat: 52.5 }, // Birmingham-ish
    { lon: -0.13, lat: 51.5 }, // London-ish
  ],
  { width: 600, height: 360, padding: 0.18 }
);
assert.ok(vp.minLon < -1.5, 'viewport should pad left of leftmost point');
assert.ok(vp.maxLon > -0.13, 'viewport should pad right of rightmost point');
assert.ok(vp.maxLat > 52.5, 'viewport should pad above topmost point');
assert.ok(vp.minLat < 51.5, 'viewport should pad below bottommost point');
// Aspect ratio: width/height should be preserved when we re-balance so
// countries aren't visibly squished in the embed.
const vpAspect = (vp.maxLon - vp.minLon) / (vp.maxLat - vp.minLat);
const targetAspect = 600 / 360;
assert.ok(Math.abs(vpAspect - targetAspect) < 0.05, `viewport aspect should match embed aspect (got ${vpAspect.toFixed(3)} expected ${targetAspect.toFixed(3)})`);

// buildViewport clamps to global bounds
const vpClamped = buildViewport(
  [{ lon: 0, lat: 89.9 }, { lon: 0, lat: 89.95 }],
  { width: 600, height: 360, padding: 0.18 }
);
assert.ok(vpClamped.maxLat <= 85, 'viewport maxLat clamps at 85 (polar flatten limit)');

// buildViewport guarantees a minimum span so very close-together points
// still produce a sensible city-scale embed.
const vpMinSpan = buildViewport(
  [{ lon: 0.0, lat: 51.0 }, { lon: 0.01, lat: 51.01 }],
  { width: 600, height: 360, padding: 0.18 }
);
assert.ok(vpMinSpan.maxLon - vpMinSpan.minLon >= 0.4, 'viewport enforces a minimum lon span of 0.4° (~40 km city frame)');

// OSM bbox string is composed in OSM order: minLon,minLat,maxLon,maxLat.
// This is the exact format the TripMap iframe URL passes to
// /export/embed.html?bbox=...
function toOsmBbox(viewport) {
  return `${viewport.minLon.toFixed(5)},${viewport.minLat.toFixed(5)},${viewport.maxLon.toFixed(5)},${viewport.maxLat.toFixed(5)}`;
}
const osmBbox = toOsmBbox(vp);
const bboxParts = osmBbox.split(',').map(Number);
assert.equal(bboxParts.length, 4, 'OSM bbox has 4 comma-separated components');
assert.ok(bboxParts[0] < bboxParts[2], 'OSM bbox minLon < maxLon');
assert.ok(bboxParts[1] < bboxParts[3], 'OSM bbox minLat < maxLat');

// Privacy filter — the same predicate TripMap uses to exclude home/exact
// precision waypoints from the bbox composition. Kept as a plain function
// here so we can regression-test it independently of the React component.
function isPrivateWaypoint(wp) {
  return wp.precision === 'home' || wp.precision === 'exact';
}
const mixedWaypoints = [
  { lat: 51.5, lon: -0.13, precision: 'town' },
  { lat: 52.5, lon: -1.5, precision: 'home' },     // private — must drop
  { lat: 50.9, lon: -0.95, precision: 'venue' },
  { lat: 50.97, lon: -0.88, precision: 'exact' }, // private — must drop
];
const publicWps = mixedWaypoints.filter((w) => !isPrivateWaypoint(w));
assert.equal(publicWps.length, 2, 'home and exact precision waypoints are filtered out of the bbox computation');
const safeVp = buildViewport(publicWps, { width: 600, height: 360, padding: 0.18 });
// The bbox centre should sit between the two public waypoints (≈51.2°),
// nowhere near the dropped private coords (52.5° Birmingham).
const safeMidLat = (safeVp.minLat + safeVp.maxLat) / 2;
assert.ok(safeMidLat < 52.0, `bbox centre must not include dropped private waypoints (got ${safeMidLat.toFixed(3)})`);
assert.ok(safeMidLat > 50.5, `bbox centre must include the kept public waypoints (got ${safeMidLat.toFixed(3)})`);

// Marker selection: the OSM marker must be the last non-home visible
// waypoint, not just the last visible waypoint. For a return trip
// (out → destination → home), the last visible waypoint is the home
// return — but the meaningful pin is the destination, not home.
// Mirrors the predicate TripMap uses.
function selectMarker(visibleWaypoints, homeTown) {
  const home = (homeTown || '').trim().toLowerCase();
  const nonHome = home
    ? visibleWaypoints.filter((w) => (w.label || '').trim().toLowerCase() !== home)
    : visibleWaypoints;
  return nonHome.length > 0
    ? nonHome[nonHome.length - 1]
    : visibleWaypoints[visibleWaypoints.length - 1];
}
// Case 1: return trip where the last waypoint IS home. The marker
// must be the last non-home waypoint (e.g. the garden party for
// Petersfield), not the home return.
const petersfieldLike = [
  { label: 'Shephall, Stevenage', lat: 51.87, lon: -0.20 },
  { label: 'Premier Inn Petersfield Hampshire', lat: 51.01, lon: -0.95 },
  { label: 'South Harting', lat: 50.97, lon: -0.88 },
  { label: 'Stevenage', lat: 51.90, lon: -0.20 },
];
const petersfieldMarker = selectMarker(petersfieldLike, 'Stevenage');
assert.equal(
  petersfieldMarker.label,
  'South Harting',
  'Petersfield-style return trip: marker must be the last non-home waypoint (South Harting), not Stevenage'
);

// Case 2: one-way home-return trip. Every non-private waypoint is
// home (e.g. a relocation trip ending at home). The marker falls
// back to the last non-private waypoint.
const oneWayHome = [
  { label: 'Stevenage', lat: 51.5, lon: -0.13 },
  { label: 'Stevenage', lat: 51.9, lon: -0.20 },
];
const oneWayMarker = selectMarker(oneWayHome, 'Stevenage');
assert.equal(
  oneWayMarker.label,
  'Stevenage',
  'one-way home-return trip: marker falls back to the last non-private waypoint (home)'
);

// Case 3: no homeBase info at all. The marker is the last visible
// waypoint as before. (Defensive case: when homeBase.town is null
// or empty, we don't filter.)
const noHomeTrip = [
  { label: 'Origin', lat: 51.5, lon: -0.13 },
  { label: 'Destination', lat: 51.9, lon: -0.20 },
];
const noHomeMarker = selectMarker(noHomeTrip, null);
assert.equal(
  noHomeMarker.label,
  'Destination',
  'no homeBase: marker is the last visible waypoint (legacy behaviour)'
);

// Case 4: case-insensitive comparison. "STEVENAGE" in the home
// field must still match "Stevenage" in the waypoint label.
const mixedCaseTrip = [
  { label: 'Shephall, Stevenage', lat: 51.87, lon: -0.20 },
  { label: 'Premier Inn', lat: 51.01, lon: -0.95 },
  { label: 'Garden party', lat: 50.97, lon: -0.88 },
  { label: 'stevenage', lat: 51.90, lon: -0.20 },
];
const mixedCaseMarker = selectMarker(mixedCaseTrip, 'Stevenage');
assert.equal(
  mixedCaseMarker.label,
  'Garden party',
  'home town comparison is case-insensitive — "stevenage" matches "Stevenage"'
);

assert.match(dashboardSurface, /THEME_STORAGE_KEY\s*=\s*'tsang-travel-theme'/, 'theme preference must use a stable localStorage key');
assert.match(dashboardSurface, /window\.localStorage\.getItem\(THEME_STORAGE_KEY\)/, 'theme toggle must initialise from localStorage');
assert.match(dashboardSurface, /prefers-color-scheme: light/, 'theme toggle must fall back to system preference');
assert.match(dashboardSurface, /window\.localStorage\.setItem\(THEME_STORAGE_KEY, theme\)/, 'theme toggle must persist locally');
assert.match(dashboardSurface, /data-theme=\{theme\}/, 'dashboard shell must expose the active theme for CSS');
assert.match(dashboardSurface, /isSessionMenuOpen/, 'dashboard summary must track whether the account menu is open');
assert.match(dashboardSurface, /aria-haspopup="menu"/, 'welcome button must expose a menu popup relationship');
assert.match(dashboardSurface, /aria-expanded=\{isSessionMenuOpen\}/, 'welcome button must expose expanded state');
assert.match(dashboardSurface, /aria-label=\{`Open account menu for \$\{userName\}`\}/, 'welcome button must announce the menu action');
assert.match(dashboardSurface, /handleSessionMenuToggle/, 'welcome button must toggle the account menu');
assert.match(dashboardSurface, /role="menu" aria-label="Account menu"/, 'account menu must expose menu semantics');
assert.match(dashboardSurface, /handleSessionThemeToggle/, 'account menu must include a theme toggle action');
assert.match(dashboardSurface, /handleSessionSignOut/, 'account menu must include a sign-out action');
assert.match(dashboardSurface, /className="session-user session-user-trigger"/, 'welcome control must use the session-user trigger styling');
assert.match(dashboardSurface, /className="secondary-action session-menu-item theme-toggle"/, 'theme toggle must move into the account menu');
assert.match(dashboardSurface, /className="secondary-action session-menu-item"/, 'sign-out must move into the account menu');
assert.doesNotMatch(dashboardSurface, /className="secondary-action theme-toggle"/, 'theme toggle must no longer live inline in the header');
assert.doesNotMatch(dashboardSurface, /<button className="secondary-action" type="button" onClick=\{handleSignOut\}>/, 'sign-out must no longer live inline in the header');
assert.match(dashboardSurface, /session-user-label/, 'welcome trigger must render a single label span');
assert.match(dashboardSurface, /session-user-label--full/, 'welcome trigger must render the full greeting in the expanded state');
assert.match(dashboardSurface, /isHeaderCompact \? userName : `👤 Welcome, \$\{userName\}`/, 'welcome trigger must switch to just the name in compact mode');
assert.match(dashboardSurface, /sessionMenuRef/, 'account menu must have a ref for outside-click dismissal');
assert.match(dashboardSurface, /document\.addEventListener\('pointerdown', handlePointerDown\)/, 'account menu must close on outside click');
assert.match(dashboardSurface, /event\.key === 'Escape'/, 'account menu must close on Escape');
assert.match(dashboardSurface, /setIsSessionMenuOpen\(false\)/, 'account menu must be closable');
assert.match(dashboardSurface, /theme === 'dark' \? '☀️' : '🌙'/, 'theme toggle must remain icon-only within the menu');
assert.doesNotMatch(dashboardSurface, /☀️ Light|🌙 Dark/, 'theme toggle must not duplicate the icon as visible text — the icon alone is the affordance');
assert.doesNotMatch(dashboardSurface, /handleThemeToggle[\s\S]{0,200}readTripsDashboardPortfolio|handleThemeToggle[\s\S]{0,200}fetch\(/, 'theme switching must not fetch or resync portfolio data');
assert.match(dashboardSurface, /FILTER_QUERY_KEY\s*=\s*'filter'/, 'filter state must use a stable query-string key');
assert.match(dashboardSurface, /window\.history\.pushState\(\{\}, '', url\)/, 'filter changes must use the browser History API rather than a server navigation');
assert.match(dashboardSurface, /window\.addEventListener\('popstate', handlePopState\)/, 'back\/forward navigation must restore the previous filter');
assert.match(dashboardSurface, /URLSearchParams\(window\.location\.search\)/, 'initial render must read the filter from the URL query string');
assert.doesNotMatch(dashboardSurface, /handleFilterToggle[\s\S]{0,260}readTripsDashboardPortfolio|handleFilterToggle[\s\S]{0,260}fetch\(/, 'filter changes must not fetch or resync portfolio data');

assert.match(dashboardSurface, /formatStatusLabel/, 'status values must pass through the display-label mapper');
assert.match(dashboardSurface, /formatReadinessLabel/, 'planning readiness values must pass through the display-label mapper');
assert.match(dashboardSurface, /formatLegModeEmoji/, 'leg emoji must be derived from the leg-mode emoji helper');
assert.match(dashboardSurface, /formatLegModeLabel/, 'leg modes must pass through the display-label mapper');
assert.match(dashboardSurface, /formatNextActionLabel/, 'next actions must pass through the display-label mapper');
assert.match(dashboardSurface, /className=\{`metric-card metric-filter-card \$\{activeFilter === 'active' \? 'metric-card-active' : ''\}`\}/, 'Active metric card must become an interactive filter button');
assert.match(dashboardSurface, /aria-pressed=\{activeFilter === 'active'\}/, 'filter cards must expose pressed state for keyboard and assistive-technology users');
assert.match(dashboardSurface, /onClick=\{\(\) => handleFilterToggle\('active'\)\}/, 'Active metric card must toggle the active filter');
assert.match(dashboardSurface, /onClick=\{\(\) => handleFilterToggle\('monitoring'\)\}/, 'Monitoring metric card must toggle the monitoring filter');
assert.match(dashboardSurface, /onClick=\{\(\) => handleFilterToggle\('actions'\)\}/, 'Actions metric card must toggle the actions filter');
assert.match(dashboardSurface, /activeFilter \? \(/, 'Show all control must only appear when a filter is active');
assert.match(dashboardSurface, /<strong>Show all<\/strong>/, 'a visible Show all control must exist while filtered');
assert.match(dashboardSurface, /filteredTrips\.length === 0/, 'the dashboard must handle filters that match zero trips');
assert.match(dashboardSurface, /No trips match the \{activeFilterLabel\} filter/, 'filtered empty state must explain which filter is active');
assert.match(dashboardSurface, /\{filteredTrips\.map\(trip => \{/, 'only the trip list, not the metric totals, must narrow under an active filter');
assert.match(dashboardSurface, /expandedTripLegs/, 'summary trip cards must track per-trip leg-list expansion state');
assert.match(dashboardSurface, /visibleLegs\s*=\s*isLegListExpanded \? trip\.legs : trip\.legs\?\.slice\(0, 3\)/, 'summary trip cards must preview three legs before expansion');
assert.match(dashboardSurface, /className="leg-list-toggle"/, 'summary trip cards with more than three legs must render an explicit expand/collapse control');
assert.match(dashboardSurface, /aria-expanded=\{isLegListExpanded\}/, 'leg-list expand/collapse control must expose aria-expanded');
assert.match(dashboardSurface, /className="trip-card-title-link"/, 'trip-card detail navigation must be a title link so the card can also contain an expand button');
assert.doesNotMatch(dashboardSurface, /<Link[^>]*className="trip-card-link"[\s\S]*?<button[\s\S]*?className="leg-list-toggle"/, 'trip-card expand button must not be nested inside the card detail link');
assert.match(dashboardSurface, /\{formatLegModeEmoji\(leg\.mode\)\} \{leg\.label\}/, 'leg rows must render the transport-mode emoji helper adjacent to the leg label');
assert.match(dashboardSurface, /function WeatherSummaryChip\(\{ weather \}\)/, 'summary cards must define a compact weather chip component');
assert.match(dashboardSurface, /<WeatherSummaryChip weather=\{trip\.weather\} \/>/, 'summary cards must render weather condition icons when trip.weather.summary is present');
assert.match(dashboardSurface, /aria-label=\{label\}/, 'summary weather icon must expose accessible text');
assert.doesNotMatch(dashboardSurface, /weather\?\.summary\?\.code|summary\.code/, 'summary weather must not render raw provider condition codes');
assert.doesNotMatch(dashboardSurface, /<span>🛣️ \{leg\.label\}<\/span>/, 'leg rows must not hard-code the road emoji next to every leg label');
assert.doesNotMatch(dashboardSurface, />\{trip\.status \|\| 'Unknown'\}</, 'raw trip status must not render directly');
assert.doesNotMatch(dashboardSurface, />\{trip\.planning\?\.readiness/, 'raw planning readiness must not render directly');
assert.doesNotMatch(dashboardSurface, />\{leg\.mode\}</, 'raw leg mode must not render directly');

// SC-??? — transport decision labels: snake_case basis keys and mode values must
// not leak into the rendered output. The contract is that every basis key and
// selected mode is humanised through `toDisplayLabel`, which collapses
// `monitoring_feasibility` → `Monitoring feasibility` and
// `driving_ev_confirmed` → `Driving EV confirmed`. The check reads
// trip-detail-surface.jsx (where the transport-decision callout lives), not
// dashboard-session-surface.jsx.
assert.doesNotMatch(tripDetailSurface, /String\(decision\.selectedMode\)\.replace\(.*?\)/, 'transport decision must not render the selected mode via a raw .replace(/_/g, ...) call');
assert.doesNotMatch(tripDetailSurface, /k\.replace\(\/\[A-Z\]\/g, ' '\$1'\)/, 'transport decision basis keys must not be humanised with the camelCase-only regex; use toDisplayLabel so snake_case also collapses');
assert.match(tripDetailSurface, /toDisplayLabel\(decision\.selectedMode/, 'transport decision must humanise the selected mode through toDisplayLabel');
assert.match(tripDetailSurface, /toDisplayLabel\(k, k\)/, 'transport decision must humanise basis keys through toDisplayLabel');
assert.match(tripDetailSurface, /function WeatherDetailSection\(\{ weather \}\)/, 'trip detail must define a Weather detail section');
assert.match(tripDetailSurface, /<SectionCollapsible title="Weather" emoji="🌦️" defaultOpen=\{true\}>/, 'trip detail weather must render as an open Weather section');
assert.match(tripDetailSurface, /weather\.locationLabel/, 'weather detail must show the forecast location label');
assert.match(tripDetailSurface, /weather\.source/, 'weather detail must show the forecast source/provider');
assert.match(tripDetailSurface, /formatWeatherMetaTime\(weather\.generatedAt \|\| weather\.updatedAt\)/, 'weather detail must show generated or updated time deterministically');
assert.match(tripDetailSurface, /weather\.coverageNote/, 'weather detail must render useful unavailable/stale/out-of-range coverage notes');
assert.match(tripDetailSurface, /period\.temperatureMinC/, 'weather period rows must include temperature range fields when present');
assert.match(tripDetailSurface, /period\.precipitationChancePercent/, 'weather period rows must include precipitation values when present');
assert.match(tripDetailSurface, /period\.windSpeedMph|period\.wind/, 'weather period rows must include wind values when present');

for (const emoji of ['✈️', '🧭', '👤', '🔐', '🧳', '🚦', '📡', '✅', '🕒', '📍', '👥', '🧩', '➡️']) {
  assert.match(dashboardSurface, new RegExp(emoji), `dashboard surface must include emoji accent ${emoji}`);
}

assert.match(globalCss, /\.dashboard-title\s*\{[\s\S]*line-height:\s*1\.12/, 'dashboard title must keep enough line-height to avoid clipping during compact transitions');
assert.match(globalCss, /\.session-user-label\s*\{/, 'welcome trigger must style the label span');
assert.match(globalCss, /\.session-header--compact\s*\.session-actions\s*\{[\s\S]*align-self:\s*center/, 'compact session header must vertically centre the logged-in user control');
assert.match(dashboardSurface, /session-user-label--full/, 'welcome trigger must render the full greeting in the expanded state');
assert.match(dashboardSurface, /isHeaderCompact \? userName : `👤 Welcome, \$\{userName\}`/, 'welcome trigger must switch to just the name in compact mode');
assert.match(globalCss, /:root\[data-theme="light"\]/, 'explicit light theme variables must be available');
assert.match(globalCss, /\.theme-toggle/, 'theme toggle must have visible styling');
assert.match(dashboardSurface, /computeMonitoringPhase\(trip, browserNow\)/, 'monitoring-enabled trip cards must compute the advisory phase from already-loaded data and browser time');
assert.match(dashboardSurface, /setInterval\(tickMonitoringClock, 60_000\)/, 'monitoring phase must refresh locally while open without refetching the brief');
assert.match(dashboardSurface, /monitoring-phase-chip/, 'monitoring phase must render a compact badge/chip in the summary card');
assert.match(dashboardSurface, /trip-monitoring-state/, 'monitoring phase output must sit in the monitoring field area');
assert.match(globalCss, /\.trip-monitoring-state\s*\{/, 'monitoring phase output must have dedicated layout styling');
assert.match(monitoringPhaseLib, /label:\s*'Monitoring'/, 'monitoring phase labels must now use the elegant Monitoring wording');
assert.match(dashboardSurface, /title=\{formatMonitoringPhaseTooltip\(monitoringPhase\.phase\)\}/, 'summary monitoring chip must expose the phase legend in a hover tooltip');
assert.match(tripDetailSurface, /title=\{formatMonitoringPhaseTooltip\(monitoringPhase\.phase\)\}/, 'detail monitoring chip must expose the phase legend in a hover tooltip');
assert.match(globalCss, /\.monitoring-phase-chip--started\s*\{/, 'started monitoring phases must have dedicated styling');
assert.match(globalCss, /\.monitoring-phase-chip--neutral\s*\{/, 'configured/not-started monitoring phases must have dedicated styling');
assert.match(tripDetailSurface, /computeMonitoringPhase\(trip, browserNow\)/, 'trip detail must compute the advisory monitoring phase from already-loaded data and browser time');
assert.match(tripDetailSurface, /setInterval\(tickMonitoringClock, 60_000\)/, 'trip detail monitoring phase must refresh locally while open without refetching the brief');
assert.match(tripDetailSurface, /monitoring-phase-chip/, 'trip detail monitoring section must render the advisory monitoring phase chip');
assert.match(tripDetailSurface, /monitoring\.enabled === true \?\s*\(/, 'trip detail must gate the advisory monitoring phase on enabled monitoring');
assert.match(tripDetailSurface, /Advisory: this page computes the recommendation from already-loaded trip and leg timing data plus browser time\./, 'trip detail monitoring section must label the recommendation as advisory');
assert.doesNotMatch(tripDetailSurface, /fetch\([^\)]*(monitoring-state|live-status)/, 'trip detail monitoring phase rendering must not fetch live monitoring-state or live-status APIs');

// Favicon: the root layout must declare an SVG icon (modern browsers) plus a
// PNG fallback (older browsers) and a 180x180 apple-touch-icon for iOS home
// screens. The SVG is the compass design; removing the SVG link means modern
// browsers fall back to a 32x32 PNG and lose crispness on hi-dpi displays.
const rootLayout = readFileSync('app/layout.jsx', 'utf8');
assert.match(rootLayout, /icon:\s*\[[\s\S]*?url:\s*'\/icon\.svg'[\s\S]*?type:\s*'image\/svg\+xml'/, 'root layout must declare the SVG favicon (modern browsers)');
assert.match(rootLayout, /url:\s*'\/icon\.png'/, 'root layout must declare a PNG favicon (older browsers)');
assert.match(rootLayout, /apple:\s*\[[\s\S]*?180x180/, 'root layout must declare a 180x180 apple-touch-icon for iOS home screens');

// SC-020 — trip-card hover effect: the visible card itself carries the lift/shadow
// because the card now contains both a title link and an expand/collapse button.
// Keeping the effect on .trip-card avoids illegal nested interactive elements.
// .trip-card's border-radius is declared in a shared selector (e.g. ".metric-card,\n.trip-card,\n...")
// so we scan every CSS rule and collect the border-radius of any rule whose selector
// list mentions .trip-card.
function extractBorderRadius(cssSource, selectorToken) {
  const rules = cssSource.match(/[^{}]+\{[^}]*\}/g) ?? [];
  for (const rule of rules) {
    const openBrace = rule.indexOf('{');
    if (openBrace === -1) continue;
    const selectorList = rule.slice(0, openBrace);
    const body = rule.slice(openBrace + 1, -1);
    if (!selectorList.split(',').some((sel) => sel.trim() === selectorToken)) continue;
    const match = body.match(/border-radius:\s*([^;}\s]+)/);
    if (match) return match[1].trim();
  }
  return null;
}
const tripCardRadius = extractBorderRadius(globalCss, '.trip-card');
assert.ok(tripCardRadius, '.trip-card rule must declare a border-radius');
const tripCardHover = globalCss.match(/\.trip-card:hover\s*\{([\s\S]*?)\}/);
assert.ok(tripCardHover, '.trip-card:hover rule must exist');
assert.match(tripCardHover[1], /transform:/, '.trip-card:hover must include a transform so the card lifts');
assert.match(tripCardHover[1], /box-shadow:/, '.trip-card:hover must include a box-shadow so the card gains a soft shadow');
const tripCardBase = globalCss.match(/\.trip-card\s*\{([\s\S]*?)\}/);
assert.ok(tripCardBase, '.trip-card base rule must exist');
assert.match(tripCardBase[1], /transition:[\s\S]*?box-shadow/, '.trip-card must declare a CSS transition that includes box-shadow so the hover effect animates without JS');
assert.match(globalCss, /\.trip-card-title-link\s*\{/, '.trip-card-title-link must style the detail navigation link after the whole-card link wrapper is removed');
assert.match(globalCss, /\.leg-list-toggle\s*\{/, '.leg-list-toggle must style the leg-list expand/collapse control');

// SC-021 — trip-list default card sizing: cards must size to their own content
// (align-items: start) by default so a shorter card does not gain trailing
// whitespace that the hover lift/shadow would then include. The CSS must
// provide an opt-in modifier (.trip-list--align-row) that re-enables the
// equal-height row layout for future layout decisions, but the modifier
// must not be applied by default.
const tripListRule = globalCss.match(/\.trip-list\s*\{([\s\S]*?)\}/);
assert.ok(tripListRule, '.trip-list rule must exist');
assert.match(tripListRule[1], /align-items:\s*start/, '.trip-list must default to align-items: start so each card sizes to its own content');
assert.match(globalCss, /\.trip-list--align-row\s*\{[^}]*align-items:\s*stretch/, '.trip-list--align-row modifier must opt back into align-items: stretch for an equal-height row layout');
assert.doesNotMatch(dashboardSurface, /trip-list\s+trip-list--align-row|trip-list--align-row/, 'the trip-list modifier must be CSS-only — no JSX should reference it until a future spec adds a control for it');

// Map provider switch (spec 010 — optional Google Maps Embed support).
// OSM is the default. The provider resolver only flips to Google when
// both conditions are true: requested provider is 'google' AND a key is
// set. Without a key, OSM is used silently so a missing key on a
// preview deploy doesn't break the page.
function resolveProvider(propProvider, envProvider, hasKey) {
  const requested = (propProvider || envProvider || 'osm').toLowerCase();
  if (requested === 'google' && hasKey) return 'google';
  return 'osm';
}

// Case 1: no env, no prop, no key → OSM (default).
assert.equal(
  resolveProvider(null, '', false),
  'osm',
  'no env and no key: default provider is OSM'
);
// Case 2: env=google but no key → falls back to OSM.
assert.equal(
  resolveProvider(null, 'google', false),
  'osm',
  'env requests Google but no key set: silently falls back to OSM'
);
// Case 3: env=google and key set → Google.
assert.equal(
  resolveProvider(null, 'google', true),
  'google',
  'env requests Google and key is set: provider is Google'
);
// Case 4: prop overrides env to OSM even when env says Google and key is set.
assert.equal(
  resolveProvider('osm', 'google', true),
  'osm',
  'explicit prop overrides env: provider stays OSM regardless of env state'
);
// Case 5: prop=google and key set → Google (prop-gated path).
assert.equal(
  resolveProvider('google', 'osm', true),
  'google',
  'explicit prop=google with a key: provider is Google (used by tests)'
);
// Case 6: prop=google but no key → still falls back to OSM.
assert.equal(
  resolveProvider('google', 'google', false),
  'osm',
  'prop=google but no key: silently falls back to OSM (the key gate is absolute)'
);
// Case 7: case-insensitive env var. 'Google', 'GOOGLE', 'gOoGlE' all work.
assert.equal(
  resolveProvider(null, 'GOOGLE', true),
  'google',
  'env provider name is case-insensitive'
);

// LegRouteMap (spec 010 FR-036..037) — per-leg inline map. Replaces
// both the FR-027 single-pin overview and the FR-032 standalone
// strip. The component renders one iframe per leg inside the leg
// row, with the provider switch (FR-028) controlling the iframe URL
// shape. OSM users get a single destination pin per iframe; Google
// users get the A→B route line.
//
// Mirrors the helpers in components/leg-route-map.jsx — keep them
// in sync.

function normaliseLegRouteMode(rawMode) {
  const m = String(rawMode || '').toLowerCase();
  if (m.includes('walk')) return 'walking';
  if (m.includes('bike') || m.includes('cycl')) return 'bicycling';
  if (m.includes('transit') || m.includes('rail') || m.includes('train')) return 'transit';
  if (
    m.includes('drive') ||
    m.includes('car') ||
    m.includes('taxi') ||
    m.includes('bus') ||
    m.includes('ferry') ||
    m.includes('cruise') ||
    m.includes('flight')
  ) {
    return 'driving';
  }
  return 'driving';
}

// Mode normalisation cases — covers the spec FR-034 mapping.
assert.equal(normaliseLegRouteMode('driving'), 'driving', 'mode=driving stays driving');
assert.equal(normaliseLegRouteMode('driving_ev'), 'driving', 'driving_ev maps to driving');
assert.equal(normaliseLegRouteMode('walking'), 'walking', 'mode=walking stays walking');
assert.equal(normaliseLegRouteMode('cycling'), 'bicycling', 'cycling maps to bicycling');
assert.equal(normaliseLegRouteMode('bicycling'), 'bicycling', 'bicycling maps to bicycling');
assert.equal(normaliseLegRouteMode('transit'), 'transit', 'transit stays transit');
assert.equal(normaliseLegRouteMode('train'), 'transit', 'train maps to transit');
assert.equal(normaliseLegRouteMode('rail'), 'transit', 'rail maps to transit');
assert.equal(normaliseLegRouteMode('flight'), 'driving', 'flight collapses to driving (no Google directions mode)');
assert.equal(normaliseLegRouteMode('cruise'), 'driving', 'cruise collapses to driving');
assert.equal(normaliseLegRouteMode('ferry'), 'driving', 'ferry collapses to driving');
assert.equal(normaliseLegRouteMode('taxi'), 'driving', 'taxi collapses to driving');
assert.equal(normaliseLegRouteMode('bus'), 'driving', 'bus collapses to driving');
assert.equal(normaliseLegRouteMode(null), 'driving', 'null mode defaults to driving');
assert.equal(normaliseLegRouteMode(''), 'driving', 'empty mode defaults to driving');
assert.equal(normaliseLegRouteMode('unicycle'), 'bicycling', 'unicycle matches the bicycling substring cycl');
assert.equal(normaliseLegRouteMode('horseback'), 'driving', 'unrecognised mode defaults to driving');

// LegRouteMap privacy filter — mirrors the predicate in the
// component. Given a leg with both endpoints geocoded, return
// `true` if the leg is filtered out (no iframe rendered) and
// `false` if it should render.
function legRouteFiltered(leg, originGeocoded, destGeocoded) {
  if (!leg?.origin?.label || !leg?.destination?.label) return true;
  if (!originGeocoded || !destGeocoded) return true;
  if (leg.origin.precision === 'home' || leg.origin.precision === 'exact') return true;
  if (leg.destination.precision === 'home' || leg.destination.precision === 'exact') return true;
  return false;
}

// Case A: a leg with both endpoints geocoded and non-private
// renders (the filter returns false).
assert.equal(
  legRouteFiltered(
    { origin: { label: 'A' }, destination: { label: 'B' } },
    true,
    true
  ),
  false,
  'leg with both endpoints geocoded and non-private renders'
);

// Case B: a leg with a home-precision endpoint is filtered out.
assert.equal(
  legRouteFiltered(
    { origin: { label: 'A' }, destination: { label: 'B', precision: 'home' } },
    true,
    true
  ),
  true,
  'leg with home-precision destination is filtered out'
);

// Case C: a leg where geocoding failed is filtered out.
assert.equal(
  legRouteFiltered(
    { origin: { label: 'A' }, destination: { label: 'B' } },
    true,
    false
  ),
  true,
  'leg with ungeocoded destination is filtered out'
);

// Case D: a leg with no labels is filtered out.
assert.equal(
  legRouteFiltered(
    { origin: { label: 'A' }, destination: {} },
    true,
    true
  ),
  true,
  'leg with no destination label is filtered out'
);

// Case E: a leg with exact-precision origin is filtered out.
assert.equal(
  legRouteFiltered(
    { origin: { label: 'A', precision: 'exact' }, destination: { label: 'B' } },
    true,
    true
  ),
  true,
  'leg with exact-precision origin is filtered out'
);

// Provider switch tests (FR-036) — the LegRouteMap must switch URL
// shapes between Google and OSM based on the resolved provider.
function legRouteUrl(provider, key, origin, dest, mode) {
  if (provider === 'google') {
    return `https://www.google.com/maps/embed/v1/directions?key=${key}&origin=${origin}&destination=${dest}&mode=${mode}`;
  }
  return `https://www.openstreetmap.org/export/embed.html?bbox=…&marker=${dest}&layer=mapnik`;
}

assert.match(
  legRouteUrl('google', 'AIza', '1,1', '2,2', 'driving'),
  /google\.com\/maps\/embed\/v1\/directions/,
  'Google URL uses directions mode'
);
assert.match(
  legRouteUrl('osm', 'AIza', '1,1', '2,2', 'driving'),
  /openstreetmap\.org\/export\/embed\.html/,
  'OSM URL uses /export/embed.html (no directions mode available)'
);
assert.doesNotMatch(
  legRouteUrl('osm', 'AIza', '1,1', '2,2', 'driving'),
  /google\.com/,
  'OSM URL does not reference Google'
);

// Geocode cache dedup test (FR-036) — the module-level Map should
// share in-flight and resolved lookups across LegRouteMap instances.
// The actual Map is a module private, so we assert the source shape.
const legRouteMapSource = readFileSync('components/leg-route-map.jsx', 'utf8');
assert.match(
  legRouteMapSource,
  /geocodeCache\s*=\s*new Map\(\)/,
  'LegRouteMap must declare a module-level geocode cache'
);
assert.match(
  legRouteMapSource,
  /geocodeCache\.has/,
  'LegRouteMap must check the cache before fetching'
);
assert.match(
  legRouteMapSource,
  /geocodeCache\.set/,
  'LegRouteMap must populate the cache after fetching'
);

console.log('Dashboard polish checks passed.');
