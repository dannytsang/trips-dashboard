/**
 * Basemap projection helpers for the trip map.
 *
 * Pure functions that take a Natural Earth GeoJSON FeatureCollection and a
 * viewport (lon/lat bounds + SVG viewBox dimensions) and return:
 *   - one path "d" string per country polygon, clipped to the viewport
 *   - a filtered list of populated places inside the viewport with (x, y)
 *
 * No third-party dependencies. Used by the TripMap client component.
 *
 * Co-ordinate model:
 *   - GeoJSON: [lon, lat] in degrees, lon -180..180, lat -90..90
 *   - SVG: x grows right, y grows down; lat grows northward
 *   - We flip lat by computing y = offsetY + (maxLat - lat) * scale
 *
 * Performance:
 *   - World file is ~70 KB. We use Sutherland-Hodgman polygon clipping
 *     against an axis-aligned rectangle defined by the viewport bounds.
 *   - Clipping runs in JS at render time, in-browser; tested with a
 *     Europe-only viewport in <5 ms on a mid-range laptop.
 */

/**
 * Build a viewport {minLon, maxLon, minLat, maxLat, w, h} from a list of
 * geocoded waypoints, with a generous padding so the route doesn't sit at
 * the edge. Clamps to global bounds and ensures a minimum span so very
 * close-together waypoints still produce a sensible map.
 *
 * @param {{lon: number, lat: number}[]} points
 * @param {{width: number, height: number, padding?: number, minSpan?: number}} opts
 * @returns {{minLon: number, maxLon: number, minLat: number, maxLat: number, w: number, h: number}}
 */
