# Trips Dashboard

A private, read-only Vercel dashboard for Danny's travel-planner trip summaries.

- Production: https://tsang-travel.vercel.app
- Source repo: https://github.com/dannytsang/trips-dashboard
- Runtime trip source: Hermes `travel-planner` state, not committed dashboard data

## Specs

The governing dashboard specs live in the travel-planner skill hierarchy, matching the meals-dashboard pattern:

| Spec | Status | Purpose |
|---|---|---|
| `/home/hermes/workspace/Hermes-Skills/productivity/travel-planner/.specify/specs/008-dashboard-summary/spec.md` | Final | Upcoming trips summary brief, privacy, sync, and visual contract. |
| `/home/hermes/workspace/Hermes-Skills/productivity/travel-planner/.specify/specs/009-dashboard-oidc-authentication/spec.md` | Final | OIDC/AuthentiK and private data/API protection contract. |
| `/home/hermes/workspace/Hermes-Skills/productivity/travel-planner/.specify/specs/010-dashboard-trip-detail/spec.md` | Final | Authenticated trip-detail surface, maps, collapsible legs, and read-only deep-dive contract. |
| `/home/hermes/workspace/Hermes-Skills/productivity/travel-planner/.specify/specs/011-dashboard-weather-forecast/spec.md` | Final | Optional display-safe weather forecast on summary cards and trip detail. |
| `/home/hermes/workspace/Hermes-Skills/productivity/travel-planner/.specify/specs/012-dashboard-demo-mode/spec.md` | Final | Preview/demo mode with generated anonymised static trips when Blob credentials are intentionally absent. |

This repository owns the web implementation, Vercel deployment, and any repo-local implementation notes. The travel-planner skill owns the source-of-truth dashboard behaviour specs.

## Runtime environment

Set these in Vercel production/preview environments; never commit their values:

- `AUTHENTIK_CLIENT_ID`
- `AUTHENTIK_CLIENT_SECRET`
- `AUTHENTIK_ISSUER`
- `NEXTAUTH_URL=https://tsang-travel.vercel.app`
- `NEXTAUTH_SECRET`
- `TRIPS_DASHBOARD_SYNC_SECRET` once the sync endpoint is used by Hermes/travel-planner
- Vercel Blob storage for the latest brief, using either Vercel-managed Blob OIDC/store binding or `BLOB_READ_WRITE_TOKEN`
- Optional `TRIPS_DASHBOARD_BLOB_PATH` override; defaults to `trips-dashboard/current.json`

### Map provider switch (optional)

The trip detail map is embedded as an iframe. The default provider is **OpenStreetMap** (no key, free, no quota). You can switch to **Google Maps Embed API** by setting:

| Name | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_GMAPS_PROVIDER` | for Google | Set to `google` to use the Google Maps Embed API. Unset (or `osm`) keeps OSM. |
| `NEXT_PUBLIC_GMAPS_EMBED_KEY` | for Google | Google Maps Platform API key with the **Maps Embed API** enabled. |

`NEXT_PUBLIC_*` vars are inlined into the client bundle (Next.js default), so the key is visible to anyone who opens DevTools. **Restrict the key by HTTP referrer** in Google Cloud Console:

- `tsang-travel.vercel.app/*` (production)
- `*.vercel.app/*` (preview deploys)

Referrer restriction stops the key from being lifted and used elsewhere. Vercel does **not** hot-reload env changes — set the vars in **Project → Settings → Environment Variables**, then redeploy.

**Provider selection logic:** the map uses Google only when `NEXT_PUBLIC_GMAPS_PROVIDER=google` AND a key is set. Otherwise it silently falls back to OSM so a missing key on a preview deploy never breaks the page. See `.env.example`, `components/trip-overview-map.jsx`, and the per-leg map helpers.

> **Note on Google Maps Embed API:** the Embed API has a hard single-pin limit. `place` mode shows one pin; `directions` mode supports only one origin/destination; there is no multi-pin embed mode. To show multiple POI pins on one map you would need the **Maps JavaScript API** (billable product — separate decision). Spec 010 FR-009.

## Privacy rule

Trip data must not be stored in this public git repository, committed generated TypeScript/JSON, or exposed through public static assets. Dashboard data must be stored only in authenticated/private runtime services and served to authenticated users.

## Deployment guardrails

This repository includes a minimal Next.js dashboard shell so Vercel has a valid deployment target before the real authenticated dashboard is implemented.

`vercel.json` configures `scripts/vercel-ignore-build.sh` as the ignored-build command. Markdown/spec-only commits are skipped by Vercel, while source/config/app changes still build and deploy.
