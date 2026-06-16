import { NextResponse } from 'next/server';

/**
 * Geocode a location label to lat/lon using Nominatim (OSM).
 *
 * Privacy: labels with precision 'home' or 'exact' are never geocoded.
 * Instead, returns { error: 'precision_excluded', label } so the caller
 * can fall back to a coarser display label.
 *
 * Request body: { label: string, precision?: string }
 * Response: { lat: number, lon: number } | { error: string, label?: string }
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { label, precision } = body || {};

  if (!label || typeof label !== 'string') {
    return NextResponse.json({ error: 'label_required' }, { status: 400 });
  }

  // Never geocode privacy-sensitive locations
  if (precision === 'home' || precision === 'exact') {
    return NextResponse.json({ error: 'precision_excluded', label }, { status: 200 });
  }

  try {
    const query = encodeURIComponent(label.trim());
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&addressdetails=0`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'tsang-travel-dashboard/1.0 (trips-dashboard)',
        'Accept': 'application/json',
      },
      // Next.js fetch caching — cache for 1 hour (3600s) per unique label
      next: { revalidate: 3600, tags: [`geocode-${query}`] },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'geocoder_error', status: response.status }, { status: 502 });
    }

    const results = await response.json();

    if (!results || results.length === 0) {
      return NextResponse.json({ error: 'not_found', label }, { status: 200 });
    }

    const result = results[0];
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);

    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return NextResponse.json({ error: 'invalid_response', label }, { status: 200 });
    }

    return NextResponse.json({ lat, lon, displayName: result.display_name || label });
  } catch (err) {
    return NextResponse.json({ error: 'network_error', message: String(err) }, { status: 502 });
  }
}