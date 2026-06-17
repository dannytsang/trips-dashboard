'use client';

/**
 * TripOverviewMap — stacked strip of per-leg route iframes rendered
 * above the collapsible leg list on the trip detail page.
 *
 * B variant (FR-042 Revised): renders ONE directions iframe per leg,
 * stacked vertically, so all legs' routes are visible at once without
 * clicking. Google: directions iframe per leg (A→B route line, mode
 * from leg). OSM: destination pin with bbox (OSM has no directions embed).
 *
 * The strip is above the LegCollapsible list. Each iframe has
 * aspect-ratio: 4/3 and loading="lazy".
 *
 * Privacy contract (FR-027): waypoints with precision 'home' or 'exact'
 * are excluded from every iframe. A leg is skipped if either endpoint
 * is filtered. The geocode server also enforces this; we additionally
 * filter here as defence in depth.
 *
 * Provider (FR-028):
 *   provider=google:  Google Maps Embed `directions` mode (route line A→B)
 *   provider=osm:     OSM `/export/embed.html` (single pin, framed bbox)
 */

import { useEffect, useMemo, useState } from 'react';
import { buildViewport } from '@/lib/basemap-projection.mjs';

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
    m.includes('drive') || m.includes('car') || m.includes('taxi') ||
    m.includes('bus') || m.includes('ferry') || m.includes('cruise') ||
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

// Module-level geocode cache shared with LegRouteMap.
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
 * Build a single leg's iframe descriptor given its geocoded endpoints.
 * Returns null if the leg should be skipped.
 */
function buildLegEmbed(leg, origin, dest, provider, envKey) {
  if (!origin?.geocoded || !dest?.geocoded) return null;
  if (origin.precision === 'home' || origin.precision === 'exact') return null;
  if (dest.precision === 'home' || dest.precision === 'exact') return null;

  const originLat = origin.lat.toFixed(5);
  const originLon = origin.lon.toFixed(5);
  const destLat = dest.lat.toFixed(5);
  const destLon = dest.lon.toFixed(5);
  const mode = normaliseMode(leg.mode);

  if (provider === 'google') {
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
      caption: `${leg.origin.label || 'Origin'} → ${leg.destination.label || 'Destination'}`,
    };
  }

  // OSM: small bbox around origin+destination, single marker on destination.
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
    caption: `${leg.origin.label || 'Origin'} → ${leg.destination.label || 'Destination'}`,
  };
}

export function TripOverviewMap({ legs, homeBase, mapProvider = null }) {
  const [legEmbeds, setLegEmbeds] = useState([]);
  const [loading, setLoading] = useState(true);

  const envProvider = process.env.NEXT_PUBLIC_GMAPS_PROVIDER || '';
  const envKey = process.env.NEXT_PUBLIC_GMAPS_EMBED_KEY || '';
  const provider = resolveProvider(mapProvider, envProvider, Boolean(envKey));

  useEffect(() => {
    if (!legs || legs.length === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function run() {
      // Geocode all endpoints across all legs concurrently.
      const tasks = [];
      legs.forEach((leg, i) => {
        tasks.push({ leg, index: i });
      });

      const results = await Promise.all(
        tasks.map(async ({ leg, index }) => {
          if (!leg?.origin?.label || !leg?.destination?.label) return { index, embed: null };

          const [origin, dest] = await Promise.all([
            geocodeShared(leg.origin),
            geocodeShared(leg.destination),
          ]);

          const embed = buildLegEmbed(leg, origin, dest, provider, envKey);
          return { index, embed };
        })
      );

      if (!cancelled) {
        // Preserve leg order; embed is null for skipped legs.
        const sorted = results.sort((a, b) => a.index - b.index);
        setLegEmbeds(sorted.map(r => r.embed));
        setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [legs, provider, envKey]);

  if (loading) {
    return (
      <div className="trip-overview-map trip-overview-map-loading" aria-label="Loading trip overview map">
        <p className="map-note">🗺️ Loading overview map…</p>
      </div>
    );
  }

  // No legs rendered at all — hide the container entirely.
  if (legEmbeds.length === 0) {
    return null;
  }

  return (
    <div className="trip-overview-map" aria-label="Trip overview — all legs">
      {legEmbeds.map((embed, i) => {
        if (!embed) return null;
        return (
          <div key={i} className="trip-overview-map-item">
            <iframe
              className="trip-overview-map-iframe"
              title={`Leg ${i + 1}: ${embed.caption}`}
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
      })}
    </div>
  );
}
