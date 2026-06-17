'use client';

/**
 * TripOverviewMap — standalone overview map rendered at the top of the
 * Legs section, above the leg list. Shows all legs on a single map:
 * one pin per leg destination, framed in a bbox that encompasses all
 * legs' non-private waypoints.
 *
 * This reinstates a variant of the FR-027 standalone map that FR-036
 * removed (FR-036 replaced it with per-leg inline maps only). The FR-042
 * overview map differs from FR-027 in one way: it renders ABOVE the leg
 * list (FR-027 rendered BELOW), and uses the same geocode cache as
 * LegRouteMap so concurrent geocoding is deduplicated.
 *
 * Provider (FR-028):
 *   provider=google:  single-pin `place` iframe at the trip's primary
 *                     destination (last non-private waypoint)
 *   provider=osm:     OSM `/export/embed.html` bbox around all waypoints,
 *                     single marker on the last non-private waypoint
 *
 * Privacy contract (FR-027): waypoints with precision 'home' or 'exact'
 * are excluded from the bbox and marker computation. The geocode server
 * also enforces this; we additionally filter here as defence in depth.
 *
 * Fallback: if fewer than 2 non-private waypoints geocode successfully,
 * the component returns null (no iframe). The leg list still renders.
 */

import { useEffect, useMemo, useState } from 'react';
import { buildViewport } from '@/lib/basemap-projection.mjs';

function resolveProvider(propProvider, envProvider, hasKey) {
  const requested = (propProvider || envProvider || 'osm').toLowerCase();
  if (requested === 'google' && hasKey) return 'google';
  return 'osm';
}

async function geocodeOne(wp) {
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
}

// Module-level geocode cache shared with LegRouteMap. A waypoint that
// appears in both the overview map and a per-leg iframe (e.g. a
// destination that is also an origin of the next leg) is geocoded once.
const geocodeCache = new Map();

function geocodeShared(wp) {
  if (wp.precision === 'home' || wp.precision === 'exact') {
    return Promise.resolve({ ...wp, geocoded: false, reason: 'precision_excluded' });
  }
  const geocodeInput = wp.geocodeLabel || wp.label;
  const key = `${geocodeInput}::${wp.precision || ''}`;
  if (geocodeCache.has(key)) {
    return geocodeCache.get(key);
  }
  const promise = geocodeOne(wp);
  geocodeCache.set(key, promise);
  return promise;
}

/**
 * Collect all non-private, geocodable waypoints from all legs.
 * Returns an array of { wp, legIndex } for waypoints that passed
 * the privacy filter and geocoded successfully.
 */
async function collectWaypoints(legs) {
  if (!legs || legs.length === 0) return [];

  // Gather all origin + destination waypoints, tagged with leg index
  const tasks = [];
  legs.forEach((leg, i) => {
    if (leg?.origin?.label) tasks.push({ wp: leg.origin, legIndex: i, field: 'origin' });
    if (leg?.destination?.label) tasks.push({ wp: leg.destination, legIndex: i, field: 'destination' });
  });

  const results = await Promise.all(tasks.map(t => geocodeShared(t.wp).then(res => ({ ...t, resolved: res }))));

  return results
    .filter(r => r.resolved.geocoded)
    .filter(r => r.resolved.precision !== 'home' && r.resolved.precision !== 'exact');
}

/**
 * Pick the marker: the last non-private, non-home-base waypoint.
 * homeBase.town is used to skip the home town return marker (e.g.
 * for out-and-back trips the marker should be on the meaningful
 * destination, not on the home town).
 */
function pickMarkerWaypoint(waypoints, homeBaseTown) {
  const candidates = homeBaseTown
    ? waypoints.filter(w => {
        const label = (w.wp.geocodeLabel || w.wp.label || '').toLowerCase().trim();
        return label !== homeBaseTown.toLowerCase().trim();
      })
    : waypoints;
  return candidates.length > 0 ? candidates[candidates.length - 1] : waypoints[waypoints.length - 1];
}

export function TripOverviewMap({ legs, homeBase, mapProvider = null }) {
  const [waypoints, setWaypoints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const collected = await collectWaypoints(legs);
      if (!cancelled) {
        setWaypoints(collected);
        setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [legs]);

  const envProvider = process.env.NEXT_PUBLIC_GMAPS_PROVIDER || '';
  const envKey = process.env.NEXT_PUBLIC_GMAPS_EMBED_KEY || '';
  const provider = resolveProvider(mapProvider, envProvider, Boolean(envKey));

  const homeBaseTown = homeBase?.town || null;

  const embed = useMemo(() => {
    if (loading) return null;
    if (waypoints.length < 2) return null;

    const markerWp = pickMarkerWaypoint(waypoints, homeBaseTown);
    const markerLat = markerWp.resolved.lat.toFixed(5);
    const markerLon = markerWp.resolved.lon.toFixed(5);

    if (provider === 'google') {
      const params = new URLSearchParams({
        key: envKey,
        q: `${markerLat},${markerLon}`,
        maptype: 'roadmap',
      });
      return {
        provider: 'google',
        src: `https://www.google.com/maps/embed/v1/place?${params.toString()}`,
        viewLargeHref: `https://www.google.com/maps?ll=${markerLat},${markerLon}&q=${markerLat},${markerLon}`,
      };
    }

    // OSM: bbox around all geocoded waypoints, marker on the marker waypoint
    const viewport = buildViewport(
      waypoints.map(w => ({ lat: w.resolved.lat, lon: w.resolved.lon })),
      { width: 600, height: 400, padding: 0.25, minSpan: 0.05 }
    );
    const { minLon, minLat, maxLon, maxLat } = viewport;
    const bbox = `${minLon.toFixed(5)},${minLat.toFixed(5)},${maxLon.toFixed(5)},${maxLat.toFixed(5)}`;
    const params = new URLSearchParams({
      bbox,
      layer: 'mapnik',
      marker: `${markerLat},${markerLon}`,
    });
    return {
      provider: 'osm',
      src: `https://www.openstreetmap.org/export/embed.html?${params.toString()}`,
      viewLargeHref: `https://www.openstreetmap.org/?mlat=${markerLat}&mlon=${markerLon}#map=12/${markerLat}/${markerLon}`,
    };
  }, [loading, waypoints, homeBaseTown, provider, envKey]);

  if (loading) {
    return (
      <div className="trip-overview-map trip-overview-map-loading" aria-label="Loading trip overview map">
        <p className="map-note">🗺️ Loading overview map…</p>
      </div>
    );
  }

  // Fewer than 2 geocoded waypoints — no map to render
  if (waypoints.length < 2 || !embed) {
    return null;
  }

  return (
    <div className="trip-overview-map" aria-label="Trip overview map">
      <iframe
        className="trip-overview-map-iframe"
        title="Trip overview map"
        src={embed.src}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
      <p className="trip-overview-map-attribution">
        {embed.provider === 'google' ? (
          <>
            Map data © <a href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer">Google</a>
            {' · '}
            <a href={embed.viewLargeHref} target="_blank" rel="noopener noreferrer">View larger map</a>
          </>
        ) : (
          <>
            © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors
            {' · '}
            <a href={embed.viewLargeHref} target="_blank" rel="noopener noreferrer">View larger map</a>
          </>
        )}
      </p>
    </div>
  );
}
