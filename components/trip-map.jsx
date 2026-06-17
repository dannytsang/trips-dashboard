'use client';

import { useEffect, useMemo, useState } from 'react';
import { buildViewport } from '@/lib/basemap-projection.mjs';

/**
 * TripMap — renders an embedded OpenStreetMap iframe for the trip's
 * waypoints, with a waypoint list below as a structured fallback.
 *
 * Behaviour (spec 010 FR-009, FR-026, FR-027):
 *   - Geocodes each unique leg origin/destination via /api/geocode.
 *   - Never geocodes labels with precision 'home' or 'exact'; those
 *     waypoints appear in the waypoint list only (never in the map URL).
 *   - Computes a bbox from the geocoded (non-private) waypoints using the
 *     same buildViewport() helper as before — preserves the route framing.
 *   - Picks the final leg's destination as the single marker (OSM
 *     /export/embed.html only supports one marker per iframe).
 *   - Falls back to a route list when fewer than 2 waypoints geocode.
 *   - Always renders the structured waypoint list so the user sees the
 *     full set of stops regardless of map render quality.
 *
 * Privacy:
 *   - The OSM iframe URL is constructed in-browser from waypoints whose
 *     precision is NOT 'home' or 'exact'. Private locations are excluded.
 *   - The /api/geocode server route already enforces this; we additionally
 *     filter here as a defence-in-depth check before composing the URL.
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
        // FR-026: geocodeLabel overrides the Nominatim input but the
        // visible waypoint label on the page stays as `label`.
        const geocodeInput = wp.geocodeLabel || wp.label;
        const key = `${geocodeInput}::${wp.precision || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        queue.push({ key, label: wp.label, geocodeLabel: wp.geocodeLabel, precision: wp.precision });
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
      const geocodeInput = wp.geocodeLabel || wp.label;
      try {
        const res = await fetch('/api/geocode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: geocodeInput, precision: wp.precision }),
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

  const geocoded = useMemo(
    () => waypoints.filter((w) => w.geocoded),
    [waypoints]
  );

  // Build the OSM embed URL once we have enough geocoded waypoints.
  // FR-027: only non-private (precision != 'home'/'exact') waypoints
  // contribute to the bbox and marker. Defence in depth — the server
  // geocoder also enforces this, but we filter again here so the URL is
  // never composed from a private coord even if the server response is
  // tampered with or a client-side code path is missed.
  const embed = useMemo(() => {
    if (geocoded.length < 2) return null;
    const visible = geocoded.filter(
      (w) => w.precision !== 'home' && w.precision !== 'exact'
    );
    if (visible.length < 2) return null;
    const viewport = buildViewport(visible, {
      width: 600,
      height: 360,
      padding: 0.18,
      minSpan: 0.4,
    });
    const { minLon, minLat, maxLon, maxLat } = viewport;
    // OSM embed bbox order: minLon,minLat,maxLon,maxLat
    const bbox = `${minLon.toFixed(5)},${minLat.toFixed(5)},${maxLon.toFixed(5)},${maxLat.toFixed(5)}`;
    // Marker: prefer the last visible waypoint (typically the destination
    // / accommodation, which is always a public venue per FR-027).
    // OSM embed uses lat,lon order for the marker parameter.
    const markerWp = visible[visible.length - 1];
    const markerLat = markerWp.lat.toFixed(5);
    const markerLon = markerWp.lon.toFixed(5);
    const params = new URLSearchParams({ bbox, layer: 'mapnik', marker: `${markerLat},${markerLon}` });
    // Build a "View larger map" link to the public OSM site at the same
    // marker and a sensible zoom (zoom 11 ≈ city scale for the bbox sizes
    // we render). mlat/mlon order matches the embed URL convention.
    const viewLargeParams = new URLSearchParams({
      mlat: markerLat,
      mlon: markerLon,
    });
    const viewLargeHref = `https://www.openstreetmap.org/?${viewLargeParams.toString()}#map=11/${markerLat}/${markerLon}`;
    return {
      src: `https://www.openstreetmap.org/export/embed.html?${params.toString()}`,
      markerLabel: markerWp.label,
      viewLargeHref,
    };
  }, [geocoded]);

  if (loading) {
    return (
      <div className="trip-map-loading">
        <p className="map-note">🗺️ Loading map…</p>
      </div>
    );
  }

  if (!embed) {
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

  return (
    <div className="trip-map-container" aria-label={`Map of ${geocoded.length} waypoints`}>
      <iframe
        className="trip-map-iframe"
        title={`Trip map centred on ${embed.markerLabel}`}
        src={embed.src}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <p className="trip-map-attribution">
        ©{' '}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
        >
          OpenStreetMap
        </a>{' '}
        contributors ·{' '}
        <a
          href={embed.viewLargeHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          View larger map
        </a>
      </p>
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