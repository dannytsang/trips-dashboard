/**
 * Basemap projection helpers for the trip map.
 *
 * As of the OSM embed migration (spec 010 FR-009), TripMap no longer
 * renders a self-drawn SVG basemap — it embeds an OpenStreetMap iframe
 * whose `bbox` and `marker` query parameters are computed in-browser.
 *
 * This module now exports **only** `buildViewport`, which converts a
 * list of geocoded (lon, lat) points into a bounding box suitable for
 * the OSM embed endpoint. We deliberately keep this as a pure function
 * (no third-party deps, no I/O) so it stays trivially testable and
 * works on both server and client.
 *
 * The historical SVG basemap helpers (`projectBasemap`, `projectPlaces`,
 * `projectPoint`, `clipRing`, `ringToPath`) have been removed because
 * the OSM iframe replaces them entirely — the user reported that the
 * simplified Natural Earth SVG looked like a data issue (markers
 * spanning India to UK at city-scale zooms).
 */

/**
 * Build a viewport {minLon, maxLon, minLat, maxLat} from a list of
 * geocoded waypoints, with a generous padding so the route doesn't sit
 * at the edge. Clamps to global bounds and ensures a minimum span so
 * very close-together waypoints still produce a sensible map.
 *
 * The returned object is in OSM bbox order (minLon, minLat, maxLon,
 * maxLat) when serialised with template literals. The original `w` and
 * `h` fields are retained for callers that still need them.
 *
 * @param {{lon: number, lat: number}[]} points
 * @param {{width: number, height: number, padding?: number, minSpan?: number}} opts
 * @returns {{minLon: number, maxLon: number, minLat: number, maxLat: number, w: number, h: number}}
 */
export function buildViewport(points, opts) {
  const { width, height, padding = 0.18, minSpan = 0.4 } = opts;
  if (points.length === 0) {
    return { minLon: -10, maxLon: 10, minLat: 45, maxLat: 60, w: width, h: height };
  }
  const lons = points.map((p) => p.lon);
  const lats = points.map((p) => p.lat);
  let minLon = Math.min(...lons);
  let maxLon = Math.max(...lons);
  let minLat = Math.min(...lats);
  let maxLat = Math.max(...lats);
  // Compute natural spans with a small floor, then pad symmetrically.
  // The minSpan default is slightly smaller than the SVG version because
  // OSM embed zoom levels are coarser — 0.4° (~40 km) gives a more
  // sensible "city + surrounds" framing than the SVG's 0.5°.
  const lonSpan = Math.max(maxLon - minLon, 1e-6);
  const latSpan = Math.max(maxLat - minLat, 1e-6);
  const lonPad = Math.max(lonSpan * padding, minSpan / 2);
  const latPad = Math.max(latSpan * padding, minSpan / 2);
  minLon = minLon - lonPad;
  maxLon = maxLon + lonPad;
  minLat = minLat - latPad;
  maxLat = maxLat + latPad;
  // Re-balance so lat/lon aspect ratio matches the embed aspect ratio
  // (otherwise countries get visibly squished near the poles).
  const viewAspect = width / height;
  const lonLatMid = (minLon + maxLon) / 2;
  const latLatMid = (minLat + maxLat) / 2;
  const currentSpan = (maxLon - minLon) / (maxLat - minLat || 1e-6);
  if (currentSpan > viewAspect) {
    const halfSpan = (maxLat - minLat) / 2;
    const targetHalfSpan = ((maxLon - minLon) / viewAspect) / 2;
    const delta = targetHalfSpan - halfSpan;
    minLat = latLatMid - halfSpan - delta;
    maxLat = latLatMid + halfSpan + delta;
  } else {
    const halfSpan = (maxLon - minLon) / 2;
    const targetHalfSpan = ((maxLat - minLat) * viewAspect) / 2;
    const delta = targetHalfSpan - halfSpan;
    minLon = lonLatMid - halfSpan - delta;
    maxLon = lonLatMid + halfSpan + delta;
  }
  // Clamp to safe global bounds (lat flatten limit at ±85°, lon at ±180°)
  minLon = Math.max(-180, minLon);
  maxLon = Math.min(180, maxLon);
  minLat = Math.max(-85, minLat);
  maxLat = Math.min(85, maxLat);
  return { minLon, maxLon, minLat, maxLat, w: width, h: height };
}
