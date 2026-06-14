# Trips Dashboard

A private, read-only Vercel dashboard for Danny's travel-planner trip summaries.

- Production: https://tsang-travel.vercel.app
- Source repo: https://github.com/dannytsang/trips-dashboard
- Runtime trip source: Hermes `travel-planner` state, not committed dashboard data

## Specs

The governing dashboard specs live in the travel-planner skill hierarchy, matching the meals-dashboard pattern:

| Spec | Status | Purpose |
|---|---|---|
| `/home/hermes/workspace/Hermes-Skills/productivity/travel-planner/.specify/specs/008-dashboard-summary/spec.md` | Draft | Upcoming trips summary projection, privacy, sync, and visual contract. |
| `/home/hermes/workspace/Hermes-Skills/productivity/travel-planner/.specify/specs/009-dashboard-oidc-authentication/spec.md` | Draft | OIDC/AuthentiK and private data/API protection contract. |

This repository owns the web implementation, Vercel deployment, and any repo-local implementation notes. The travel-planner skill owns the source-of-truth dashboard behaviour specs.

## Privacy rule

Trip data must not be stored in this public git repository, committed generated TypeScript/JSON, or exposed through public static assets. Dashboard data must be stored only in authenticated/private runtime services and served to authenticated users.

## Deployment guardrails

This repository includes a minimal Next.js dashboard shell so Vercel has a valid deployment target before the real authenticated dashboard is implemented.

`vercel.json` configures `scripts/vercel-ignore-build.sh` as the ignored-build command. Markdown/spec-only commits are skipped by Vercel, while source/config/app changes still build and deploy.