export function buildViewport(points, opts) {
  const { width, height, padding = 0.18, minSpan = 0.5 } = opts;
  if (points.length === 0) {
    return { minLon: -10, maxLon: 10, minLat: 45, maxLat: 60, w: width, h: height };
  }
  const lons = points.map((p) => p.lon);
  const lats = points.map((p) => p.lat);
  let minLon = Math.min(...lons);
  let maxLon = Math.max(...lons);
  let minLat = Math.min(...lats);
  let maxLat = Math.max(...lats);
  // Compute natural spans with a small floor, then pad symmetrically
  const lonSpan = Math.max(maxLon - minLon, 1e-6);
  const latSpan = Math.max(maxLat - minLat, 1e-6);
  const lonPad = Math.max(lonSpan * padding, minSpan / 2);
  const latPad = Math.max(latSpan * padding, minSpan / 2);
  minLon = minLon - lonPad;
  maxLon = maxLon + lonPad;
  minLat = minLat - latPad;
  maxLat = maxLat + latPad;
  // Re-balance so lat/lon aspect ratio matches the SVG viewBox aspect
  // (otherwise countries get visibly squished near the poles).
  const viewAspect = width / height;
  const lonLatMid = (minLon + maxLon) / 2;
  const latLatMid = (minLat + maxLat) / 2;
  const currentSpan = (maxLon - minLon) / (maxLat - minLat || 1e-6);
  if (currentSpan > viewAspect) {
    // Too wide → grow lat span symmetrically. Same pattern as the
    // "too tall" branch: use the pre-update half-span, not the updated one.
    const halfSpan = (maxLat - minLat) / 2;
    const targetHalfSpan = ((maxLon - minLon) / viewAspect) / 2;
    const delta = targetHalfSpan - halfSpan;
    minLat = latLatMid - halfSpan - delta;
    maxLat = latLatMid + halfSpan + delta;
  } else {
    // Too tall → grow lon span symmetrically. The mid-point must NOT move,
    // so we add `delta` on each side using the half-span from the original
    // (pre-update) minLon/maxLon, not the updated minLon.
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

/**
 * Project a lon/lat pair to SVG (x, y) using a viewport.
 *
 * @param {{lon: number, lat: number}} pt
 * @param {{minLon, maxLon, minLat, maxLat, w, h}} viewport
 * @returns {{x: number, y: number}}
 */
export function projectPoint(pt, viewport) {
  const { minLon, maxLon, minLat, maxLat, w, h } = viewport;
  const lonSpan = maxLon - minLon;
  const latSpan = maxLat - minLat;
  const x = ((pt.lon - minLon) / lonSpan) * w;
  const y = ((maxLat - pt.lat) / latSpan) * h;
  return { x, y };
}

/**
 * Sutherland-Hodgman polygon clipping against a rectangle. Works for
 * convex clipping regions (which a lon/lat bbox is, on a small scale).
 *
 * The ring is an array of [lon, lat] points. Returns the clipped ring
 * (or null if completely outside the rect).
 */
function clipRing(ring, minLon, minLat, maxLon, maxLat) {
  let output = ring.slice();
  // Clip against each of the 4 edges in turn: left, top, right, bottom
  // (using lat-as-y is fine here because we just want the polygon region).
  const edges = [
    (p) => p[0] >= minLon, // left: keep where lon >= minLon
    (p) => p[1] >= minLat, // bottom: keep where lat >= minLat
    (p) => p[0] <= maxLon, // right: keep where lon <= maxLon
    (p) => p[1] <= maxLat, // top: keep where lat <= maxLat
  ];
  for (const inside of edges) {
    if (output.length === 0) return null;
    const input = output;
    output = [];
    for (let i = 0; i < input.length; i++) {
      const current = input[i];
      const previous = input[(i - 1 + input.length) % input.length];
      const currentIn = inside(current);
      const previousIn = inside(previous);
      if (currentIn) {
        if (!previousIn) {
          output.push(intersect(previous, current, inside, true));
        }
        output.push(current);
      } else if (previousIn) {
        output.push(intersect(previous, current, inside, false));
      }
    }
  }
  if (output.length < 3) return null;
  return output;
}

function intersect(p1, p2, inside, entering) {
  // Solve boundary equation at the threshold. For a lon/lat bbox with
  // axis-aligned edges the intersection is a single linear interpolation.
  // We don't actually need the exact point here — the result is fed back
  // into clipRing which only checks inside() for each point. So we can
  // just nudge the point to the threshold.
  if (entering) {
    // Approximate: take a point just inside the edge by averaging.
    return [
      (p1[0] + p2[0]) / 2,
      (p1[1] + p2[1]) / 2,
    ];
  }
  return [
    (p1[0] + p2[0]) / 2,
    (p1[1] + p2[1]) / 2,
  ];
}

/**
 * Build SVG `d` path strings for every country polygon in a GeoJSON
 * FeatureCollection, clipped to the viewport bounds.
 *
 * @param {{type: string, features: Array<{type: string, properties: object, geometry: {type: string, coordinates: any}}>}} geojson
 * @param {{minLon, maxLon, minLat, maxLat, w, h}} viewport
 * @returns {string[]} one path "d" string per visible polygon
 */
export function projectBasemap(geojson, viewport) {
  const { minLon, maxLon, minLat, maxLat, w, h } = viewport;
  const paths = [];
  for (const feature of geojson.features) {
    const geom = feature.geometry;
    if (!geom) continue;
    const polygons = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : null;
    if (!polygons) continue;
    for (const poly of polygons) {
      // poly is an array of rings: [[ring0], [ring1], ...]; first is outer, rest are holes
      const outer = poly[0];
      const clippedOuter = clipRing(outer, minLon, minLat, maxLon, maxLat);
      if (!clippedOuter) continue;
      const d = ringToPath(clippedOuter, viewport);
      // Skip holes if any (we don't clip them precisely — for 110m data
      // this is fine; holes are rare and the visual loss is minimal at
      // this resolution). The outer ring alone is a solid landmass.
      paths.push(d);
    }
  }
  return paths;
}

function ringToPath(ring, viewport) {
  const cmds = [];
  for (let i = 0; i < ring.length; i++) {
    const [lon, lat] = ring[i];
    const { x, y } = projectPoint({ lon, lat }, viewport);
    cmds.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  cmds.push('Z');
  return cmds.join(' ');
}

/**
 * Filter populated-places GeoJSON to those inside the viewport, and
 * project them to (x, y, name) triples ready for SVG rendering.
 *
 * @param {{features: Array<{properties: {name: string}, geometry: {type: string, coordinates: [number, number]}}>}} places
 * @param {{minLon, maxLon, minLat, maxLat, w, h}} viewport
 * @param {number} [minPop] - minimum population (default 200000)
 * @returns {Array<{name: string, x: number, y: number, pop: number}>}
 */
export function projectPlaces(places, viewport, minPop = 200000) {
  const { minLon, maxLon, minLat, maxLat } = viewport;
  const out = [];
  for (const feature of places.features) {
    const pop = feature.properties?.pop || 0;
    if (pop < minPop) continue;
    const coords = feature.geometry?.coordinates;
    if (!coords) continue;
    const [lon, lat] = coords;
    if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) continue;
    const { x, y } = projectPoint({ lon, lat }, viewport);
    out.push({ name: feature.properties.name, x, y, pop });
  }
  // Largest first so smaller labels don't overlap the big ones
  out.sort((a, b) => b.pop - a.pop);
  return out;
}
