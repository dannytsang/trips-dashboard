'use client';

/**
 * TripOverviewMap — one Google Maps JavaScript API map showing all trip legs.
 * Renders a single <div> that the @googlemaps/js-api-loader v2 functional API
 * populates with a google.maps.Map instance. Each leg becomes a Polyline
 * (coloured by mode) and origin/destination Markers. The map auto-fits its
 * bounds to show all legs on load.
 *
 * FR-042 Revised (JS API): replaces the stacked iframe strip with one
 * interactive map. All legs visible at once — one map, polyline per leg,
 * coloured route lines, clickable markers. Privacy contract unchanged:
 * precision 'home' or 'exact' waypoints are excluded from the map.
 *
 * Hydration safety: provider check is deferred to useEffect (client-only)
 * so the server-rendered HTML matches the initial client render. Both render
 * null on first render; the client re-renders with the real provider after
 * the effect runs.
 */

import { useEffect, useRef, useState } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

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

async function collectLegCoords(legs) {
  const results = await Promise.all(
    legs.map(async (leg, index) => {
      if (!leg?.origin?.label || !leg?.destination?.label) {
        return { index, origin: null, dest: null };
      }
      const [origin, dest] = await Promise.all([
        geocodeShared(leg.origin),
        geocodeShared(leg.destination),
      ]);
      return { index, origin, dest };
    })
  );

  return results
    .filter(r => r.origin?.geocoded && r.dest?.geocoded)
    .filter(r => r.origin.precision !== 'home' && r.origin.precision !== 'exact')
    .filter(r => r.dest.precision !== 'home' && r.dest.precision !== 'exact')
    .sort((a, b) => a.index - b.index);
}

// Mode → stroke colour. TravelMode constants are resolved at runtime after API loads.
const MODE_COLORS = {
  driving:   { color: '#4285F4', weight: 4 },
  walking:   { color: '#34A853', weight: 3 },
  bicycling: { color: '#FBBC04', weight: 4 },
  transit:   { color: '#EA4335', weight: 3 },
};

function getModeColor(rawMode) {
  const m = String(rawMode || '').toLowerCase();
  if (m.includes('walk'))   return MODE_COLORS.walking;
  if (m.includes('bike'))   return MODE_COLORS.bicycling;
  if (m.includes('transit') || m.includes('rail') || m.includes('train')) return MODE_COLORS.transit;
  if (m.includes('drive') || m.includes('car') || m.includes('taxi') ||
      m.includes('bus') || m.includes('ferry') || m.includes('cruise') || m.includes('flight')) {
    return MODE_COLORS.driving;
  }
  return MODE_COLORS.driving;
}

