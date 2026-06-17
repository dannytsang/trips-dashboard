'use client';

import { useEffect, useMemo, useState } from 'react';
import { buildViewport } from '@/lib/basemap-projection.mjs';

/**
 * LegRouteMap — per-leg inline map rendered inside a leg row in the
 * trip detail page. One small iframe per leg, below the leg detail
 * block. The provider switch from FR-028 controls the URL shape:
 *
 *   provider=google:  Google Maps Embed `directions` mode (route line A→B)
 *   provider=osm:     OpenStreetMap `/export/embed.html` (single pin at
 *                     the leg's destination, framed by a small bbox
 *                     around origin + destination — OSM has no directions
 *                     embed endpoint, so the OSM iframe is a destination
 *                     pin, not a route line)
 *
 * Behaviour (spec 010 FR-036..037):
 *   - Re-uses the existing `/api/geocode` pipeline (deduped by
 *     `geocodeLabel || label`). The geocode route is Next.js-cached
 *     for 1 hour per unique label, so multiple `LegRouteMap`
 *     instances on the same page do not hammer Nominatim.
 *   - The privacy contract (FR-027) is enforced: a leg is rendered
 *     only if BOTH endpoints have a precision other than 'home' or
 *     'exact'. The geocode server also enforces this; we
 *     additionally filter here as defence in depth.
 *   - The component returns `null` when the leg is filtered out by
 *     the privacy contract — the leg row's plain-text rendering
 *     still shows the leg in context.
 *   - Falls back to a text-only label "🗺️ Map not available for this
 *     leg" if either endpoint fails to geocode (network error,
 *     Nominatim not found). The leg row still shows the leg.
 *   - No CLS shift: each iframe has a fixed `aspect-ratio: 4/3` via
 *     the `.leg-route-map-iframe` CSS class, and `loading="lazy"`.
 *
 * Provider resolution (FR-028):
 *   The strip is provider-gated: the resolver returns 'google' only
 *   when `NEXT_PUBLIC_GMAPS_PROVIDER=google` AND a key is set. With
 *   OSM (the default), the iframe uses the OSM embed URL shape.
 *
 * The OSM per-leg iframe is intentionally NOT a route line — OSM's
 * `/export/embed.html` has no directions mode. The visual is
 * consistent (one small iframe per leg, in the same position) but
 * the per-leg content differs by provider. To get a route line on
 * OSM, the dashboard would need a different approach (e.g. draw a
 * polyline over an OSM raster tile) — out of scope for FR-036.
 */

function resolveProvider(propProvider, envProvider, hasKey) {
  const requested = (propProvider || envProvider || 'osm').toLowerCase();
  if (requested === 'google' && hasKey) return 'google';
  return 'osm';
}

