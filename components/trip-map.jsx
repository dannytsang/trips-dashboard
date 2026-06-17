'use client';

import { useEffect, useMemo, useState } from 'react';
import { buildViewport } from '@/lib/basemap-projection.mjs';

/**
 * TripMap — renders an embedded map iframe (OpenStreetMap or Google Maps
 * Embed API) for the trip's waypoints, with a waypoint list below as a
 * structured fallback.
 *
 * Behaviour (spec 010 FR-009, FR-026, FR-027):
 *   - Geocodes each unique leg origin/destination via /api/geocode.
 *   - Never geocodes labels with precision 'home' or 'exact'; those
 *     waypoints appear in the waypoint list only (never in the map URL).
 *   - Computes a bbox from the geocoded (non-private) waypoints using the
 *     same buildViewport() helper as before — preserves the route framing.
 *   - Picks the marker as the **last non-private, non-home** waypoint.
 *     For a return trip, this is the meaningful destination (e.g. the
 *     garden party for Petersfield), not the home town the trip returns
 *     to. Falls back to the last non-private waypoint when no non-home
 *     waypoint exists (e.g. a one-way trip that ends at home).
 *   - Falls back to a route list when fewer than 2 waypoints geocode.
 *   - Always renders the structured waypoint list so the user sees the
 *     full set of stops regardless of map render quality.
 *
 * Provider selection (NEXT_PUBLIC_GMAPS_PROVIDER + NEXT_PUBLIC_GMAPS_EMBED_KEY):
 *   - Default: 'osm' — zero API key, free, works on every preview deploy.
 *   - 'google': only used when both NEXT_PUBLIC_GMAPS_PROVIDER='google'
 *     AND NEXT_PUBLIC_GMAPS_EMBED_KEY is set. Otherwise falls back to OSM
 *     silently (the key is required by Google's iframe URL contract).
 *   - The `mapProvider` prop overrides the env var (used by tests).
 *
 * Google Maps Embed API:
 *   - We use `place` mode, which displays a single map pin. Google Embed
 *     has no native "multiple pins on one map" mode; that would require
 *     the (billable) Maps JavaScript SDK. The OSM embed has the same
 *     single-pin limitation, so this provider switch only changes the
 *     pin style and the iframe host — not the number of pins.
 *   - The key is referrer-restricted in Google Cloud Console
 *     (tsang-travel.vercel.app/* + *.vercel.app/* for previews).
 *
 * Privacy:
 *   - The iframe URL is constructed in-browser from waypoints whose
 *     precision is NOT 'home' or 'exact'. Private locations are excluded.
 *   - The /api/geocode server route already enforces this; we additionally
 *     filter here as a defence-in-depth check before composing the URL.
 *   - The home base town (passed via `homeBase.town`) is also excluded
 *     from the marker selection. The bbox still includes the home town
 *     (so the visible map area frames the full trip), but the pin
 *     highlights the destination, not home.
 */

// Provider resolution order: explicit prop > NEXT_PUBLIC_GMAPS_PROVIDER > 'osm'.
// The key check is the gate for 'google' — without a key, Google is not usable.
function resolveProvider(propProvider, envProvider, hasKey) {
  const requested = (propProvider || envProvider || 'osm').toLowerCase();
  if (requested === 'google' && hasKey) return 'google';
  return 'osm';
}

