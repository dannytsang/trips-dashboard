# Trips Dashboard

A private, read-only Vercel dashboard for Danny's travel-planner trip summaries.

- Production: https://trips-dashboard-theta.vercel.app
- Source repo: https://github.com/dannytsang/trips-dashboard
- Runtime trip source: Hermes `travel-planner` state, not committed dashboard data

## Specs

| Spec | Status | Purpose |
|---|---|---|
| [`docs/specs/001-upcoming-trips-summary-dashboard.md`](docs/specs/001-upcoming-trips-summary-dashboard.md) | Draft | Initial summary dashboard listing upcoming trips and defining the private data contract/sync boundaries. |
| [`docs/specs/002-oidc-auth.md`](docs/specs/002-oidc-auth.md) | Draft | Future OIDC/AuthentiK protection model, mirroring the meals-dashboard approach. |

## Privacy rule

Trip data must not be stored in this public git repository, committed generated TypeScript/JSON, or exposed through public static assets. Dashboard data must be stored only in authenticated/private runtime services and served to authenticated users.
