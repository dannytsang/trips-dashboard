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

assert.match(dashboardSurface, /THEME_STORAGE_KEY\s*=\s*'tsang-travel-theme'/, 'theme preference must use a stable localStorage key');
assert.match(dashboardSurface, /window\.localStorage\.getItem\(THEME_STORAGE_KEY\)/, 'theme toggle must initialise from localStorage');
assert.match(dashboardSurface, /prefers-color-scheme: light/, 'theme toggle must fall back to system preference');
assert.match(dashboardSurface, /window\.localStorage\.setItem\(THEME_STORAGE_KEY, theme\)/, 'theme toggle must persist locally');
assert.match(dashboardSurface, /data-theme=\{theme\}/, 'dashboard shell must expose the active theme for CSS');
assert.match(dashboardSurface, /aria-label=\{themeToggleLabel\}/, 'theme toggle must have an accessible label');
assert.match(dashboardSurface, /theme === 'dark' \? '☀️' : '🌙'/, 'theme toggle must be icon-only and switch between the sun and moon icons');
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
const tripDetailSurface = readFileSync('components/trip-detail-surface.jsx', 'utf8');
assert.doesNotMatch(tripDetailSurface, /String\(decision\.selectedMode\)\.replace\(.*?\)/, 'transport decision must not render the selected mode via a raw .replace(/_/g, ...) call');
assert.doesNotMatch(tripDetailSurface, /k\.replace\(\/\[A-Z\]\/g, ' '\$1'\)/, 'transport decision basis keys must not be humanised with the camelCase-only regex; use toDisplayLabel so snake_case also collapses');
assert.match(tripDetailSurface, /toDisplayLabel\(decision\.selectedMode/, 'transport decision must humanise the selected mode through toDisplayLabel');
assert.match(tripDetailSurface, /toDisplayLabel\(k, k\)/, 'transport decision must humanise basis keys through toDisplayLabel');

for (const emoji of ['✈️', '🧭', '👤', '🔐', '🧳', '🚦', '📡', '✅', '🕒', '📍', '👥', '🧩', '➡️']) {
  assert.match(dashboardSurface, new RegExp(emoji), `dashboard surface must include emoji accent ${emoji}`);
}

assert.match(globalCss, /:root\[data-theme="dark"\]/, 'explicit dark theme variables must be available');
assert.match(globalCss, /:root\[data-theme="light"\]/, 'explicit light theme variables must be available');
assert.match(globalCss, /\.theme-toggle/, 'theme toggle must have visible styling');

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

console.log('Dashboard polish checks passed.');
