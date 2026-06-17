'use client';

/**
 * TripOverviewMap — one Google Maps JavaScript API map showing all trip legs.
 * Uses @googlemaps/js-api-loader v2: setOptions() + importLibrary().
 *
 * FR-042 Revised (JS API): one interactive map, all legs as coloured
 * Polylines + AdvancedMarkerElement markers. Privacy contract unchanged
 * (precision home/exact excluded).
 *
 * Hydration safety: 'mounted' state is initialised to false. Server renders
 * null (matches first client render). After mount, effects run and setPhase
 * to 'loading' then 'map' — content appears only after client effects,
 * so no hydration path is shared and React error #418 is eliminated.
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
  driving:   '#4285F4',
  walking:   '#34A853',
  bicycling: '#FBBC04',
  transit:   '#EA4335',
};

function getModeColor(rawMode) {
  const m = String(rawMode || '').toLowerCase();
  if (m.includes('walk'))  return MODE_COLORS.walking;
  if (m.includes('bike'))  return MODE_COLORS.bicycling;
  if (m.includes('transit') || m.includes('rail') || m.includes('train')) return MODE_COLORS.transit;
  if (m.includes('drive') || m.includes('car') || m.includes('taxi') ||
      m.includes('bus') || m.includes('ferry') || m.includes('cruise') || m.includes('flight')) {
    return MODE_COLORS.driving;
  }
  return MODE_COLORS.driving;
}

// Build a coloured circle HTML div for AdvancedMarkerElement (origin marker).
function makeCircleHTMLElement(color, text) {
  const el = document.createElement('div');
  el.style.cssText = [
    'width:28px', 'height:28px', 'border-radius:50%',
    `background:${color}`, 'border:2px solid #fff',
    'display:flex', 'align-items:center', 'justify-content:center',
    'color:#fff', 'font-size:10px', 'font-weight:bold',
    'font-family:Roboto,Arial,sans-serif',
    'box-shadow:0 1px 4px rgba(0,0,0,0.3)', 'cursor:pointer',
  ].join(';');
  el.textContent = text;
  return el;
}

// Build a coloured square HTML div for AdvancedMarkerElement (destination marker).
function makeSquareHTMLElement(color, text) {
  const el = document.createElement('div');
  el.style.cssText = [
    'width:22px', 'height:22px', 'border-radius:3px',
    `background:${color}`, 'border:2px solid #fff',
    'display:flex', 'align-items:center', 'justify-content:center',
    'color:#fff', 'font-size:10px', 'font-weight:bold',
    'font-family:Roboto,Arial,sans-serif',
    'box-shadow:0 1px 4px rgba(0,0,0,0.3)', 'cursor:pointer',
  ].join(';');
  el.textContent = text;
  return el;
}

export function TripOverviewMap({ legs, homeBase, mapProvider = null }) {
  const mapDivRef = useRef(null);

  // mounted: true only after the first client-side effect runs.
  // Server renders null; initial client render is also null (mounted=false).
  // Only after effects does content appear — no hydration path shared.
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState('idle'); // idle | loading | map
  const [legCoords, setLegCoords] = useState([]);
  const envKey = process.env.NEXT_PUBLIC_GMAPS_EMBED_KEY || '';

  // Phase 1: set mounted=true and geocode (client-only).
  useEffect(() => {
    setMounted(true);

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
      setOptions({ key: envKey, v: 'weekly' });

      // Load maps library (includes Map, Polyline, LatLngBounds, InfoWindow).
      await importLibrary('maps');

      // Load marker library — this populates google.maps.marker namespace.
      // Access AdvancedMarkerElement via window.google.maps.marker after load.
      try {
        await importLibrary('marker');
      } catch (err) {
        console.error('TripOverviewMap: failed to load marker library', err);
        if (!cancelled) setPhase('error');
        return;
      }

      if (cancelled || !mapDivRef.current) return;

      const google = window.google;
      if (!google?.maps?.marker?.AdvancedMarkerElement) {
        console.error('TripOverviewMap: AdvancedMarkerElement not available');
        if (!cancelled) setPhase('error');
        return;
      }

      const { Map, Polyline, LatLngBounds, InfoWindow, MapTypeId } = google.maps;
      const { AdvancedMarkerElement } = google.maps.marker;

      const bounds = new LatLngBounds();
      const infoWindow = new InfoWindow();

      const mapId = process.env.NEXT_PUBLIC_GMAPS_MAP_ID;

      const map = new Map(mapDivRef.current, {
        mapTypeId: MapTypeId.ROADMAP,
        mapId, // required for AdvancedMarkerElement; free Map ID from Google Cloud Console
        disableDefaultUI: false,
        zoomControl: true,
        fullscreenControl: true,
      });

      for (let i = 0; i < legCoords.length; i++) {
        const { leg, origin, dest } = legCoords[i];
        const color = getModeColor(leg.mode);
        const legNum = i + 1;

        // Polyline: straight-line segment, colour-coded by mode.
        new Polyline({
          path: [
            { lat: origin.lat, lng: origin.lon },
            { lat: dest.lat,   lng: dest.lon },
          ],
          strokeColor: color,
          strokeWeight: 4,
          strokeOpacity: 0.85,
          map,
        });

        // Origin marker — circle div.
        const originMarker = new AdvancedMarkerElement({
          position: { lat: origin.lat, lng: origin.lon },
          map,
          content: makeCircleHTMLElement(color, String(legNum)),
          title: leg.origin.label,
        });

        originMarker.addListener('click', () => {
          infoWindow.setContent(leg.origin.label);
          infoWindow.open(map, { anchor: originMarker });
        });

        // Destination marker — square div.
        const destMarker = new AdvancedMarkerElement({
          position: { lat: dest.lat, lng: dest.lon },
          map,
          content: makeSquareHTMLElement(color, String(legNum)),
          title: leg.destination.label,
        });

        destMarker.addListener('click', () => {
          infoWindow.setContent(leg.destination.label);
          infoWindow.open(map, { anchor: destMarker });
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

  // Never render anything on the server (phase=idle, null output).
  // On the client first render, mounted=false so this also returns null.
  // Real content appears only after the client effects have run.
  if (!mounted || phase === 'idle' || phase === 'error') {
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
