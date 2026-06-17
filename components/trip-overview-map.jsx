'use client';

/**
 * TripOverviewMap — one Google Maps JavaScript API map showing all trip legs.
 * Renders a single <div> that @googlemaps/js-api-loader populates with a
 * google.maps.Map instance. Each leg becomes a Polyline (coloured by mode)
 * and origin/destination Markers. The map auto-fits its bounds to show
 * all legs on load.
 *
 * FR-042 Revised (JS API): replaces the stacked iframe strip with one
 * interactive map. All legs visible at once — one map, polyline per leg,
 * coloured route lines, clickable markers. Privacy contract unchanged:
 * precision 'home' or 'exact' waypoints are excluded from the map.
 *
 * Falls back to a loading placeholder while the JS API initialises.
 * If fewer than 2 legs have mappable waypoints, returns null (no map).
 */

import { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

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
  const tasks = [];
  legs.forEach((leg, i) => {
    tasks.push({ leg, index: i });
  });

  const results = await Promise.all(
    tasks.map(async ({ leg, index }) => {
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

export function TripOverviewMap({ legs, homeBase, mapProvider = null }) {
  const mapDivRef = useRef(null);

  const [status, setStatus] = useState('idle'); // idle | loading | error
  const [legCoords, setLegCoords] = useState([]);

  const envProvider = process.env.NEXT_PUBLIC_GMAPS_PROVIDER || '';
  const envKey = process.env.NEXT_PUBLIC_GMAPS_EMBED_KEY || '';
  const provider = resolveProvider(mapProvider, envProvider, Boolean(envKey));

  // Only activate for Google provider.
  if (provider !== 'google') {
    return null;
  }

  // Phase 1: geocode all leg endpoints.
  useEffect(() => {
    if (!legs || legs.length === 0) {
      setStatus('error');
      return;
    }

    let cancelled = false;

    async function run() {
      const coords = await collectLegCoords(legs);
      if (!cancelled) {
        setLegCoords(coords);
        setStatus(coords.length < 2 ? 'error' : 'loading');
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [legs]);

  // Phase 2: initialise Google Maps JS API once div is mounted and we have coords.
  useEffect(() => {
    if (status !== 'loading' || !mapDivRef.current) return;

    let cancelled = false;

    async function initMap() {
      const loader = new Loader({
        apiKey: envKey,
        version: 'weekly',
        libraries: ['routes'],
      });

      const google = await loader.load();
      if (cancelled || !mapDivRef.current) return;

      // Mode → Google Maps API travel mode + stroke colour.
      // These are looked up from the google object AFTER the API loads,
      // not at module-parse time (which caused ReferenceError: google not defined).
      const MODE_STYLES = {
        driving:   { mode: google.maps.TravelMode.DRIVING,   color: '#4285F4', weight: 4 },
        walking:   { mode: google.maps.TravelMode.WALKING,   color: '#34A853', weight: 3 },
        bicycling: { mode: google.maps.TravelMode.BICYCLING, color: '#FBBC04', weight: 4 },
        transit:   { mode: google.maps.TravelMode.TRANSIT,   color: '#EA4335', weight: 3 },
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

      const bounds = new google.maps.LatLngBounds();
      const infoWindow = new google.maps.InfoWindow();

      const map = new google.maps.Map(mapDivRef.current, {
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        disableDefaultUI: false,
        zoomControl: true,
        fullscreenControl: true,
      });

      // Add a Polyline + markers for each leg.
      for (const { leg, origin, dest } of legCoords) {
        const { color, weight } = getModeStyle(leg.mode);

        // Polyline for the leg route.
        new google.maps.Polyline({
          path: [
            { lat: origin.lat, lng: origin.lon },
            { lat: dest.lat,   lng: dest.lon },
          ],
          strokeColor: color,
          strokeWeight: weight,
          strokeOpacity: 0.85,
          map,
        });

        // Origin marker (numbered circle, colour-coded).
        const originMarker = new google.maps.Marker({
          position: { lat: origin.lat, lng: origin.lon },
          map,
          label: {
            text: String(legCoords.findIndex(l => l.origin.lat === origin.lat && l.origin.lon === origin.lon) + 1),
            color: '#fff',
            fontWeight: 'bold',
            fontSize: '10px',
          },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
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

        // Destination marker (square).
        const destMarker = new google.maps.Marker({
          position: { lat: dest.lat, lng: dest.lon },
          map,
          label: {
            text: String(legCoords.findIndex(l => l.dest.lat === dest.lat && l.dest.lon === dest.lon) + 1),
            color: '#fff',
            fontWeight: 'bold',
            fontSize: '10px',
          },
          icon: {
            path: google.maps.SymbolPath.SQUARE,
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
      }
    }

    initMap();
    return () => {
      cancelled = true;
    };
  }, [status, legCoords, envKey]);

  if (status === 'idle' || status === 'error') {
    return null;
  }

  return (
    <div className="trip-overview-map" aria-label="Trip overview map — all legs">
      <div
        ref={mapDivRef}
        className="trip-overview-map-canvas"
        aria-label="Interactive trip map"
      />
      {status === 'loading' && (
        <p className="trip-overview-map-loading map-note">🗺️ Loading map…</p>
      )}
    </div>
  );
}
