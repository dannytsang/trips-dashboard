const ACRONYMS = new Set(['api', 'ev', 'gps', 'id', 'oidc', 'sms', 'uk', 'url', 'eta']);

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
  if (mode === 'driving_ev') return '🔌';
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
