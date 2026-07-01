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

// ---------------------------------------------------------------------------
// Timezone cue utilities
// ---------------------------------------------------------------------------
// Design principle (Danny, 2026-07-01):
//   Calendar/provider local time first; timezone cue only when useful;
//   never silently converted.
//
// These formatters PRESERVE the local clock text from the ISO string.
// They do NOT convert to browser/UTC time, and they do NOT use Intl APIs
// (which can emit inconsistent punctuation between Node and browser,
// historically causing React hydration errors).
//
// Timezone cue logic:
//   - Explicit metadata (timeBasis / time_basis / timezoneLabel / timeZone / timezone)
//     takes priority — use it when it is truthy and not the generic sentinel value.
//   - If the ISO offset implies a known travel zone, derive the cue from the offset.
//   - Ship time renders as 'ship time' (not an IANA zone cue).
//   - Unknown/uninformative zones fall back to the existing label (no fabrication).
//
// Compact cues (2–5 chars, no dots):
//   Europe/London  BST (Mar–Oct, offset +01:00)
//   Europe/London  GMT (Oct–Mar, offset +00:00)
//   Europe/Rome    CEST (Mar–Oct, offset +02:00)
//   Europe/Rome    CET  (Oct–Mar, offset +01:00)
//   Europe/Barcelona, Europe/Athens (+02:00/+01:00) → same cue families
//   America/New_York  EDT (Mar–Nov, offset −04:00)
//   America/New_York  EST (Nov–Mar, offset −05:00)

const TIMEZONE_CUE_LABELS = {
  // Central European summer time
  'Europe/Paris':        { '+02:00': 'CEST', '+02': 'CEST', '+01:00': 'CET', '+01': 'CET' },
  'Europe/Berlin':       { '+02:00': 'CEST', '+02': 'CEST', '+01:00': 'CET', '+01': 'CET' },
  'Europe/Rome':        { '+02:00': 'CEST', '+02': 'CEST', '+01:00': 'CET', '+01': 'CET' },
  'Europe/Madrid':      { '+02:00': 'CEST', '+02': 'CEST', '+01:00': 'CET', '+01': 'CET' },
  'Europe/Amsterdam':   { '+02:00': 'CEST', '+02': 'CEST', '+01:00': 'CET', '+01': 'CET' },
  'Europe/Brussels':    { '+02:00': 'CEST', '+02': 'CEST', '+01:00': 'CET', '+01': 'CET' },
  'Europe/Vienna':      { '+02:00': 'CEST', '+02': 'CEST', '+01:00': 'CET', '+01': 'CET' },
  'Europe/Barcelona':   { '+02:00': 'CEST', '+02': 'CEST', '+01:00': 'CET', '+01': 'CET' },
  'Europe/Zurich':      { '+02:00': 'CEST', '+02': 'CEST', '+01:00': 'CET', '+01': 'CET' },
  'Europe/Munich':      { '+02:00': 'CEST', '+02': 'CEST', '+01:00': 'CET', '+01': 'CET' },
  'Europe/Milan':       { '+02:00': 'CEST', '+02': 'CEST', '+01:00': 'CET', '+01': 'CET' },
  'Europe/Athens':      { '+03:00': 'EEST', '+03': 'EEST', '+02:00': 'EET', '+02': 'EET' },
  'Europe/Warsaw':      { '+02:00': 'CEST', '+02': 'CEST', '+01:00': 'CET', '+01': 'CET' },
  'Europe/Prague':      { '+02:00': 'CEST', '+02': 'CEST', '+01:00': 'CET', '+01': 'CET' },
  'Europe/Copenhagen':  { '+02:00': 'CEST', '+02': 'CEST', '+01:00': 'CET', '+01': 'CET' },
  'Europe/Stockholm':   { '+02:00': 'CEST', '+02': 'CEST', '+01:00': 'CET', '+01': 'CET' },
  'Europe/Oslo':        { '+02:00': 'CEST', '+02': 'CEST', '+01:00': 'CET', '+01': 'CET' },
  'Europe/Helsinki':    { '+03:00': 'EEST', '+03': 'EEST', '+02:00': 'EET', '+02': 'EET' },
  'Europe/Dublin':      { '+01:00': 'IST',  '+01': 'IST',  '+00:00': 'GMT', '+00': 'GMT' },
  'Europe/Lisbon':      { '+01:00': 'WEST', '+01': 'WEST', '+00:00': 'WET', '+00': 'WET' },
  'Europe/London':      { '+01:00': 'BST',  '+01': 'BST',  '+00:00': 'GMT', '+00': 'GMT' },
  // North America
  'America/New_York':   { '-04:00': 'EDT',  '-04': 'EDT',  '-05:00': 'EST', '-05': 'EST' },
  'America/Chicago':    { '-05:00': 'CDT',  '-05': 'CDT',  '-06:00': 'CST', '-06': 'CST' },
  'America/Denver':    { '-06:00': 'MDT',  '-06': 'MDT',  '-07:00': 'MST', '-07': 'MST' },
  'America/Los_Angeles':{ '-07:00': 'PDT',  '-07': 'PDT',  '-08:00': 'PST', '-08': 'PST' },
  'America/Anchorage':  { '-08:00': 'AKDT', '-08': 'AKDT', '-09:00': 'AKST', '-09': 'AKST' },
  'Pacific/Honolulu':  { '-10:00': 'HST',  '-10': 'HST' },
  // Asia / Pacific
  'Asia/Dubai':        { '+04:00': 'GST',  '+04': 'GST' },
  'Asia/Kolkata':       { '+05:30': 'IST',  '+05:30': 'IST' },
  'Asia/Singapore':     { '+08:00': 'SGT',  '+08': 'SGT' },
  'Asia/Hong_Kong':     { '+08:00': 'HKT',  '+08': 'HKT' },
  'Asia/Shanghai':      { '+08:00': 'CST',  '+08': 'CST' },
  'Asia/Tokyo':        { '+09:00': 'JST',  '+09': 'JST' },
  'Australia/Sydney':   { '+11:00': 'AEDT', '+11': 'AEDT', '+10:00': 'AEST', '+10': 'AEST' },
  'Australia/Perth':    { '+08:00': 'AWST', '+08': 'AWST' },
  'Pacific/Auckland':   { '+13:00': 'NZDT', '+13': 'NZDT', '+12:00': 'NZST', '+12': 'NZST' },
};

