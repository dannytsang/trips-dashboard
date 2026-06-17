'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatLegModeEmoji } from '@/lib/display-labels.mjs';

/**
 * TripMapStrip — per-leg directions strip using Google Maps Embed
 * `directions` mode. One small iframe per leg, vertically stacked,
 * each showing the A→B route line for that leg.
 *
 * Behaviour (spec 010 FR-032..035):
 *   - Renders one iframe per leg that has both a non-private origin
 *     and a non-private destination (precision != 'home' && != 'exact')
 *     AND both waypoints geocoded successfully via /api/geocode.
 *   - Each iframe URL is
 *       https://www.google.com/maps/embed/v1/directions
 *         ?key=<NEXT_PUBLIC_GMAPS_EMBED_KEY>
 *         &origin=<lat>,<lon>
 *         &destination=<lat>,<lon>
 *         &mode=<driving|walking|bicycling|transit>
 *   - The leg's `mode` is normalised to Google's accepted set:
 *       driving, walking, bicycling, transit
 *     All other modes (flight, cruise, ferry, taxi, bus, train, etc.)
 *     map to `driving` for the iframe URL — the iframe is visual, not
 *     a routing engine, and these modes don't have distinct Google
 *     directions modes. The leg label keeps the original mode emoji
 *     so the user still sees the real mode.
 *   - Privacy (FR-027 reuse): a leg is rendered only if BOTH endpoints
 *     have a precision other than 'home' or 'exact'. The /api/geocode
 *     server route also enforces this; we additionally filter here
 *     as a defence-in-depth check.
 *   - Performance (FR-034): each iframe has a fixed `aspect-ratio: 4/3`
 *     via the `.trip-map-strip-iframe` CSS class (no CLS shift), and
 *     each iframe uses `loading="lazy"` so iframes below the fold are
 *     deferred.
 *   - Caption (FR-035): a small caption above each iframe shows the
 *     leg index, the original mode emoji, and origin → destination
 *     label. The caption renders even if the iframe itself fails to
 *     load, so the user can still see the route description.
 *   - Strip is rendered IN ADDITION TO the FR-027 single-pin place
 *     map; both visualisations co-exist. The strip is only rendered
 *     when the provider is Google (OSM has no `directions` embed
 *     endpoint).
 *   - If every leg's geocoding fails, the strip falls back to a
 *     text-only list of leg labels and a "🧭 Directions map could not
 *     be generated for this trip." note.
 */

// Normalise a leg's transport mode to one of Google's accepted
// directions modes. Anything unrecognised (flight, cruise, ferry, taxi,
// bus, train, etc.) collapses to `driving` for the iframe URL.
function normaliseMode(rawMode) {
  const m = String(rawMode || '').toLowerCase();
  if (m.includes('walk')) return 'walking';
  if (m.includes('bike') || m.includes('cycl')) return 'bicycling';
  if (m.includes('transit') || m.includes('rail') || m.includes('train')) return 'transit';
  if (m.includes('drive') || m.includes('car') || m.includes('taxi') || m.includes('bus') || m.includes('ferry') || m.includes('cruise') || m.includes('flight')) return 'driving';
  return 'driving';
}

// Resolve the provider the same way as TripMap so the strip and the
// single-pin map agree on which provider is active. The strip only
// renders when the resolved provider is 'google' — otherwise the
// single-pin map is the right UI for OSM (no directions embed).
function resolveProvider(propProvider, envProvider, hasKey) {
  const requested = (propProvider || envProvider || 'osm').toLowerCase();
  if (requested === 'google' && hasKey) return 'google';
  return 'osm';
}

