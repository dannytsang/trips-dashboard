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

export function formatNextActionLabel(value) {
  return toDisplayLabel(value, 'No action required');
}