// Sentinel strings that carry no useful display information — skip them.
const GENERIC_ZONE_SENTINELS = new Set([
  'local', 'localtime', 'browser', 'utc', 'z', 'gmt', 'unknown', '',
]);

// Extract the compact UTC offset suffix from an ISO string, e.g. "+01:00", "Z".
function extractUtcOffset(iso) {
  if (!iso || typeof iso !== 'string') return null;
  if (/Z$/i.test(iso.trim())) return 'Z';
  const m = iso.match(/[+-]\d{2}:\d{2}$/);
  if (!m) return null;
  const off = m[0];
  return off === '+00:00' ? 'Z' : off;
}

/**
 * Format a timezone cue string from explicit metadata.
 *
 * @param {string|null|undefined} zone - IANA zone name (e.g. "Europe/London")
 * @param {string|null|undefined} offset - ISO UTC offset string (e.g. "+01:00", "Z")
 * @returns {string|null} - compact display cue (e.g. "BST") or null if not useful
 */
export function formatTimezoneCueFromMetadata(zone, offset) {
  if (!zone && !offset) return null;

  // Ship time — never render as a zone offset.
  const zoneStr = String(zone || '').trim();
  if (/ship/i.test(zoneStr)) return 'ship time';

  if (zoneStr && !GENERIC_ZONE_SENTINELS.has(zoneStr.toLowerCase())) {
    const zoneCues = TIMEZONE_CUE_LABELS[zoneStr];
    const offStr = offset ? String(offset).trim() : null;
    if (zoneCues && offStr) {
      const cue = zoneCues[offStr];
      if (cue) return cue;
    }
    // Zone is known but offset doesn't match a DST variant — return the offset
    // itself if it is a clean 2-char ±HH:MM form, otherwise null.
    if (offStr) {
      const m = offStr.match(/^([+-]\d{2}):(\d{2})$/);
      if (m && m[2] === '00') return m[1]; // e.g. "+02:00" → "+02"
      return offStr; // fall back to the raw offset string
    }
    // No offset — do not choose a DST/winter abbreviation. That would be a
    // timezone guess, not a display cue from source evidence.
    return null;
  }

  // Fall back to deriving purely from the ISO string offset.
  return formatTimezoneCueFromOffset(offset);
}

