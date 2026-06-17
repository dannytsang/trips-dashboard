# Trip map — OpenStreetMap embed

The trip map on the trip detail page is an embedded **OpenStreetMap**
iframe, not a self-rendered vector map.

## Why OSM

- **Real raster tiles** at street/city resolution, vs the simplified
  Natural Earth polygons we previously shipped (~72 KB world outline
  that looked "data issue" at any zoom).
- **No API key, no billing**. The OSM `/export/embed.html` endpoint is a
  free public service for low-traffic embeds. For higher-volume usage
  the OSM Foundation recommends self-hosting tile servers or moving to a
  tile-provider like Mapbox — but for a private dashboard with one map
  per page, the embed endpoint is the right fit.
- **Attribution built into the iframe**.

## URL shape

```
https://www.openstreetmap.org/export/embed.html
  ?bbox=<minLon>,<minLat>,<maxLon>,<maxLat>
  &layer=mapnik
  &marker=<lat>,<lon>
```

Notes:
- `bbox` order is **minLon, minLat, maxLon, maxLat** (OSM convention).
- `marker` is a single point in **lat, lon** order.
- `layer=mapnik` selects the standard raster tile layer.

## Privacy contract (spec 010 FR-027)

The iframe URL is composed in-browser from geocoded waypoints **only**,
and waypoints with `precision: home` or `precision: exact` are filtered
out before the URL is built. This is **defence in depth** — the server
`/api/geocode` route also enforces the privacy filter, but we re-filter
client-side so a tampered server response or a missed code path can
never leak a private coord into the OSM request.

The marker is the **last** visible (non-private) waypoint, which is
typically the destination / accommodation — always a public venue.

The server `/api/geocode` route is the only call the dashboard makes
to OSM's Nominatim service, and it sets a proper `User-Agent` per
Nominatim's usage policy.

## Fallback

When fewer than 2 non-private waypoints geocode, TripMap renders a
structured waypoint list (origins → destinations by leg) instead of the
iframe. The map region is also hidden from the page in that case so the
user sees the list immediately, not a broken iframe.