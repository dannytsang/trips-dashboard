'use client';

/**
 * TripOverviewMap — one Google Maps JavaScript API map showing all trip legs.
 * Uses @googlemaps/js-api-loader v2: setOptions() + importLibrary().
 * After importLibrary('maps') resolves, google.maps is available as a
 * global; we use it directly rather than relying on destructured exports.
 *
 * FR-042 Revised (JS API): one interactive map, all legs as coloured
 * Polylines + markers. Privacy contract unchanged (precision home/exact
 * excluded). Hydration-safe: phase='idle' renders null on first render.
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
    legs.map(async (leg) => {
      if (!leg?.origin?.label || !leg?.destination?.label) {
        return null;
      }
      const [origin, dest] = await Promise.all([
        geocodeShared(leg.origin),
        geocodeShared(leg.destination),
      ]);
      return { leg, origin, dest };
    })
  );

  return results
    .filter(r => r && r.origin?.geocoded && r.dest?.geocoded)
    .filter(r => r.origin.precision !== 'home' && r.origin.precision !== 'exact')
    .filter(r => r.dest.precision !== 'home' && r.dest.precision !== 'exact');
}

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
  // 'idle' renders null on server and client first render → hydration-safe.
  const [phase, setPhase] = useState('idle');
  const [legCoords, setLegCoords] = useState([]);
  const envKey = process.env.NEXT_PUBLIC_GMAPS_EMBED_KEY || '';

  // Phase 1: resolve provider and geocode (client-only).
  useEffect(() => {
    if (!legs || legs.length === 0) {
      setPhase('error');
      return;
    }

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
      setPhase('loading');
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [legs, mapProvider, envKey]);

  // Phase 2: init Google Maps once div is in DOM.
  useEffect(() => {
    if (phase !== 'loading' || !mapDivRef.current) return;

    let cancelled = false;

    async function initMap() {
      // Configure the loader with the API key.
      setOptions({ key: envKey, v: 'weekly' });

      // After this resolves, google.maps is available as a global.
      await importLibrary('maps');

      if (cancelled || !mapDivRef.current) return;

      const google = window.google;
      if (!google || !google.maps) {
        console.error('TripOverviewMap: google.maps not available after importLibrary');
        setPhase('error');
        return;
      }

      const { Map, Polyline, LatLngBounds, Marker, InfoWindow, SymbolPath, MapTypeId } = google.maps;

      const bounds = new LatLngBounds();
      const infoWindow = new InfoWindow();

      const map = new Map(mapDivRef.current, {
        mapTypeId: MapTypeId.ROADMAP,
        disableDefaultUI: false,
        zoomControl: true,
        fullscreenControl: true,
      });

      for (let i = 0; i < legCoords.length; i++) {
        const { leg, origin, dest } = legCoords[i];
        const { color, weight } = getModeColor(leg.mode);
        const legNum = i + 1;

        // Polyline: straight-line route segment, colour-coded by mode.
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

        // Circle marker at origin.
        const originMarker = new Marker({
          position: { lat: origin.lat, lng: origin.lon },
          map,
          label: { text: String(legNum), color: '#fff', fontWeight: 'bold', fontSize: '10px' },
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

        // Square marker at destination.
        const destMarker = new Marker({
          position: { lat: dest.lat, lng: dest.lon },
          map,
          label: { text: String(legNum), color: '#fff', fontWeight: 'bold', fontSize: '10px' },
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
        setPhase('map');
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
