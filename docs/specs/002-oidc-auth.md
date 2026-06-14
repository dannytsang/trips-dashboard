# Spec 002 — OIDC Authentication

Status: Draft
Last updated: 2026-06-14
Related: [`001-upcoming-trips-summary-dashboard.md`](001-upcoming-trips-summary-dashboard.md)

## 1. Goal

Protect the trips dashboard and all trip-data APIs with OIDC authentication, using the meals-dashboard Authentik/NextAuth pattern as the model.

This is a draft for a later implementation. The summary dashboard may be built with mock data first, but real trip data must not be served in production until this authentication layer and private data storage are in place.

## 2. Reference implementation to mirror

The meals-dashboard implementation currently uses:

- `next-auth`
- `next-auth/providers/authentik`
- JWT sessions
- a custom `/auth/signin` page
- middleware protecting `/` and `/api/dashboard/:path*`
- runtime env vars:
  - `AUTHENTIK_CLIENT_ID`
  - `AUTHENTIK_CLIENT_SECRET`
  - `AUTHENTIK_ISSUER`
  - `NEXTAUTH_SECRET`

Trips-dashboard should follow the same pattern unless Danny chooses a different OIDC provider.

## 3. Routes to protect

| Route | Protection requirement |
|---|---|
| `/` | Requires OIDC session before rendering real trip data. |
| `/api/trips` | Requires OIDC session before returning dashboard projection. |
| `/api/trips/:path*` | Requires OIDC session unless specifically an ingestion endpoint using a separate machine credential. |
| `/api/trips/sync` | Must require a separate server-to-server sync credential, not an interactive browser session. |
| `/auth/signin` | Public sign-in page; must not load trip data. |
| Static assets | Public, but must contain no live trip data. |

## 4. Environment variables

Proposed runtime variables:

```text
AUTHENTIK_CLIENT_ID=<oidc-client-id>
AUTHENTIK_CLIENT_SECRET=<oidc-client-secret>
AUTHENTIK_ISSUER=<https://authentik.example/application/o/.../>
NEXTAUTH_SECRET=<generated-secret>
NEXTAUTH_URL=https://trips-dashboard-theta.vercel.app
TRIPS_DASHBOARD_SYNC_SECRET=<server-to-server ingestion secret>
TRIPS_DASHBOARD_ALLOWED_GROUPS=<optional comma-separated OIDC group names>
```

Rules:

- These values must be configured in Vercel project environment variables or local `.env.local` only.
- Do not commit `.env*` files containing real values.
- Specs and code may mention env var names, but never actual secrets.

## 5. Session and authorisation model

### 5.1 Authentication

- Use Authentik as the first OIDC provider.
- Use NextAuth JWT session strategy.
- Set a custom sign-in page at `/auth/signin`.
- The session should include only the minimum user details required for UI/debugging, such as name/email/avatar if provided by the OIDC provider.

### 5.2 Authorisation

Initial implementation may allow any successfully authenticated account in the configured Authentik application.

Future/harder gate:

- Read OIDC groups/claims.
- If `TRIPS_DASHBOARD_ALLOWED_GROUPS` is configured, require at least one matching group.
- Return a friendly `403`/not-authorised state for authenticated but unauthorised users.

## 6. Middleware contract

Middleware should be equivalent in spirit to meals-dashboard:

```ts
import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: {
    signIn: '/auth/signin',
  },
});

export const config = {
  matcher: ['/', '/api/trips/:path*'],
};
```

Implementation nuance: `/api/trips/sync` may need custom middleware or route-level handling because it is authenticated by a machine sync secret rather than a browser session. Do not accidentally require Danny's interactive OIDC session for Hermes automation pushing updates.

## 7. Sign-in page requirements

The trips sign-in page should mirror meals-dashboard's private-dashboard feel while changing the language:

- Title: `Trips Dashboard`
- Heading example: `Sign in for travel intelligence`
- Body example: `Private trip plans, monitoring state, and journey summaries are protected by Authentik.`
- Button: `Continue with Authentik`
- Include theme toggle using the dashboard theme provider.
- Do not fetch or embed trip data on the sign-in page.

## 8. Private data API requirements

- All browser-facing trip APIs require a valid session.
- APIs must return `401` or redirect semantics consistently when unauthenticated.
- APIs must return no partial/private payload before auth is validated.
- Data should be read from private runtime storage, not from source-controlled generated files.
- API responses may include `generatedAt`, `schemaVersion`, `stale` flags, and summary counts after auth.

## 9. Ingestion endpoint authentication

The Hermes travel-planner sync needs a non-interactive path to update data.

`POST /api/trips/sync` must require one of:

1. An `Authorization` header carrying the configured `TRIPS_DASHBOARD_SYNC_SECRET` value
2. HMAC signature over request body using `TRIPS_DASHBOARD_SYNC_SECRET`
3. Another explicitly documented machine-to-machine authentication mechanism

Minimum draft requirement: bearer secret is acceptable for v1 if sent only over HTTPS and stored in Hermes/Vercel runtime secrets. HMAC is preferred if replay protection is added.

The ingestion endpoint must:

- reject missing/invalid credentials with no details that disclose the expected secret
- validate payload schema before storing
- record `generatedAt` and `receivedAt`
- avoid logging sensitive payload details
- leave previous good data intact on validation failure

## 10. Acceptance scenarios

### SC-001 — Anonymous dashboard request

Given OIDC is configured, when an unauthenticated visitor requests `/`, then no trip data is rendered and the visitor is directed to `/auth/signin`.

### SC-002 — Authenticated dashboard request

Given Danny has a valid Authentik session, when he requests `/`, then the dashboard renders using private runtime trip projection data.

### SC-003 — Sign-in page privacy

Given any visitor opens `/auth/signin`, then the response contains no trip IDs, destination labels, travel dates, or private projection JSON.

### SC-004 — API route protection

Given an unauthenticated request to `/api/trips`, then the route returns no trip data.

### SC-005 — Sync endpoint machine auth

Given Hermes posts a valid projection to `/api/trips/sync` with a valid machine credential, then the projection is accepted and becomes the latest dashboard data.

### SC-006 — Sync endpoint rejects browser-only auth

Given a user has an OIDC browser session but no sync credential, when they post to `/api/trips/sync`, then the update is rejected. Viewing and ingestion are separate powers. Sensible, if a touch less exciting.

### SC-007 — Missing auth configuration

Given required OIDC env vars are missing in production, then the app fails closed or shows an authenticated-admin-safe configuration error; it must not fall back to public access.

## 11. Verification requirements for implementation

- Unit-test missing auth env detection.
- Unit-test sign-in page copy and button provider target.
- Route/middleware test that unauthenticated `/api/trips` returns no data.
- Build check: `npm run build`.
- Static private-data guard after build.
- Manual smoke test against Vercel preview or production once env vars are configured.

## 12. Open decisions

- Which Authentik application/client should be created for trips-dashboard?
- Should v1 authorise any Authentik-authenticated user, or restrict by group/claim immediately?
- Which private Vercel storage should hold the latest projection: Vercel KV, Postgres, Blob with server-only access, or another authenticated store?
- Should ingestion use bearer secret for v1 or HMAC with timestamp/replay protection from the start?
