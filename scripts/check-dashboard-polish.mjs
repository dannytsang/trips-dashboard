import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
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
assert.equal(formatNextActionLabel('confirm_train_eta'), 'Confirm train ETA');

assert.match(dashboardSurface, /THEME_STORAGE_KEY\s*=\s*'tsang-travel-theme'/, 'theme preference must use a stable localStorage key');
assert.match(dashboardSurface, /window\.localStorage\.getItem\(THEME_STORAGE_KEY\)/, 'theme toggle must initialise from localStorage');
assert.match(dashboardSurface, /prefers-color-scheme: light/, 'theme toggle must fall back to system preference');
assert.match(dashboardSurface, /window\.localStorage\.setItem\(THEME_STORAGE_KEY, theme\)/, 'theme toggle must persist locally');
assert.match(dashboardSurface, /data-theme=\{theme\}/, 'dashboard shell must expose the active theme for CSS');
assert.match(dashboardSurface, /aria-label=\{themeToggleLabel\}/, 'theme toggle must have an accessible label');
assert.match(dashboardSurface, /☀️ Light/, 'theme toggle must expose a light-mode action');
assert.match(dashboardSurface, /🌙 Dark/, 'theme toggle must expose a dark-mode action');
assert.doesNotMatch(dashboardSurface, /handleThemeToggle[\s\S]{0,200}readTripsDashboardProjection|handleThemeToggle[\s\S]{0,200}fetch\(/, 'theme switching must not fetch or resync projection data');

assert.match(dashboardSurface, /formatStatusLabel/, 'status values must pass through the display-label mapper');
assert.match(dashboardSurface, /formatReadinessLabel/, 'planning readiness values must pass through the display-label mapper');
assert.match(dashboardSurface, /formatLegModeLabel/, 'leg modes must pass through the display-label mapper');
assert.match(dashboardSurface, /formatNextActionLabel/, 'next actions must pass through the display-label mapper');
assert.doesNotMatch(dashboardSurface, />\{trip\.status \|\| 'Unknown'\}</, 'raw trip status must not render directly');
assert.doesNotMatch(dashboardSurface, />\{trip\.planning\?\.readiness/, 'raw planning readiness must not render directly');
assert.doesNotMatch(dashboardSurface, />\{leg\.mode\}</, 'raw leg mode must not render directly');

for (const emoji of ['✈️', '🧭', '👤', '🔐', '🧳', '🚦', '📡', '✅', '🕒', '📍', '👥', '🧩', '🛣️', '➡️']) {
  assert.match(dashboardSurface, new RegExp(emoji), `dashboard surface must include emoji accent ${emoji}`);
}

assert.match(globalCss, /:root\[data-theme="dark"\]/, 'explicit dark theme variables must be available');
assert.match(globalCss, /:root\[data-theme="light"\]/, 'explicit light theme variables must be available');
assert.match(globalCss, /\.theme-toggle/, 'theme toggle must have visible styling');

console.log('Dashboard polish checks passed.');
