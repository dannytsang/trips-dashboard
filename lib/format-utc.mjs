// Deterministic date/time formatting for trip/user-facing display.
//
// We deliberately avoid Intl/toLocale formatting because Node and browsers can
// emit slightly different punctuation, which has previously caused React
// hydration errors on the dashboard.
//
// Important: many trip schedule fields are ISO strings with an explicit local
// offset, for example "2026-07-03T09:15:00+01:00" for a BST rail departure.
// User-facing itinerary labels must preserve the local clock time encoded in
// the string (09:15), not convert it to UTC/GMT (08:15).  Therefore these
// helpers parse the ISO fields directly and format the embedded calendar/time
// components deterministically.

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pad2(n) {
  const s = String(n);
  return s.length < 2 ? '0' + s : s;
}

function validDateParts(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 0 || month > 11 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month && d.getUTCDate() === day;
}

function validTimeParts(hours, mins) {
  return Number.isInteger(hours) && Number.isInteger(mins) && hours >= 0 && hours <= 23 && mins >= 0 && mins <= 59;
}

// Parse ISO-8601 strings without converting them to the host/browser timezone.
// Supported examples:
//   2026-07-03
//   2026-07-03T09:15:00+01:00
//   2026-07-03T09:15:00Z
//   2026-07-03T09:15:00.000Z
function parseIsoDisplayParts(iso) {
  if (!iso || typeof iso !== 'string') return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/);
  if (!m) return null;

  const year = Number.parseInt(m[1], 10);
  const month = Number.parseInt(m[2], 10) - 1;
  const day = Number.parseInt(m[3], 10);
  const hasTime = m[4] !== undefined;
  const hours = hasTime ? Number.parseInt(m[4], 10) : null;
  const mins = hasTime ? Number.parseInt(m[5], 10) : null;

  if (!validDateParts(year, month, day)) return null;
  if (hasTime && !validTimeParts(hours, mins)) return null;

  // Weekday is the weekday of the local calendar date written in the ISO
  // string, not the weekday after converting the instant to UTC/GMT.
  const weekday = new Date(Date.UTC(year, month, day)).getUTCDay();

  return { year, month, day, weekday, hasTime, hours, mins };
}

export function formatUtcDateShort(iso) {
  const dt = parseIsoDisplayParts(iso);
  if (!dt) return '';
  return `${dt.day} ${MONTH_SHORT[dt.month]}`;
}

// "Fri 3 Jul" — local calendar weekday + day + month from the ISO string.
export function formatUtcWeekdayDate(iso) {
  const dt = parseIsoDisplayParts(iso);
  if (!dt) return '';
  return `${WEEKDAY_SHORT[dt.weekday]} ${dt.day} ${MONTH_SHORT[dt.month]}`;
}

// "17 Jun, 11:32" — fixed-comma format preserving the ISO string's local time.
// Date-only strings intentionally return date-only labels rather than inventing
// a midnight time.
export function formatUtcDateTime(iso) {
  const dt = parseIsoDisplayParts(iso);
  if (!dt) return '';
  const dateLabel = `${dt.day} ${MONTH_SHORT[dt.month]}`;
  if (!dt.hasTime) return dateLabel;
  return `${dateLabel}, ${pad2(dt.hours)}:${pad2(dt.mins)}`;
}

// "11:32" — time only from the ISO string's local timezone. Date-only strings
// return an empty label so callers do not accidentally display fabricated 00:00.
export function formatUtcTime(iso) {
  const dt = parseIsoDisplayParts(iso);
  if (!dt || !dt.hasTime) return '';
  return `${pad2(dt.hours)}:${pad2(dt.mins)}`;
}

// "Fri 3 Jul → Sat 4 Jul" — two weekday-date labels separated by an arrow.
export function formatUtcDateRange(startIso, endIso) {
  const start = formatUtcWeekdayDate(startIso);
  const end = endIso ? formatUtcWeekdayDate(endIso) : null;
  if (!start) return 'Date pending';
  if (!end) return start;
  return `${start} → ${end}`;
}

// "Fri 3 Jul 2026 → Sat 4 Jul 2026" — weekday-date labels with year.
export function formatUtcDateRangeWithYear(startIso, endIso) {
  const start = formatUtcWeekdayDateWithYear(startIso);
  const end = endIso ? formatUtcWeekdayDateWithYear(endIso) : null;
  if (!start) return 'Date pending';
  if (!end) return start;
  return `${start} → ${end}`;
}

// "Fri 3 Jul, 11:32" — local calendar weekday/date/time from the ISO string.
export function formatUtcWeekdayDateTime(iso) {
  const dt = parseIsoDisplayParts(iso);
  if (!dt) return '';
  const dateLabel = `${WEEKDAY_SHORT[dt.weekday]} ${dt.day} ${MONTH_SHORT[dt.month]}`;
  if (!dt.hasTime) return dateLabel;
  return `${dateLabel}, ${pad2(dt.hours)}:${pad2(dt.mins)}`;
}

// "Fri 3 Jul 2026" — local calendar weekday + day + month + year.
export function formatUtcWeekdayDateWithYear(iso) {
  const dt = parseIsoDisplayParts(iso);
  if (!dt) return '';
  return `${WEEKDAY_SHORT[dt.weekday]} ${dt.day} ${MONTH_SHORT[dt.month]} ${dt.year}`;
}
