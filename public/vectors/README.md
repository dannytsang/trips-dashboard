# Trip map basemap

This directory contains the simplified vector basemap used by the
embedded trip map on the trip detail page.

## Data source

- **Country outlines**: Natural Earth `ne_110m_admin_0_countries`
- **Populated places**: Natural Earth `ne_110m_populated_places`

Both datasets are released into the **public domain** by Natural Earth.
See https://www.naturalearthdata.com/ for the upstream data, and the
Natural Earth Vector mirror at
https://github.com/nvkelso/natural-earth-vector/ for the GeoJSON
distribution used here.

## Files

- `world-slim.json` (~72 KB) — world country outlines, simplified by
  point decimation. 177 features.
- `places-slim.json` (~26 KB) — populated places with `POP_MAX >= 200000`.
  202 features.

## Why simplified

The raw Natural Earth GeoJSON files are ~820 KB and ~640 KB respectively.
The trip map is embedded in a privacy-safe dashboard that must render
without third-party tile services, so the basemap is shipped as a static
asset. We down-sampled the country polygons by taking every Nth point in
each ring to keep the file under 100 KB. The result is visually
acceptable at the trip-map zoom level (typically covering a single
country or a short multi-country route).

## Privacy

These files contain **no** trip data. They are a generic world outline.
The dashboard never embeds home/exact coordinates in the public build.