function normaliseMode(rawMode) {
  const m = String(rawMode || '').toLowerCase();
  if (m.includes('walk')) return 'walking';
  if (m.includes('bike') || m.includes('cycl')) return 'bicycling';
  if (m.includes('transit') || m.includes('rail') || m.includes('train')) return 'transit';
  if (
    m.includes('drive') ||
    m.includes('car') ||
    m.includes('taxi') ||
    m.includes('bus') ||
    m.includes('ferry') ||
    m.includes('cruise') ||
    m.includes('flight')
  ) {
    return 'driving';
  }
  return 'driving';
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

// Module-level geocode cache. Multiple LegRouteMap instances on the
// same page call geocodeShared() with the same waypoint (e.g.
// "Premier Inn Petersfield Hampshire" appears in 3 of 3 Petersfield
// legs); the cache collapses those calls to a single network request
// and shares the resolved coordinates across all consumers. The
// cache lives for the lifetime of the JS bundle, so navigating
// between trip pages reuses geocoded waypoints without re-hitting
// Nominatim. Next.js's own /api/geocode route has its own 1-hour
// fetch cache, so this is a second layer of dedup, not a replacement.
//
// The cache holds promises (not resolved values) so concurrent
// callers for the same key await the same in-flight request.
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

export function LegRouteMap({ leg, mapProvider = null }) {
  const [origin, setOrigin] = useState(null);
  const [dest, setDest] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!leg?.origin?.label || !leg?.destination?.label) {
        if (!cancelled) {
          setOrigin(null);
          setDest(null);
          setLoading(false);
        }
        return;
      }
      const [o, d] = await Promise.all([
        geocodeShared(leg.origin),
        geocodeShared(leg.destination),
      ]);
      if (!cancelled) {
        setOrigin(o);
        setDest(d);
        setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [leg]);

  // Privacy contract (FR-027 reuse). If either endpoint is excluded
  // by precision, or either endpoint failed to geocode, the iframe
  // is omitted entirely. The leg row's plain-text rendering still
  // shows the leg in context — the map is additive.
  const filtered =
    !leg?.origin?.label ||
    !leg?.destination?.label ||
    !origin?.geocoded ||
    !dest?.geocoded ||
    origin.precision === 'home' ||
    origin.precision === 'exact' ||
    dest.precision === 'home' ||
    dest.precision === 'exact';

  const envProvider = process.env.NEXT_PUBLIC_GMAPS_PROVIDER || '';
  const envKey = process.env.NEXT_PUBLIC_GMAPS_EMBED_KEY || '';
  const provider = resolveProvider(mapProvider, envProvider, Boolean(envKey));

  // Compute the iframe URL once we have both endpoints geocoded.
  // For Google: use `directions` mode with origin/destination coords
  // + leg's mode. For OSM: use a small bbox around origin+destination
  // with a marker on the destination.
  const embed = useMemo(() => {
    if (filtered || loading) return null;
    const originLat = origin.lat.toFixed(5);
    const originLon = origin.lon.toFixed(5);
    const destLat = dest.lat.toFixed(5);
    const destLon = dest.lon.toFixed(5);

    if (provider === 'google') {
      const mode = normaliseMode(leg.mode);
      const params = new URLSearchParams({
        key: envKey,
        origin: `${originLat},${originLon}`,
        destination: `${destLat},${destLon}`,
        mode,
      });
      return {
        provider: 'google',
        src: `https://www.google.com/maps/embed/v1/directions?${params.toString()}`,
        viewLargeHref: `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLon}&destination=${destLat},${destLon}&travelmode=${mode}`,
      };
    }

    // OSM: small bbox around origin+destination (1.5x padding so both
    // points are visible), single marker on the destination. The OSM
    // embed has no directions mode, so this is a destination pin, not
    // a route line. Spec FR-036 acknowledges this.
    const viewport = buildViewport(
      [
        { lat: origin.lat, lon: origin.lon },
        { lat: dest.lat, lon: dest.lon },
      ],
      { width: 400, height: 300, padding: 0.35, minSpan: 0.05 }
    );
    const { minLon, minLat, maxLon, maxLat } = viewport;
    const bbox = `${minLon.toFixed(5)},${minLat.toFixed(5)},${maxLon.toFixed(5)},${maxLat.toFixed(5)}`;
    const params = new URLSearchParams({
      bbox,
      layer: 'mapnik',
      marker: `${destLat},${destLon}`,
    });
    return {
      provider: 'osm',
      src: `https://www.openstreetmap.org/export/embed.html?${params.toString()}`,
      viewLargeHref: `https://www.openstreetmap.org/?mlat=${destLat}&mlon=${destLon}#map=12/${destLat}/${destLon}`,
    };
  }, [filtered, loading, origin, dest, provider, envKey, leg]);

  if (loading) {
    return (
      <p className="leg-route-map-loading map-note">🗺️ Loading map…</p>
    );
  }

  if (filtered) {
    // Privacy filter or geocode failure — the leg row's plain text
    // still shows the leg in context. The map is additive.
    return null;
  }

  if (!embed) return null;

  return (
    <div className="leg-route-map" aria-label={`Map for leg: ${leg.origin.label} → ${leg.destination.label}`}>
      <iframe
        className="leg-route-map-iframe"
        title={`Map: ${leg.origin.label} → ${leg.destination.label}`}
        src={embed.src}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
      <p className="leg-route-map-attribution">
        {embed.provider === 'google' ? (
          <>
            Map data ©{' '}
            <a href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer">
              Google
            </a>
            {' · '}
            <a href={embed.viewLargeHref} target="_blank" rel="noopener noreferrer">
              View larger map
            </a>
          </>
        ) : (
          <>
            ©{' '}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
              OpenStreetMap
            </a>{' '}
            contributors ·{' '}
            <a href={embed.viewLargeHref} target="_blank" rel="noopener noreferrer">
              View larger map
            </a>
          </>
        )}
      </p>
    </div>
  );
}
