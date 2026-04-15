# ROI Monorepo Foundation

Production workspace for **ROI (CROISSANT - DESSERT - COFFEE)**.

This phase establishes a scalable monorepo structure for:

- `apps/api` (NestJS + Prisma backend)
- `apps/admin-web` (admin shell)
- `apps/pos-web` (POS shell)
- `apps/kitchen-display` (KDS shell)
- shared workspace packages for types, utilities, and API client

## Repository Layout

```txt
roi/
  apps/
    api/
    admin-web/
    pos-web/
    kitchen-display/
  packages/
    shared-types/
    shared-utils/
    api-client/
  prisma/
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
```

## Prerequisites

- Node.js 20+
- pnpm 10+
- PostgreSQL

## Environment

Backend reads `.env` from either:

1. `apps/api/.env`
2. repo root `.env` (fallback)

Recommended quick setup:

```bash
cp .env.example .env
```

For browser-based apps, keep `CORS_ORIGINS` aligned with your frontend dev ports.

Frontend app env examples:

- `apps/admin-web/.env.example`
- `apps/pos-web/.env.example`
- `apps/kitchen-display/.env.example`
- `apps/qr-web/.env.example`

## Install

```bash
pnpm install
```

## Workspace Scripts (root)

```bash
pnpm run dev:api
pnpm run dev:admin
pnpm run dev:pos
pnpm run dev:kitchen
pnpm run dev:all

pnpm run build
pnpm run build:api
pnpm run build:frontends

pnpm run prisma:generate
pnpm run prisma:migrate
pnpm run prisma:deploy
pnpm run prisma:seed
```

## Backend Notes (`apps/api`)

- Existing modular backend domain was preserved and moved under `apps/api/src`.
- Prisma schema remains at repo root: `prisma/schema.prisma`.
- API base prefix remains: `/api/v1`.

Local API run:

```bash
pnpm --filter @roi/api start:dev
```

## Production Hardening Notes

- API startup now fails fast when critical runtime config is invalid.
- CORS and realtime origins are explicitly controlled by env (`CORS_ORIGINS`, `REALTIME_ALLOWED_ORIGINS`).
- Security headers are enabled through Helmet.
- Global request validation is strict (`whitelist`, `forbidNonWhitelisted`, `forbidUnknownValues`).
- Global throttling is enabled and sensitive routes have tighter limits.
- Health/readiness split:
  - `/api/v1/health` => process up
  - `/api/v1/ready` => process + DB ready
- Request logs include `x-request-id` correlation.
- Error responses are normalized and internal details are hidden for production `5xx`.

## Deployment Checklist (Minimal)

1. Set `NODE_ENV=production`.
2. Configure `DATABASE_URL`, strong `JWT_SECRET`, and explicit `CORS_ORIGINS`.
3. Optionally configure `REALTIME_ALLOWED_ORIGINS` separately.
4. Review throttling env values for expected traffic.
5. Run:
   - `pnpm run build`
   - `pnpm run prisma:deploy`
6. Verify:
   - `GET /api/v1/health` returns `up`
   - `GET /api/v1/ready` returns `ready`

## Operations / Backup Foundation

- See `docs/operations-runbook.md` for:
  - backup expectations
  - restore expectations
  - critical datasets
  - incident triage quick steps

## Frontend Foundations

### Admin Web (`apps/admin-web`)

Routes scaffolded:

- `/login`
- `/dashboard`
- `/catalog`
- `/orders`
- `/stations`
- `/payments`
- `/inventory`
- `/reports`
- `/settings`

Includes:

- login flow
- protected shell
- sidebar navigation
- session bootstrap and logout

### POS Web (`apps/pos-web`)

Routes scaffolded:

- `/login`
- `/tables`
- `/quick-sale`
- `/order-entry`
- `/payments`

Includes:

- login flow
- protected touch-friendly shell
- top operational status bar (user, branch, connection)

### Kitchen Display (`apps/kitchen-display`)

Routes scaffolded:

- `/login`
- `/stations`
- `/board`

Includes:

- login flow
- protected KDS shell
- station selection placeholder
- queued / in-progress / ready board layout placeholder

## Shared Packages

### `@roi/shared-types`

Frontend-safe shared interfaces and enums.

### `@roi/shared-utils`

Reusable helpers (token storage, formatting, className utility).

### `@roi/api-client`

Reusable API foundation:

- base URL config
- bearer token injection
- normalized API error handling
- modular service files (`auth`, `users`, `system`)

## Current Intent

This phase is structural.

- The backend operational core is preserved.
- Frontend surfaces are scaffolded with auth + app shell foundations.
- Future feature phases (CRUD screens, real POS order entry, live KDS) can now be implemented with consistent architecture.
