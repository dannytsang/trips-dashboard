'use client';

/**
 * TripOverviewMap — one Google Maps JavaScript API map showing all trip legs.
 * Uses @googlemaps/js-api-loader v2: setOptions() + importLibrary().
 *
 * FR-042 Revised (route geometry): one interactive map, all legs as routed paths +
 * AdvancedMarkerElement markers. Privacy contract unchanged
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

function getTravelMode(rawMode) {
  const m = String(rawMode || '').toLowerCase();
  if (m.includes('walk')) return 'WALKING';
  if (m.includes('bike')) return 'BICYCLING';
  if (m.includes('transit') || m.includes('rail') || m.includes('train') || m.includes('bus')) return 'TRANSIT';
  return 'DRIVING';
}

function getRouteProfile(rawMode) {
  const m = String(rawMode || '').toLowerCase();
  if (m.includes('walk')) return 'walking';
  if (m.includes('bike')) return 'cycling';
  return 'driving';
}

// Module-level route cache shared by the main map so repeated renders
// of the same leg do not spam the public router endpoint.
const routeCache = new Map();

function getPointLon(point) {
  return point?.lon ?? point?.lng;
}

function routeCacheKey(origin, dest, rawMode) {
  const originLon = getPointLon(origin);
  const destLon = getPointLon(dest);
  return [
    getRouteProfile(rawMode),
    origin.lat.toFixed(5),
    originLon.toFixed(5),
    dest.lat.toFixed(5),
    destLon.toFixed(5),
  ].join('::');
}

async function fetchRoutePath(origin, dest, rawMode) {
  const profile = getRouteProfile(rawMode);
  const originLon = getPointLon(origin);
  const destLon = getPointLon(dest);
  const url = new URL(`https://router.project-osrm.org/route/v1/${profile}/${originLon},${origin.lat};${destLon},${dest.lat}`);
  url.searchParams.set('overview', 'full');
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('steps', 'false');

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`OSRM_${response.status}`);
  }
  const data = await response.json();
  const coords = data?.routes?.[0]?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) {
    throw new Error('OSRM_NO_ROUTE');
  }
  return coords.map(([lon, lat]) => ({ lat, lng: lon }));
}

function routeShared(origin, dest, rawMode) {
  const key = routeCacheKey(origin, dest, rawMode);
  if (routeCache.has(key)) {
    return routeCache.get(key);
  }

  const promise = fetchRoutePath(origin, dest, rawMode).catch(async (err) => {
    console.warn('TripOverviewMap: OSRM routing failed, falling back to Google directions', err);
    try {
      const google = window.google;
      if (!google?.maps?.DirectionsService) {
        throw err;
      }
      const directionsService = new google.maps.DirectionsService();
      const directions = await routeDirections(directionsService, {
        origin,
        destination: dest,
        travelMode: getTravelMode(rawMode),
        provideRouteAlternatives: false,
      });
      const path = directions.routes?.[0]?.overview_path;
      if (!Array.isArray(path) || path.length < 2) {
        throw new Error('GOOGLE_NO_ROUTE');
      }
      return path.map((point) => ({ lat: point.lat(), lng: point.lng() }));
    } catch (fallbackErr) {
      console.warn('TripOverviewMap: Google directions fallback failed', fallbackErr);
      return null;
    }
  });

  const cachedPromise = promise.then((result) => {
    if (!result) {
      routeCache.delete(key);
    }
    return result;
  });

  routeCache.set(key, cachedPromise);
  return cachedPromise;
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

function routeDirections(directionsService, request) {
  return new Promise((resolve, reject) => {
    directionsService.route(request, (result, status) => {
      if (status === 'OK' && result) {
        resolve(result);
      } else {
        reject(new Error(status || 'DIRECTIONS_ERROR'));
      }
    });
  });
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

      // Load maps library (Map, LatLngBounds, InfoWindow, Polyline).
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
        const originPoint = { lat: origin.lat, lng: origin.lon };
        const destPoint = { lat: dest.lat, lng: dest.lon };

        // Origin marker — circle div.
        const originMarker = new AdvancedMarkerElement({
          position: originPoint,
          map,
          content: makeCircleHTMLElement(color, String(legNum)),
          title: leg.origin.label,
        });

        originMarker.addEventListener('gmp-click', () => {
          infoWindow.setContent(leg.origin.label);
          infoWindow.open(map, { anchor: originMarker });
        });

        // Destination marker — square div.
        const destMarker = new AdvancedMarkerElement({
          position: destPoint,
          map,
          content: makeSquareHTMLElement(color, String(legNum)),
          title: leg.destination.label,
        });

        destMarker.addEventListener('gmp-click', () => {
          infoWindow.setContent(leg.destination.label);
          infoWindow.open(map, { anchor: destMarker });
        });

        bounds.extend(originMarker.position);
        bounds.extend(destMarker.position);

        const routePath = await routeShared(originPoint, destPoint, leg.mode);
        if (routePath && routePath.length >= 2) {
          const routeBounds = new LatLngBounds();
          routePath.forEach((point) => routeBounds.extend(point));
          bounds.union(routeBounds);
          new Polyline({
            path: routePath,
            strokeColor: color,
            strokeWeight: 4,
            strokeOpacity: 0.85,
            geodesic: false,
            map,
          });
        } else {
          console.warn('TripOverviewMap: no routed path available, falling back to straight segment');
          new Polyline({
            path: [originPoint, destPoint],
            strokeColor: color,
            strokeWeight: 4,
            strokeOpacity: 0.85,
            geodesic: false,
            map,
          });
        }
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
