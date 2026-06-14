import { createHash } from 'node:crypto';

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

  for (const field of ['id', 'title', 'status', 'destinationLabel']) {
    if (typeof trip[field] !== 'string' || trip[field].trim() === '') {
      errors.push(`${path}.${field} must be a non-empty string`);
    }
  }

  if (trip.schemaVersion != null && trip.schemaVersion !== TRIPS_PROJECTION_SCHEMA_VERSION) {
    errors.push(`${path}.schemaVersion must be ${TRIPS_PROJECTION_SCHEMA_VERSION}`);
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

  if (!trip.planning || typeof trip.planning !== 'object' || Array.isArray(trip.planning)) {
    errors.push(`${path}.planning must be an object`);
  }

  if (!trip.monitoring || typeof trip.monitoring !== 'object' || Array.isArray(trip.monitoring)) {
    errors.push(`${path}.monitoring must be an object`);
  }

  if (trip.legs != null && !Array.isArray(trip.legs)) {
    errors.push(`${path}.legs must be an array when provided`);
  }

  return errors;
}

function validateManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return ['manifest must be an object'];
  }
  if (manifest.schemaVersion !== TRIPS_PROJECTION_SCHEMA_VERSION) {
    errors.push(`manifest.schemaVersion must be ${TRIPS_PROJECTION_SCHEMA_VERSION}`);
  }
  if (!isIsoDateString(manifest.generatedAt)) {
    errors.push('manifest.generatedAt must be an ISO datetime string');
  }
  if (!Array.isArray(manifest.trips)) {
    errors.push('manifest.trips must be an array');
  } else {
    manifest.trips.forEach((entry, index) => {
      const path = `manifest.trips[${index}]`;
      for (const field of ['id', 'path', 'sha256', 'sidecarPath', 'sortStart', 'status', 'title', 'destinationLabel']) {
        if (typeof entry?.[field] !== 'string' || entry[field].trim() === '') {
          errors.push(`${path}.${field} must be a non-empty string`);
        }
      }
      if (entry?.path && !entry.path.startsWith('trips-dashboard/trips/')) {
        errors.push(`${path}.path must use trips-dashboard/trips/ prefix`);
      }
      if (entry?.sidecarPath && !entry.sidecarPath.endsWith('.sha256')) {
        errors.push(`${path}.sidecarPath must end with .sha256`);
      }
      if (entry?.sha256 && !/^[a-f0-9]{64}$/i.test(entry.sha256)) {
        errors.push(`${path}.sha256 must be a SHA-256 hex digest`);
      }
    });
  }
  return errors;
}

export function canonicalJson(value) {
  if (value == null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(entry => canonicalJson(entry)).join(',')}]`;
  }
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

export function sha256ForObject(value) {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
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

export function validateTripsProjectionEnvelope(input, { receivedAt = new Date().toISOString() } = {}) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ProjectionValidationError('Projection envelope must be an object', ['$ must be an object']);
  }

  const manifest = input.manifest;
  const tripsById = input.trips;
  errors.push(...validateManifest(manifest));

  if (!tripsById || typeof tripsById !== 'object' || Array.isArray(tripsById)) {
    errors.push('trips must be an object keyed by trip id');
  }

  const trips = [];
  if (manifest && Array.isArray(manifest.trips) && tripsById && typeof tripsById === 'object' && !Array.isArray(tripsById)) {
    for (const [index, entry] of manifest.trips.entries()) {
      const trip = tripsById[entry.id];
      if (!trip) {
        errors.push(`trips.${entry.id} must exist for manifest entry`);
        continue;
      }
      if (trip.id !== entry.id) {
        errors.push(`trips.${entry.id}.id must match manifest id`);
      }
      errors.push(...validateTripSummary(trip, index));
      const actualSha = sha256ForObject(trip);
      if (entry.sha256 && actualSha !== entry.sha256) {
        errors.push(`manifest.trips[${index}].sha256 must match canonical trip JSON`);
      }
      trips.push(trip);
    }
  }

  errors.push(...collectForbiddenFields(input));

  if (byteLength(input) > MAX_PROJECTION_BYTES) {
    errors.push(`projection envelope must be ${MAX_PROJECTION_BYTES} bytes or smaller`);
  }

  if (errors.length > 0) {
    throw new ProjectionValidationError('Invalid trips projection', errors);
  }

  return {
    manifest: {
      ...manifest,
      receivedAt,
    },
    tripsById,
    projection: validateTripsProjection({
      schemaVersion: TRIPS_PROJECTION_SCHEMA_VERSION,
      generatedAt: manifest.generatedAt,
      receivedAt,
      trips,
      summary: {
        tripCount: trips.length,
        staleAfterMinutes: manifest.staleAfterMinutes ?? null,
        lastSync: manifest.lastSync ?? {},
      },
    }, { receivedAt }),
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
