// Deterministic UTC date/time formatting.
//
// `Intl.DateTimeFormat('en-GB', …)` produces different punctuation on Node
// vs Safari (Node emits a comma, Safari emits "at"). That difference causes
// React hydration #418 errors on the dashboard. We work around it by always
// formatting with explicit UTC components and a single, fixed separator.
//
// All outputs are pure functions of `iso` (an ISO-8601 string) and produce
// the same result on the server (Node) and the client (any modern browser).

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pad2(n) {
  const s = String(n);
  return s.length < 2 ? '0' + s : s;
}

export function formatUtcDateShort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]}`;
}

// "Fri 3 Jul" — UTC weekday + day + month.
export function formatUtcWeekdayDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${WEEKDAY_SHORT[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]}`;
}

// "17 Jun, 11:32" — exactly the format we want, with a fixed comma separator.
export function formatUtcDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]}, ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

// "11:32" — UTC time only.
export function formatUtcTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

// "Fri 3 Jul → Sat 4 Jul" — two UTC weekday-date labels separated by an arrow.
export function formatUtcDateRange(startIso, endIso) {
  const start = formatUtcWeekdayDate(startIso);
  const end = endIso ? formatUtcWeekdayDate(endIso) : null;
  if (!start) return 'Date pending';
  if (!end) return start;
  return `${start} → ${end}`;
}

// "Fri 3 Jul 2026 → Sat 4 Jul 2026" — UTC weekday-date labels with year.
export function formatUtcDateRangeWithYear(startIso, endIso) {
  const start = formatUtcWeekdayDateWithYear(startIso);
  const end = endIso ? formatUtcWeekdayDateWithYear(endIso) : null;
  if (!start) return 'Date pending';
  if (!end) return start;
  return `${start} → ${end}`;
}

// "Fri 3 Jul, 11:32" — UTC weekday + day + month + time.
export function formatUtcWeekdayDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${WEEKDAY_SHORT[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]}, ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

// "Fri 3 Jul 2026" — UTC weekday + day + month + year.
export function formatUtcWeekdayDateWithYear(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${WEEKDAY_SHORT[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