export function TripMapStrip({ legs = [], homeBase = null, mapProvider = null }) {
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

  // Build per-leg iframe descriptors once we have the geocoded waypoints.
  // FR-032: a leg is rendered only if BOTH endpoints are non-private
  // (precision != 'home' && != 'exact') AND have a successful geocode.
  const envProvider = process.env.NEXT_PUBLIC_GMAPS_PROVIDER || '';
  const envKey = process.env.NEXT_PUBLIC_GMAPS_EMBED_KEY || '';
  const provider = resolveProvider(mapProvider, envProvider, Boolean(envKey));

  const items = useMemo(() => {
    if (provider !== 'google') return [];
    if (!legs || legs.length === 0) return [];
    const byKey = new Map();
    for (const wp of waypoints) {
      byKey.set(wp.key, wp);
    }
    const out = [];
    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      if (!leg?.origin?.label || !leg?.destination?.label) continue;
      const originKey = `${(leg.origin.geocodeLabel || leg.origin.label)}::${leg.origin.precision || ''}`;
      const destKey = `${(leg.destination.geocodeLabel || leg.destination.label)}::${leg.destination.precision || ''}`;
      const origin = byKey.get(originKey);
      const dest = byKey.get(destKey);
      if (!origin?.geocoded || !dest?.geocoded) continue;
      if (origin.precision === 'home' || origin.precision === 'exact') continue;
      if (dest.precision === 'home' || dest.precision === 'exact') continue;
      const mode = normaliseMode(leg.mode);
      const originLat = origin.lat.toFixed(5);
      const originLon = origin.lon.toFixed(5);
      const destLat = dest.lat.toFixed(5);
      const destLon = dest.lon.toFixed(5);
      const params = new URLSearchParams({
        key: envKey,
        origin: `${originLat},${originLon}`,
        destination: `${destLat},${destLon}`,
        mode,
      });
      out.push({
        index: i + 1,
        mode: leg.mode,
        modeEmoji: formatLegModeEmoji(leg.mode || 'unknown'),
        originLabel: leg.origin.label,
        destLabel: leg.destination.label,
        modeNormalised: mode,
        src: `https://www.google.com/maps/embed/v1/directions?${params.toString()}`,
        viewLargeHref: `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLon}&destination=${destLat},${destLon}&travelmode=${mode}`,
      });
    }
    return out;
  }, [legs, waypoints, provider, envKey]);

  if (loading) {
    return (
      <div className="trip-map-strip-loading">
        <p className="map-note">🧭 Loading per-leg routes…</p>
      </div>
    );
  }

  // Provider guard: OSM has no directions embed, so the strip stays
  // empty for OSM users. The single-pin TripMap (rendered above the
  // strip) is the right UI for OSM.
  if (provider !== 'google') {
    return null;
  }

  if (items.length === 0) {
    // FR-033 fallback: every leg's geocoding failed (or no legs have
    // both non-private endpoints). Render a text-only list of leg
    // labels and a clear note so the user still sees the route
    // description, even without the iframe.
    return (
      <div className="trip-map-strip-fallback">
        <p className="map-note">🧭 Directions map could not be generated for this trip.</p>
        <ul className="leg-route-fallback-list">
          {legs
            .filter((l) => l.origin?.label || l.destination?.label)
            .map((leg, i) => (
              <li key={`${leg.label || 'leg'}-${i}`}>
                <strong>{i + 1}.</strong> {leg.origin?.label || '?'} → {leg.destination?.label || '?'}
              </li>
            ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="trip-map-strip" aria-label="Per-leg route directions">
      {items.map((item) => (
        <div key={`leg-route-${item.index}`} className="trip-map-strip-item">
          <p className="trip-map-strip-caption">
            <span className="trip-map-strip-index">{item.index}.</span>{' '}
            <span className="trip-map-strip-emoji" aria-hidden="true">
              {item.modeEmoji}
            </span>{' '}
            <span className="trip-map-strip-route">
              {item.originLabel} → {item.destLabel}
            </span>
          </p>
          <iframe
            className="trip-map-strip-iframe"
            title={`Leg ${item.index}: ${item.originLabel} → ${item.destLabel}`}
            src={item.src}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
          <p className="trip-map-strip-attribution">
            Map data ©{' '}
            <a
              href="https://www.google.com/maps"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google
            </a>
            {' · '}
            <a
              href={item.viewLargeHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              View larger map
            </a>
          </p>
        </div>
      ))}
    </div>
  );
}
