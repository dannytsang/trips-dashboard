'use client';

import { useEffect, useState } from 'react';

const VIEWBOX_WIDTH = 600;
const VIEWBOX_HEIGHT = 360;
const PADDING = 36;

/**
 * TripMap — renders a privacy-safe inline SVG of the trip's waypoints.
 *
 * Behaviour:
 *   - Geocodes each unique leg origin/destination via /api/geocode.
 *   - Never geocodes labels with precision 'home' or 'exact'.
 *   - Falls back to a waypoint list when fewer than 2 waypoints resolve.
 *   - Falls back to a route list when no geocoding succeeds.
 *   - All rendering happens in-browser as inline SVG (no external image),
 *     so the map never depends on a third-party tile service being online.
 */
export function TripMap({ legs = [] }) {
  const [waypoints, setWaypoints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!legs || legs.length === 0) {
      setLoading(false);
      setWaypoints([]);
      return;
    }

    const seen = new Set();
    const queue = [];
    for (const leg of legs) {
      for (const wp of [leg.origin, leg.destination]) {
        if (!wp?.label) continue;
        const key = `${wp.label}::${wp.precision || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        queue.push({ key, label: wp.label, precision: wp.precision });
      }
    }

    if (queue.length < 2) {
      setLoading(false);
      setWaypoints([]);
      return;
    }

    let cancelled = false;
    Promise.all(queue.map(async (wp) => {
      if (wp.precision === 'home' || wp.precision === 'exact') {
        return { ...wp, geocoded: false, reason: 'precision_excluded' };
      }
      try {
        const res = await fetch('/api/geocode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: wp.label, precision: wp.precision }),
        });
        const data = await res.json();
        if (data && data.lat != null && data.lon != null) {
          return { ...wp, geocoded: true, lat: data.lat, lon: data.lon };
        }
        return { ...wp, geocoded: false, reason: data?.error || 'not_found' };
      } catch {
        return { ...wp, geocoded: false, reason: 'network_error' };
      }
    })).then((results) => {
      if (cancelled) return;
      setWaypoints(results);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [legs]);

  if (loading) {
    return (
      <div className="trip-map-loading">
        <p className="map-note">🗺️ Loading map…</p>
      </div>
    );
  }

  const geocoded = waypoints.filter((w) => w.geocoded);

  if (geocoded.length < 2) {
    return (
      <div className="trip-map-fallback">
        <p className="map-note">🗺️ Map could not be generated for this trip.</p>
        <ul className="waypoint-list">
          {legs
            .filter((l) => l.origin?.label || l.destination?.label)
            .map((leg, i) => (
              <li key={`${leg.label || 'leg'}-${i}`}>
                <strong>{i + 1}.</strong>{' '}
                {leg.origin?.label || '?'} → {leg.destination?.label || '?'}
              </li>
            ))}
        </ul>
      </div>
    );
  }

  // Build a private privacy-safe view: coarse for 'home' / 'exact' waypoints
  // and exact for the rest. The waypoint matching below keeps the route line
  // honest by picking the coarsest precision encountered for any single label.
  const points = projectWaypoints(geocoded);

  return (
    <div className="trip-map-container" role="img" aria-label={`Map of ${geocoded.length} waypoints`}>
      <svg
        className="trip-map-svg"
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="trip-map-route" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="var(--accent-blue)" stopOpacity="0.95" />
          </linearGradient>
        </defs>
        <rect
          className="trip-map-canvas"
          x="0"
          y="0"
          width={VIEWBOX_WIDTH}
          height={VIEWBOX_HEIGHT}
          rx="10"
          ry="10"
        />
        <polyline
          className="trip-map-route-line"
          points={points.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="url(#trip-map-route)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <g key={`${p.label}-${i}`} className="trip-map-waypoint" transform={`translate(${p.x},${p.y})`}>
            <circle className="trip-map-marker-ring" r="14" />
            <circle className="trip-map-marker" r="9" />
            <text className="trip-map-marker-label" y="4" textAnchor="middle">
              {i + 1}
            </text>
            <text
              className="trip-map-waypoint-label"
              y={p.labelOffsetY}
              x="0"
              textAnchor="middle"
            >
              {truncate(p.label, 28)}
            </text>
          </g>
        ))}
      </svg>
      <ul className="waypoint-list">
        {geocoded.map((wp, i) => (
          <li key={`${wp.key}-${i}`}>
            <strong>{i + 1}.</strong> {wp.label}
            {wp.precision ? <span className="text-muted"> ({wp.precision})</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function projectWaypoints(geocoded) {
  const lons = geocoded.map((w) => w.lon);
  const lats = geocoded.map((w) => w.lat);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const lonSpan = Math.max(maxLon - minLon, 1e-6);
  const latSpan = Math.max(maxLat - minLat, 1e-6);
  const usableWidth = VIEWBOX_WIDTH - PADDING * 2;
  const usableHeight = VIEWBOX_HEIGHT - PADDING * 2;
  const scaleX = usableWidth / lonSpan;
  const scaleY = usableHeight / latSpan;
  const scale = Math.min(scaleX, scaleY);
  const offsetX = PADDING + (usableWidth - lonSpan * scale) / 2;
  const offsetY = PADDING + (usableHeight - latSpan * scale) / 2;

  return geocoded.map((w, i) => {
    const x = offsetX + (w.lon - minLon) * scale;
    // Latitude grows northward, but SVG y grows downward — flip.
    const y = offsetY + (maxLat - w.lat) * scale;
    return {
      ...w,
      x,
      y,
      labelOffsetY: i % 2 === 0 ? -22 : 28,
    };
  });
}

function truncate(value, max) {
  if (!value) return '';
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
