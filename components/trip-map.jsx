'use client';

import { useEffect, useState } from 'react';
import { buildViewport, projectBasemap, projectPlaces, projectPoint } from '@/lib/basemap-projection.mjs';

const VIEWBOX_WIDTH = 600;
const VIEWBOX_HEIGHT = 360;

const BASEMAP_URL = '/vectors/world-slim.json';
const PLACES_URL = '/vectors/places-slim.json';

/**
 * TripMap — renders a privacy-safe inline SVG of the trip's waypoints
 * over a simplified world basemap (country outlines + major populated
 * places). The basemap data is loaded once per page from the dashboard's
 * own /vectors/*.json static assets (Natural Earth, public domain).
 *
 * Behaviour:
 *   - Geocodes each unique leg origin/destination via /api/geocode.
 *   - Never geocodes labels with precision 'home' or 'exact'.
 *   - Falls back to a waypoint list when fewer than 2 waypoints resolve.
 *   - Falls back to a route list when no geocoding succeeds.
 *   - All rendering happens in-browser as inline SVG (no external image
 *     or third-party tile service), so the map never depends on a
 *     remote provider being online.
 *   - The basemap is loaded lazily after geocoding resolves, so the
 *     waypoint list is the first thing the user sees.
 */
export function TripMap({ legs = [] }) {
  const [waypoints, setWaypoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [basemap, setBasemap] = useState(null);
  const [places, setPlaces] = useState(null);

  // Geocode the waypoints. This effect runs first; the basemap is loaded
  // only after we know there are enough waypoints to render.
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

  const geocoded = waypoints.filter((w) => w.geocoded);

  // Load the basemap + places JSON once we know we have enough waypoints
  // to render. Both files are static and served from the dashboard's own
  // public/vectors/ directory (Natural Earth, public domain).
  useEffect(() => {
    if (geocoded.length < 2) return;
    if (basemap && places) return;
    let cancelled = false;
    Promise.all([
      basemap ? Promise.resolve(null) : fetch(BASEMAP_URL).then((r) => r.json()),
      places ? Promise.resolve(null) : fetch(PLACES_URL).then((r) => r.json()),
    ]).then(([world, placeList]) => {
      if (cancelled) return;
      if (world && !basemap) setBasemap(world);
      if (placeList && !places) setPlaces(placeList);
    });
    return () => {
      cancelled = true;
    };
  }, [geocoded.length, basemap, places]);

  if (loading) {
    return (
      <div className="trip-map-loading">
        <p className="map-note">🗺️ Loading map…</p>
      </div>
    );
  }

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

  // Compute the viewport from the geocoded waypoints
  const viewport = buildViewport(geocoded, {
    width: VIEWBOX_WIDTH,
    height: VIEWBOX_HEIGHT,
    padding: 0.18,
    minSpan: 0.5,
  });

  // Project the basemap and city labels into the viewport. Both are
  // derived data — pure functions, safe to recompute on every render.
  const basemapPaths = basemap ? projectBasemap(basemap, viewport) : [];
  const cityLabels = places ? projectPlaces(places, viewport, 200000) : [];

  // Project each waypoint to SVG coords
  const points = geocoded.map((w, i) => {
    const { x, y } = projectPoint(w, viewport);
    return {
      ...w,
      x,
      y,
      labelOffsetY: i % 2 === 0 ? -22 : 28,
    };
  });

  // Country labels: pick the most populous country inside the viewport
  // (skipped for now — would need the country feature list, not just paths)
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
        {/* Basemap: simplified country outlines, drawn as one path per
            polygon (each clipped to the viewport). The basemap CSS class
            controls fill/stroke so the colour adapts to the theme. */}
        <g className="trip-map-basemap">
          {basemapPaths.map((d, i) => (
            <path key={i} d={d} className="trip-map-country" />
          ))}
        </g>
        {/* City labels: small dots + name for major populated places
            inside the viewport. Helps orient the user when the route
            is over a country they may not recognise by outline. */}
        <g className="trip-map-places">
          {cityLabels.map((c) => (
            <g key={c.name} className="trip-map-place" transform={`translate(${c.x},${c.y})`}>
              <circle className="trip-map-place-dot" r="1.5" />
              <text className="trip-map-place-label" x="4" y="3">
                {c.name}
              </text>
            </g>
          ))}
        </g>
        {/* Route line connecting waypoints in sequence */}
        <polyline
          className="trip-map-route-line"
          points={points.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="url(#trip-map-route)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Waypoint markers on top */}
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

function truncate(value, max) {
  if (!value) return '';
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
