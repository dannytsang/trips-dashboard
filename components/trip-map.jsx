'use client';

import { useEffect, useState } from 'react';

const OSM_STATIC_MAP_URL = 'https://staticmap.openstreetmap.de/staticmap.php';

/**
 * Build an OSM static map URL from an array of { lon, lat, label } waypoints.
 * Uses OpenStreetMap's free static map tile server — no API key required.
 *
 * @param {Array<{lon: number, lat: number, label: string}>} waypoints
 * @param {number} size
 * @returns {string|null}
 */
function buildOsmStaticMapUrl(waypoints, size = 600) {
  if (!waypoints || waypoints.length < 2) return null;

  // Calculate bounding box to auto-fit zoom
  const lons = waypoints.map(w => w.lon);
  const lats = waypoints.map(w => w.lat);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  // Approximate zoom from bounding box span (degrees)
  const lonSpan = maxLon - minLon;
  const latSpan = maxLat - minLat;
  const maxSpan = Math.max(lonSpan, latSpan);
  let zoom = 10;
  if (maxSpan < 0.01) zoom = 14;
  else if (maxSpan < 0.05) zoom = 12;
  else if (maxSpan < 0.2) zoom = 10;
  else if (maxSpan < 0.5) zoom = 8;
  else if (maxSpan < 2) zoom = 6;
  else if (maxSpan < 5) zoom = 5;
  else zoom = 4;

  // Build markers param: color:pm2rdm for red markers with numbers
  const markers = waypoints
    .map((w, i) => {
      // Use pm2rdm (red marker with white border) with numeric label
      return `pm2rdm${i + 1}${w.lon},${w.lat}`;
    })
    .join('~');

  const params = new URLSearchParams({
    size: `${size}x${Math.round(size * 0.67)}`,
    markers,
    zoom: String(zoom),
    maptype: 'mapnik',
  });

  return `${OSM_STATIC_MAP_URL}?${params.toString()}`;
}

/**
 * TripMap — renders a static OSM map with numbered waypoint markers.
 *
 * Props:
 *   legs: array of leg objects, each optionally containing:
 *     - origin: { label: string, precision?: string }
 *     - destination: { label: string, precision?: string }
 *     - waypointIndex: number (1-based, for marker label)
 *
 * Behaviour:
 *   - Fetches coordinates for each unique waypoint via /api/geocode at render time.
 *   - Never geocodes labels with precision 'home' or 'exact' (privacy-safe).
 *   - Shows waypoint list fallback if fewer than 2 waypoints resolve.
 *   - Shows a loading placeholder while geocoding is in progress.
 */
export function TripMap({ legs = [] }) {
  const [waypointCoords, setWaypointCoords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!legs || legs.length === 0) {
      setLoading(false);
      return;
    }

    // Collect unique waypoints to geocode
    const waypointsToGeocode = [];
    const seen = new Set();

    for (const leg of legs) {
      const origin = leg.origin;
      const dest = leg.destination;

      if (origin?.label && !seen.has(origin.label)) {
        seen.add(origin.label);
        waypointsToGeocode.push({
          key: origin.label,
          label: origin.label,
          precision: origin.precision,
          type: 'origin',
        });
      }

      if (dest?.label && !seen.has(dest.label)) {
        seen.add(dest.label);
        waypointsToGeocode.push({
          key: dest.label,
          label: dest.label,
          precision: dest.precision,
          type: 'destination',
        });
      }
    }

    if (waypointsToGeocode.length < 2) {
      setLoading(false);
      setWaypointCoords([]);
      return;
    }

    // Geocode all waypoints in parallel
    const geocodePromises = waypointsToGeocode.map(async (wp) => {
      // For privacy-excluded precisions, return null
      if (wp.precision === 'home' || wp.precision === 'exact') {
        return { ...wp, geocoded: false, error: 'precision_excluded' };
      }

      try {
        const res = await fetch('/api/geocode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: wp.label, precision: wp.precision }),
        });
        const data = await res.json();
        if (data.lat != null && data.lon != null) {
          return { ...wp, geocoded: true, lat: data.lat, lon: data.lon };
        }
        return { ...wp, geocoded: false, error: data.error || 'not_found' };
      } catch {
        return { ...wp, geocoded: false, error: 'network_error' };
      }
    });

    Promise.all(geocodePromises).then((results) => {
      const valid = results.filter(r => r.geocoded);
      setWaypointCoords(valid);
      setLoading(false);
    }).catch(() => {
      setError('Failed to load map');
      setLoading(false);
    });
  }, [legs]);

  if (loading) {
    return (
      <div className="trip-map-loading">
        <p className="map-note">🗺️ Loading map…</p>
      </div>
    );
  }

  if (error || waypointCoords.length < 2) {
    return (
      <div className="trip-map-fallback">
        <p className="map-note">🗺️ Map could not be generated.</p>
        <ul className="waypoint-list">
          {legs
            .filter(l => l.origin?.label || l.destination?.label)
            .map((leg, i) => (
              <li key={i}>
                <strong>{i + 1}.</strong>{' '}
                {leg.origin?.label || '?'} → {leg.destination?.label || '?'}
              </li>
            ))}
        </ul>
      </div>
    );
  }

  const mapUrl = buildOsmStaticMapUrl(waypointCoords);

  if (!mapUrl) {
    return (
      <div className="trip-map-fallback">
        <p className="map-note">🗺️ Not enough location data for a map.</p>
      </div>
    );
  }

  return (
    <div className="trip-map-container">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mapUrl}
        alt={`Map showing ${waypointCoords.length} waypoints`}
        className="trip-map-image"
        width={600}
        height={400}
      />
      <ul className="waypoint-list">
        {waypointCoords.map((wp, i) => (
          <li key={wp.key}>
            <strong>{i + 1}.</strong> {wp.label}
            {wp.precision ? ` (${wp.precision})` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}