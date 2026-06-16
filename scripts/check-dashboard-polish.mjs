import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  formatLegModeEmoji,
  formatLegModeLabel,
  formatNextActionLabel,
  formatReadinessLabel,
  formatStatusLabel,
  toDisplayLabel,
} from '../lib/display-labels.mjs';

const dashboardSurface = readFileSync('components/dashboard-session-surface.jsx', 'utf8');
const globalCss = readFileSync('app/globals.css', 'utf8');

assert.equal(toDisplayLabel('finalised_core_details'), 'Finalised core details');
assert.equal(toDisplayLabel('driving_ev'), 'Driving EV');
assert.equal(toDisplayLabel('gps_signal_lost'), 'GPS signal lost');
assert.equal(toDisplayLabel('oidc_callback_url'), 'OIDC callback URL');
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

assert.match(dashboardSurface, /THEME_STORAGE_KEY\s*=\s*'tsang-travel-theme'/, 'theme preference must use a stable localStorage key');
assert.match(dashboardSurface, /window\.localStorage\.getItem\(THEME_STORAGE_KEY\)/, 'theme toggle must initialise from localStorage');
assert.match(dashboardSurface, /prefers-color-scheme: light/, 'theme toggle must fall back to system preference');
assert.match(dashboardSurface, /window\.localStorage\.setItem\(THEME_STORAGE_KEY, theme\)/, 'theme toggle must persist locally');
assert.match(dashboardSurface, /data-theme=\{theme\}/, 'dashboard shell must expose the active theme for CSS');
assert.match(dashboardSurface, /aria-label=\{themeToggleLabel\}/, 'theme toggle must have an accessible label');
assert.match(dashboardSurface, /theme === 'dark' \? '☀️' : '🌙'/, 'theme toggle must be icon-only and switch between the sun and moon icons');
assert.doesNotMatch(dashboardSurface, /☀️ Light|🌙 Dark/, 'theme toggle must not duplicate the icon as visible text — the icon alone is the affordance');
assert.doesNotMatch(dashboardSurface, /handleThemeToggle[\s\S]{0,200}readTripsDashboardBrief|handleThemeToggle[\s\S]{0,200}fetch\(/, 'theme switching must not fetch or resync brief data');
assert.match(dashboardSurface, /FILTER_QUERY_KEY\s*=\s*'filter'/, 'filter state must use a stable query-string key');
assert.match(dashboardSurface, /window\.history\.pushState\(\{\}, '', url\)/, 'filter changes must use the browser History API rather than a server navigation');
assert.match(dashboardSurface, /window\.addEventListener\('popstate', handlePopState\)/, 'back\/forward navigation must restore the previous filter');
assert.match(dashboardSurface, /URLSearchParams\(window\.location\.search\)/, 'initial render must read the filter from the URL query string');
assert.doesNotMatch(dashboardSurface, /handleFilterToggle[\s\S]{0,260}readTripsDashboardBrief|handleFilterToggle[\s\S]{0,260}fetch\(/, 'filter changes must not fetch or resync brief data');

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
assert.match(dashboardSurface, /\{filteredTrips\.map\(trip => \(/, 'only the trip list, not the metric totals, must narrow under an active filter');
assert.match(dashboardSurface, /\{formatLegModeEmoji\(leg\.mode\)\} \{leg\.label\}/, 'leg rows must render the transport-mode emoji helper adjacent to the leg label');
assert.doesNotMatch(dashboardSurface, /<span>🛣️ \{leg\.label\}<\/span>/, 'leg rows must not hard-code the road emoji next to every leg label');
assert.doesNotMatch(dashboardSurface, />\{trip\.status \|\| 'Unknown'\}</, 'raw trip status must not render directly');
assert.doesNotMatch(dashboardSurface, />\{trip\.planning\?\.readiness/, 'raw planning readiness must not render directly');
assert.doesNotMatch(dashboardSurface, />\{leg\.mode\}</, 'raw leg mode must not render directly');

for (const emoji of ['✈️', '🧭', '👤', '🔐', '🧳', '🚦', '📡', '✅', '🕒', '📍', '👥', '🧩', '➡️']) {
  assert.match(dashboardSurface, new RegExp(emoji), `dashboard surface must include emoji accent ${emoji}`);
}

assert.match(globalCss, /:root\[data-theme="dark"\]/, 'explicit dark theme variables must be available');
assert.match(globalCss, /:root\[data-theme="light"\]/, 'explicit light theme variables must be available');
assert.match(globalCss, /\.theme-toggle/, 'theme toggle must have visible styling');

// SC-020 — trip-card hover effect: link wrapper radius must match visible card radius.
// The box-shadow on .trip-card-link must follow the visible card's border-radius so
// the shadow does not visibly cut into the rounded corners. We parse both rules and
// assert the radii are equal; we also assert the hover state carries both a
// transform and a box-shadow and uses the CSS transition defined on .trip-card-link.
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
const tripCardLinkRadius = extractBorderRadius(globalCss, '.trip-card-link');
const tripCardRadius = extractBorderRadius(globalCss, '.trip-card');
assert.ok(tripCardLinkRadius, '.trip-card-link rule must declare a border-radius');
assert.ok(tripCardRadius, '.trip-card rule must declare a border-radius');
assert.equal(
  tripCardLinkRadius,
  tripCardRadius,
  `trip-card-link border-radius (${tripCardLinkRadius}) must match trip-card border-radius (${tripCardRadius}) so the hover box-shadow follows the card corners`
);
const tripCardLinkHover = globalCss.match(/\.trip-card-link:hover\s*\{([\s\S]*?)\}/);
assert.ok(tripCardLinkHover, '.trip-card-link:hover rule must exist');
assert.match(tripCardLinkHover[1], /transform:/, '.trip-card-link:hover must include a transform so the card lifts');
assert.match(tripCardLinkHover[1], /box-shadow:/, '.trip-card-link:hover must include a box-shadow so the card gains a soft shadow');
const tripCardLinkBase = globalCss.match(/\.trip-card-link\s*\{([\s\S]*?)\}/);
assert.ok(tripCardLinkBase, '.trip-card-link base rule must exist');
assert.match(tripCardLinkBase[1], /transition:[\s\S]*?box-shadow/, '.trip-card-link must declare a CSS transition that includes box-shadow so the hover effect animates without JS');

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

console.log('Dashboard polish checks passed.');
