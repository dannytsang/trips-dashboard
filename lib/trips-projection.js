export const TRIPS_PROJECTION_SCHEMA_VERSION = 1;
export const MAX_PROJECTION_BYTES = 256 * 1024;

const privateKeyFragments = [
  ['lati', 'tude'],
  ['longi', 'tude'],
  ['coord', 'inates?'],
  ['raw'],
  ['secret'],
  ['token'],
  ['oauth'],
  ['calendar.*', 'id'],
  ['event.*', 'id'],
  ['contact.*', 'id'],
  ['phone'],
  ['email'],
];

const privateValueFragments = [
  ['google', '_calendar:'],
  ['device', '_tracker\.'],
  ['person', '\\.'],
  ['BEGIN\\s+(RSA|OPENSSH|PRIVATE)\\s+KEY'],
];

const FORBIDDEN_KEY_PATTERNS = privateKeyFragments.map(parts => new RegExp(parts.join(''), 'i'));
const FORBIDDEN_VALUE_PATTERNS = privateValueFragments.map(parts => new RegExp(parts.join(''), 'i'));

export class ProjectionValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'ProjectionValidationError';
    this.details = details;
  }
}

function byteLength(value) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

function isIsoDateString(value) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    return false;
  }

  return /^\d{4}-\d{2}-\d{2}T/.test(value);
}

function collectForbiddenFields(value, path = '$', findings = []) {
  if (value == null) return findings;

  if (typeof value === 'string') {
    for (const pattern of FORBIDDEN_VALUE_PATTERNS) {
      if (pattern.test(value)) {
        findings.push(`${path} contains forbidden private-data pattern ${pattern}`);
      }
    }
    return findings;
  }

  if (typeof value !== 'object') return findings;

  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectForbiddenFields(entry, `${path}[${index}]`, findings));
    return findings;
  }

  for (const [key, entry] of Object.entries(value)) {
    for (const pattern of FORBIDDEN_KEY_PATTERNS) {
      if (pattern.test(key)) {
        findings.push(`${path}.${key} uses forbidden private-data key`);
      }
    }
    collectForbiddenFields(entry, `${path}.${key}`, findings);
  }

  return findings;
}

function validateTripSummary(trip, index) {
  const errors = [];
  const path = `trips[${index}]`;

  if (!trip || typeof trip !== 'object' || Array.isArray(trip)) {
    return [`${path} must be an object`];
  }

  for (const field of ['id', 'title', 'status']) {
    if (typeof trip[field] !== 'string' || trip[field].trim() === '') {
      errors.push(`${path}.${field} must be a non-empty string`);
    }
  }

  if (trip.start != null && typeof trip.start !== 'string') {
    errors.push(`${path}.start must be a string when provided`);
  }

  if (trip.end != null && typeof trip.end !== 'string') {
    errors.push(`${path}.end must be a string when provided`);
  }

  if (trip.travellers != null && !Array.isArray(trip.travellers)) {
    errors.push(`${path}.travellers must be an array when provided`);
  }

  if (trip.legs != null && !Array.isArray(trip.legs)) {
    errors.push(`${path}.legs must be an array when provided`);
  }

  return errors;
}

export function unwrapProjectionPayload(payload) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload) && payload.projection) {
    return payload.projection;
  }

  return payload;
}

export function validateTripsProjection(input, { receivedAt = new Date().toISOString() } = {}) {
  const projection = unwrapProjectionPayload(input);
  const errors = [];

  if (!projection || typeof projection !== 'object' || Array.isArray(projection)) {
    throw new ProjectionValidationError('Projection payload must be an object', ['$ must be an object']);
  }

  if (!Array.isArray(projection.trips)) {
    errors.push('trips must be an array');
  }

  if (projection.generatedAt != null && !isIsoDateString(projection.generatedAt)) {
    errors.push('generatedAt must be an ISO datetime string when provided');
  }

  if (projection.schemaVersion != null && projection.schemaVersion !== TRIPS_PROJECTION_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${TRIPS_PROJECTION_SCHEMA_VERSION} when provided`);
  }

  if (Array.isArray(projection.trips)) {
    projection.trips.forEach((trip, index) => {
      errors.push(...validateTripSummary(trip, index));
    });
  }

  errors.push(...collectForbiddenFields(projection));

  if (byteLength(projection) > MAX_PROJECTION_BYTES) {
    errors.push(`projection must be ${MAX_PROJECTION_BYTES} bytes or smaller`);
  }

  if (errors.length > 0) {
    throw new ProjectionValidationError('Invalid trips projection', errors);
  }

  return {
    schemaVersion: TRIPS_PROJECTION_SCHEMA_VERSION,
    generatedAt: projection.generatedAt || receivedAt,
    receivedAt,
    trips: projection.trips,
    summary: projection.summary && typeof projection.summary === 'object' && !Array.isArray(projection.summary)
      ? projection.summary
      : {},
  };
}

export function createEmptyProjection({ generatedAt = null, receivedAt = null } = {}) {
  return {
    schemaVersion: TRIPS_PROJECTION_SCHEMA_VERSION,
    generatedAt,
    receivedAt,
    trips: [],
    summary: {},
  };
}