/**
 * Format a timezone cue purely from an ISO string's UTC offset.
 * Handles the common travel-zone offsets without Intl.
 *
 * @param {string|null|undefined} isoOrOffset - ISO datetime string or raw offset
 * @returns {string|null} - compact display cue or null
 */
export function formatTimezoneCueFromOffset(isoOrOffset) {
  const offset = isoOrOffset
    ? (typeof isoOrOffset === 'string' && /^[+-]\d{2}:\d{2}$|^Z$/i.test(isoOrOffset.trim())
      ? isoOrOffset.trim()
      : extractUtcOffset(isoOrOffset))
    : null;
  if (!offset) return null;

  const KNOWN_OFFSET_CUES = {
    '+02:00': 'CEST', '+02': 'CEST',
    '+01:00': 'BST',  '+01': 'BST',
    '+00:00': 'GMT',  'Z':    'GMT',
    '-04:00': 'EDT',  '-04': 'EDT',
    '-05:00': 'EST',  '-05': 'EST',
    '-07:00': 'PDT',  '-07': 'PDT',
    '-08:00': 'PST',  '-08': 'PST',
  };
  return KNOWN_OFFSET_CUES[offset] || null;
}

/**
 * Build a compact timezone cue for a leg from available metadata.
 *
 * Priority order:
 *   1. leg.timezone / leg.timeZone  (IANA zone)
 *   2. leg.timezoneLabel            (pre-formatted string label)
 *   3. leg.time_basis / leg.timeBasis (informational text)
 *   4. monitoring_timing.timezone   (from the brief builder projection)
 *   5. Derive from the ISO offset embedded in the leg's start/end time
 *
 * Ship time: if the zone name or label contains "ship" (case-insensitive),
 * render "ship time" and do not append a generic offset.
 *
 * @param {object} leg - leg object from the dashboard brief
 * @param {string} [leg.start] - ISO datetime string with local offset
 * @returns {string|null} - compact timezone cue string, or null
 */
export function formatLegTimezoneCue(leg, isoTime) {
  if (!leg || typeof leg !== 'object') return null;

  // 1. IANA zone from monitoring_timing or leg-level
  const tz = leg.timezone || leg.timeZone;
  // 2. Pre-formatted label
  const label = leg.timezoneLabel;
  // 3. Informational basis text
  const basis = leg.time_basis || leg.timeBasis;
  // 4. monitoring_timing sub-block
  const mt = leg.monitoring_timing;
  const mtTz = mt?.timezone || mt?.timeZone;

  const sourceZone = tz || mtTz || null;
  const sourceOffset = isoTime ? extractUtcOffset(isoTime) : null;

  // Ship time — always label as ship time, never fabricate an offset
  if (/ship/i.test(String(label || basis || sourceZone || ''))) {
    return 'ship time';
  }

  // Pre-formatted label — use verbatim if informative
  if (label && !GENERIC_ZONE_SENTINELS.has(label.toLowerCase())) {
    return label;
  }

  // Explicit generic sentinel metadata such as "local", "browser", or "UTC"
  // is not evidence for a traveller-facing cue. Do not then derive a cue from
  // the offset; the source has said the timezone basis is not specific enough.
  if (sourceZone && GENERIC_ZONE_SENTINELS.has(String(sourceZone).toLowerCase())) {
    return null;
  }

  // Use IANA zone + offset to look up a compact cue
  if (sourceZone) {
    const cue = formatTimezoneCueFromMetadata(sourceZone, sourceOffset);
    if (cue) return cue;
  }

  // Without explicit leg/source timezone metadata, keep the existing terse label.
  // The offset alone is an instant detail, not enough evidence that a cue would
  // be useful on the dashboard.
  return null;
}