export function TripOverviewMap({ legs, homeBase, mapProvider = null }) {
  const mapDivRef = useRef(null);

  // phase: 'idle' | 'loading' | 'map' | 'error'
  // 'idle' renders null on both server and client (hydration-safe).
  // Provider check is deferred to useEffect so first render is identical.
  const [phase, setPhase] = useState('idle');
  const [legCoords, setLegCoords] = useState([]);
  const envKey = process.env.NEXT_PUBLIC_GMAPS_EMBED_KEY || '';

  useEffect(() => {
    if (!legs || legs.length === 0) {
      setPhase('error');
      return;
    }

    // Resolve provider in the effect (client-only) to avoid hydration mismatch.
    const requested = (mapProvider || process.env.NEXT_PUBLIC_GMAPS_PROVIDER || 'osm').toLowerCase();
    const provider = (requested === 'google' && Boolean(envKey)) ? 'google' : 'osm';

    if (provider !== 'google') {
      setPhase('error');
      return;
    }

    let cancelled = false;

    async function run() {
      const coords = await collectLegCoords(legs);
      if (cancelled) return;

      if (coords.length < 2) {
        setPhase('error');
        return;
      }

      setLegCoords(coords);
      setPhase('loading'); // triggers re-render → map div is now in the DOM
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [legs, mapProvider, envKey]);

  // Phase 2: initialise Google Maps JS API once the map div is in the DOM.
  useEffect(() => {
    if (phase !== 'loading' || !mapDivRef.current) return;

    let cancelled = false;

    async function initMap() {
      setOptions({
        key: envKey,
        v: 'weekly',
        libraries: ['routes'],
      });

      const maps = await importLibrary('maps');
      if (cancelled || !mapDivRef.current) return;

      const { Map, Polyline, LatLngBounds, Marker, InfoWindow, SymbolPath, TravelMode, MapTypeId } = maps;

      const MODE_STYLES = {
        driving:   { mode: TravelMode.DRIVING,   color: '#4285F4', weight: 4 },
        walking:   { mode: TravelMode.WALKING,   color: '#34A853', weight: 3 },
        bicycling: { mode: TravelMode.BICYCLING, color: '#FBBC04', weight: 4 },
        transit:   { mode: TravelMode.TRANSIT,   color: '#EA4335', weight: 3 },
      };

      function getModeStyle(rawMode) {
        const m = String(rawMode || '').toLowerCase();
        if (m.includes('walk'))   return MODE_STYLES.walking;
        if (m.includes('bike'))    return MODE_STYLES.bicycling;
        if (m.includes('transit') || m.includes('rail') || m.includes('train')) return MODE_STYLES.transit;
        if (m.includes('drive') || m.includes('car') || m.includes('taxi') ||
            m.includes('bus') || m.includes('ferry') || m.includes('cruise') || m.includes('flight')) {
          return MODE_STYLES.driving;
        }
        return MODE_STYLES.driving;
      }

      const bounds = new LatLngBounds();
      const infoWindow = new InfoWindow();

      const map = new Map(mapDivRef.current, {
        mapTypeId: MapTypeId.ROADMAP,
        disableDefaultUI: false,
        zoomControl: true,
        fullscreenControl: true,
      });

      for (const { leg, origin, dest } of legCoords) {
        const { color, weight } = getModeStyle(leg.mode);

        new Polyline({
          path: [
            { lat: origin.lat, lng: origin.lon },
            { lat: dest.lat,   lng: dest.lon },
          ],
          strokeColor: color,
          strokeWeight: weight,
          strokeOpacity: 0.85,
          map,
        });

        const legIdx = (n) => String(legCoords.findIndex(l =>
          (l.origin.lat === n.origin.lat && l.origin.lon === n.origin.lon) ||
          (l.dest.lat === n.dest.lat && l.dest.lon === n.dest.lon)
        ) + 1);

        const originMarker = new Marker({
          position: { lat: origin.lat, lng: origin.lon },
          map,
          label: {
            text: legIdx({ origin, dest }),
            color: '#fff',
            fontWeight: 'bold',
            fontSize: '10px',
          },
          icon: {
            path: SymbolPath.CIRCLE,
            scale: 10,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
          },
          title: leg.origin.label,
        });

        originMarker.addListener('click', () => {
          infoWindow.setContent(`<strong>${leg.origin.label}</strong>`);
          infoWindow.open(map, originMarker);
        });

        const destMarker = new Marker({
          position: { lat: dest.lat, lng: dest.lon },
          map,
          label: {
            text: legIdx({ origin, dest }),
            color: '#fff',
            fontWeight: 'bold',
            fontSize: '10px',
          },
          icon: {
            path: SymbolPath.SQUARE,
            scale: 8,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
          },
          title: leg.destination.label,
        });

        destMarker.addListener('click', () => {
          infoWindow.setContent(`<strong>${leg.destination.label}</strong>`);
          infoWindow.open(map, destMarker);
        });

        bounds.extend(originMarker.position);
        bounds.extend(destMarker.position);
      }

      if (!cancelled) {
        map.fitBounds(bounds, { padding: 40 });
        setPhase('map'); // re-render to remove loading text
      }
    }

    initMap();
    return () => {
      cancelled = true;
    };
  }, [phase, legCoords, envKey]);

  if (phase === 'idle' || phase === 'error') {
    return null;
  }

  return (
    <div className="trip-overview-map" aria-label="Trip overview map — all legs">
      <div
        ref={mapDivRef}
        className="trip-overview-map-canvas"
        aria-label="Interactive trip map"
      />
      {phase === 'loading' && (
        <p className="trip-overview-map-loading map-note">🗺️ Loading map…</p>
      )}
    </div>
  );
}
