const ACRONYMS = new Set(['api', 'ev', 'gps', 'id', 'oidc', 'sms', 'uk', 'url', 'eta']);

const WEATHER_CONDITION_ICONS = new Map([
  ['clear', ['Clear', '☀️']],
  ['sunny', ['Sunny', '☀️']],
  ['mostly_sunny', ['Mostly sunny', '🌤️']],
  ['partly_cloudy', ['Partly cloudy', '⛅']],
  ['cloudy', ['Cloudy', '☁️']],
  ['overcast', ['Overcast', '☁️']],
  ['fog', ['Fog', '🌫️']],
  ['mist', ['Mist', '🌫️']],
  ['drizzle', ['Drizzle', '🌦️']],
  ['light_rain', ['Light rain', '🌧️']],
  ['rain', ['Rain', '🌧️']],
  ['showers', ['Showers', '🌦️']],
  ['heavy_rain', ['Heavy rain', '🌧️']],
  ['thunderstorm', ['Thunderstorm', '⛈️']],
  ['snow', ['Snow', '❄️']],
  ['sleet', ['Sleet', '🌨️']],
  ['wind', ['Windy', '💨']],
  ['windy', ['Windy', '💨']],
]);

export function toDisplayLabel(value, fallback = 'Unknown') {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const text = String(value)
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

  if (!text) return fallback;

  return text
    .split(' ')
    .map((part, index) => {
      const lower = part.toLowerCase();
      if (ACRONYMS.has(lower)) return lower.toUpperCase();
      if (/^\d+$/.test(part)) return part;
      if (index > 0 && /^[A-Z]{2,}$/.test(part)) return part;
      if (index === 0) return lower.charAt(0).toUpperCase() + lower.slice(1);
      return lower;
    })
    .join(' ');
}

export function formatStatusLabel(value, { active = false } = {}) {
  if (active) return 'Active';
  return toDisplayLabel(value, 'Unknown');
}

export function formatReadinessLabel(value) {
  return toDisplayLabel(value, 'Needs info');
}

export function formatLegModeLabel(value) {
  return toDisplayLabel(value, 'Mode pending');
}

export function formatLegModeEmoji(value) {
  if (value === null || value === undefined || value === '') {
    return '🛣️';
  }

  const mode = String(value).trim().toLowerCase();
  if (!mode) return '🛣️';

  if (mode.includes('flight')) return '✈️';
  if (mode.includes('train')) return '🚆';
  if (mode.includes('cruise')) return '🚢';
  if (mode.includes('ferry')) return '⛴️';
  if (mode === 'driving_ev') return '🚗';
  if (mode.includes('driving') || mode.includes('car')) return '🚗';
  if (mode.includes('taxi') || mode.includes('transfer')) return '🚕';
  if (mode.includes('bus')) return '🚌';
  if (mode.includes('walk')) return '🚶';
  if (mode.includes('cycle') || mode.includes('bike')) return '🚴';
  if (mode === 'overnight_stay') return '🛏️';
  return '🛣️';
}

export function formatNextActionLabel(value) {
  return toDisplayLabel(value, 'No action required');
}

export function formatWeatherCondition(value, { icon } = {}) {
  const raw = value === null || value === undefined ? '' : String(value).trim();
  const key = raw.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const mapped = WEATHER_CONDITION_ICONS.get(key);
  const label = mapped?.[0] || toDisplayLabel(raw, 'Weather');
  return {
    label,
    icon: icon || mapped?.[1] || '🌡️',
    accessibleLabel: `${label} forecast`,
  };
}

/**
 * Formats a build/deployment timestamp for display on the authenticated
 * dashboard summary.
 *
 * @param {string|null} isoDate — ISO-8601 date string or null
 * @returns {{ label: string, missing: boolean }}
 *   label    — compact friendly text, e.g. "Deployed 27 Jun 2026"
 *   missing  — true when the input was null or invalid
 *
 * The formatter never returns commit SHAs, branch names, deployment URLs,
 * environment names, secrets, private trip identifiers, or raw hosting
 * metadata.
 */
const BUILD_MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Maps a canonical trip status to its dashboard emoji.
 * Covers: active, monitoring, planned, confirmed, candidate, provisional,
 * completed, cancelled, and unknown/non-canonical fallthrough.
 *
 * @param {string|null} statusSlug — raw status slug from the brief
 * @param {{ active: boolean }} opts
 * @returns {{ emoji: string, label: string }}
 */
export function formatStatusEmoji(statusSlug, { active } = {}) {
  if (active) return { emoji: '🚦', label: 'Active' };
  const key = String(statusSlug || '').trim().toLowerCase();
  if (!key) return { emoji: 'ℹ️', label: 'Unknown' };
  if (key === 'active') return { emoji: '🚦', label: 'Active' };
  if (key === 'monitoring' || key.includes('monitoring') || key.includes('enabled')) return { emoji: '📡', label: 'Monitoring' };
  if (key === 'planned' || key.includes('planned')) return { emoji: '🧭', label: 'Planned' };
  if (key === 'confirmed' || key.includes('confirmed')) return { emoji: '✅', label: 'Confirmed' };
  if (key === 'candidate' || key === 'provisional' || key.includes('candidate') || key.includes('provisional')) return { emoji: '🧳', label: 'Candidate' };
  if (key === 'completed' || key.includes('completed')) return { emoji: '🏁', label: 'Completed' };
  if (key === 'cancelled' || key.includes('cancelled') || key.includes('canceled')) return { emoji: '⛔', label: 'Cancelled' };
  return { emoji: 'ℹ️', label: toDisplayLabel(statusSlug, 'Unknown') };
}

/**
 * Returns the canonical trip status flow for use in hover/focus reminders.
 * The current status is highlighted with the ★ marker.
 */
export const CANONICAL_STATUS_FLOW = [
  { key: 'candidate', label: 'Candidate' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'planned', label: 'Planned' },
  { key: 'monitoring', label: 'Monitoring' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
];

export function formatStatusFlowReminder(statusSlug, { active } = {}) {
  const current = formatStatusEmoji(statusSlug, { active });
  const steps = CANONICAL_STATUS_FLOW.map(step => {
    const isCurrent = current.label.toLowerCase() === step.label.toLowerCase();
    return `${isCurrent ? '★ ' : ''}${step.label}`;
  });
  return `Trip status flow: ${steps.join(' → ')}${current.label === 'Cancelled' ? '' : ' → completed (or ⛔ cancelled)'}`;
}

/**
 * FR-041: Return strategy display label.
 *
 * Maps the `returnOptions.strategy` value from the brief to a human-readable
 * short label. Falls back to the raw strategy string when no mapping exists.
 *
 * @param {string|null} strategy
 * @returns {string}
 */
const STRATEGY_LABELS = {
  mutually_exclusive_return: 'Return TBD',
  fixed_return: 'Fixed return',
  open_return: 'Open return',
};

export function formatReturnOptionsLabel(strategy) {
  if (!strategy) return null;
  return STRATEGY_LABELS[strategy] ?? strategy;
}

export function formatBuildInfo(isoDate) {
  if (!isoDate) {
    return { label: 'Build date unavailable', missing: true };
  }
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return { label: 'Build date unavailable', missing: true };
  }
  return {
    label: `Deployed ${parsed.getUTCDate()} ${BUILD_MONTH_SHORT[parsed.getUTCMonth()]} ${parsed.getUTCFullYear()}`,
    missing: false,
  };
}