export function TripMap({ legs = [], homeBase = null, mapProvider = null }) {
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

  // Build the iframe URL once we have enough geocoded waypoints.
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
    // Marker: prefer the last **non-home** visible waypoint. For a
    // round-trip (Petersfield: out → Premier Inn → garden party →
    // home), the last waypoint is home, which is the wrong pin to
    // highlight — the meaningful destination is the garden party.
    //
    // The home base town comes from the brief (trip.homeBase.town),
    // which the brief builder populates from the YAML's
    // `home_base.town` field. We compare waypoint labels against the
    // home town (case-insensitive, whitespace-trimmed) and prefer the
    // last visible waypoint whose label is NOT the home town.
    //
    // Fallback: if every visible waypoint IS the home town (one-way
    // home return, e.g. a relocation trip), use the last visible
    // waypoint as before.
    const homeTown = (homeBase?.town || '').trim().toLowerCase();
    const nonHomeVisible = homeTown
      ? visible.filter(
          (w) => (w.label || '').trim().toLowerCase() !== homeTown
        )
      : visible;
    const markerWp = nonHomeVisible.length > 0
      ? nonHomeVisible[nonHomeVisible.length - 1]
      : visible[visible.length - 1];
    // Shared lat/lon used by both providers — to five decimal places
    // (~1.1 m precision, more than enough for a single-pin embed).
    const markerLat = markerWp.lat.toFixed(5);
    const markerLon = markerWp.lon.toFixed(5);
    // Provider resolution: explicit prop > env var > 'osm' default.
    // The Google gate is "provider=google AND a key is set" — without
    // a key, we silently fall back to OSM so a missing key on a preview
    // deploy doesn't break the page.
    const envProvider = process.env.NEXT_PUBLIC_GMAPS_PROVIDER || '';
    const envKey = process.env.NEXT_PUBLIC_GMAPS_EMBED_KEY || '';
    const provider = resolveProvider(mapProvider, envProvider, Boolean(envKey));
    if (provider === 'google') {
      // Google Maps Embed API — `place` mode displays a single pin at
      // `q=lat,lng`. The key is inlined into the URL; the key is
      // referrer-restricted in Google Cloud Console so it can't be
      // lifted and abused. `maptype=roadmap` keeps the visual style
      // similar to OSM's default mapnik layer.
      const params = new URLSearchParams({
        key: envKey,
        q: `${markerLat},${markerLon}`,
        maptype: 'roadmap',
      });
      const viewLargeHref = `https://www.google.com/maps?q=${markerLat},${markerLon}&z=11`;
      return {
        provider: 'google',
        src: `https://www.google.com/maps/embed/v1/place?${params.toString()}`,
        markerLabel: markerWp.label,
        viewLargeHref,
      };
    }
    // OSM (default). Build a "View larger map" link to the public OSM
    // site at the same marker and a sensible zoom (zoom 11 ≈ city
    // scale for the bbox sizes we render). mlat/mlon order matches
    // the embed URL convention.
    const params = new URLSearchParams({ bbox, layer: 'mapnik', marker: `${markerLat},${markerLon}` });
    const viewLargeParams = new URLSearchParams({
      mlat: markerLat,
      mlon: markerLon,
    });
    const viewLargeHref = `https://www.openstreetmap.org/?${viewLargeParams.toString()}#map=11/${markerLat}/${markerLon}`;
    return {
      provider: 'osm',
      src: `https://www.openstreetmap.org/export/embed.html?${params.toString()}`,
      markerLabel: markerWp.label,
      viewLargeHref,
    };
  }, [geocoded, homeBase, mapProvider]);

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
        {embed.provider === 'google' ? (
          <>
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
              href={embed.viewLargeHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              View larger map
            </a>
          </>
        ) : (
          <>
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
          </>
        )}
      </p>
      <p className="trip-map-marker-note">
        <span className="trip-map-marker-dot" aria-hidden="true">📍</span>
        Pin: <strong>{embed.markerLabel}</strong>
        <span className="text-muted">
          {(() => {
            const homeTown = (homeBase?.town || '').trim();
            const isHome = homeTown && embed.markerLabel.trim() === homeTown;
            const baseNote = isHome
              ? ' (home)'
              : homeTown
                ? ' · pin on the last non-home waypoint'
                : '';
            const providerTag = embed.provider === 'google' ? ' · Google Maps Embed' : ' · OSM Embed';
            return baseNote + providerTag;
          })()}
        </span>
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