# ROI Pre-Production Readiness Package

Project: ROI  
Subtitle: CROISSANT - DESSERT - COFFEE

This document is the operator-facing package for controlled pre-production (staging/pilot).

---

## 1) Pre-production readiness summary

- Scope covered: environment setup, deployment, startup, smoke validation, daily checks, rollback, pilot operations, failure playbooks.
- Constraints: no new features, no architecture redesign.
- Baseline ports:
  - API: `3002`
  - Admin Web dev: `3100` (preview: `4100`)
  - POS Web dev: `3200` (preview: `4200`)
  - Kitchen Display dev: `3300` (preview: `4300`)
  - QR Web dev: `3400` (preview: `4400`)

---

## 2) Environment variables table

### API (`apps/api`) and root `.env`

| Variable | Required | Sensitive | Default / Example | Notes |
|---|---|---:|---|---|
| `NODE_ENV` | Yes | No | `production` | Must be `production` in pilot/prod-like runs. |
| `PORT` | Yes | No | `3002` | Standard API port. |
| `DATABASE_URL` | Yes | Yes | `postgresql://...` | PostgreSQL connection string. |
| `JWT_SECRET` | Yes | Yes | long random string | Min length 32. |
| `INTEGRATION_CREDENTIALS_ENCRYPTION_KEY` | Yes | Yes | long random string | Min length 32; used to encrypt integration credentials. |
| `JWT_EXPIRES_IN` | Optional | No | `1h` | JWT expiry policy. |
| `BCRYPT_SALT_ROUNDS` | Optional | No | `12` | Auth hashing cost. |
| `CORS_ORIGINS` | Yes in production | No | comma-separated origins | Mandatory in production mode. |
| `REALTIME_ALLOWED_ORIGINS` | Optional | No | empty => CORS origins | Explicit socket origin allowlist. |
| `TRUST_PROXY` | Optional | No | `false` | Set true behind reverse proxy. |
| `ENABLE_REQUEST_LOGS` | Optional | No | `true` | Request logging toggle. |
| `REQUEST_LOG_EXCLUDE_HEALTH` | Optional | No | `true` | Reduce `/health` log noise. |
| `RATE_LIMIT_TTL_SECONDS` | Optional | No | `60` | Global throttle window. |
| `RATE_LIMIT_MAX` | Optional | No | `200` | Global throttle limit. |
| `AUTH_RATE_LIMIT_MAX` | Optional | No | `20` | Auth endpoints throttle. |
| `PUBLIC_RATE_LIMIT_MAX` | Optional | No | `30` | Public order throttle. |
| `PUBLIC_MENU_RATE_LIMIT_MAX` | Optional | No | `90` | Public menu throttle. |
| `PUBLIC_ORDER_IDEMPOTENCY_WINDOW_MINUTES` | Optional | No | `15` | Retry replay window. |
| `INTEGRATION_TEST_RATE_LIMIT_MAX` | Optional | No | `15` | Test ingest throttle. |
| `READINESS_DB_TIMEOUT_MS` | Optional | No | `2500` | DB readiness timeout. |
| `ERROR_TRACKING_DSN` | Optional | Yes | empty | Plug-in point for external tracking. |

### Frontend envs

| App | Variable | Required | Sensitive | Example | Notes |
|---|---|---|---:|---|---|
| admin-web | `VITE_API_BASE_URL` | Yes | No | `https://api.roi-stage.local/api/v1` | API base. |
| admin-web | `VITE_REALTIME_BASE_URL` | Yes | No | `https://api.roi-stage.local` | Socket base (`/realtime` appended by client). |
| admin-web | `VITE_APP_TITLE` | Optional | No | `ROI Admin` | UI title only. |
| pos-web | `VITE_API_BASE_URL` | Yes | No | `https://api.roi-stage.local/api/v1` | API base. |
| pos-web | `VITE_REALTIME_BASE_URL` | Yes | No | `https://api.roi-stage.local` | Socket base. |
| pos-web | `VITE_APP_TITLE` | Optional | No | `ROI POS` | UI title only. |
| kitchen-display | `VITE_API_BASE_URL` | Yes | No | `https://api.roi-stage.local/api/v1` | API base. |
| kitchen-display | `VITE_REALTIME_BASE_URL` | Yes | No | `https://api.roi-stage.local` | Socket base. |
| kitchen-display | `VITE_APP_TITLE` | Optional | No | `ROI Kitchen Display` | UI title only. |
| qr-web | `VITE_API_BASE_URL` | Yes | No | `https://api.roi-stage.local/api/v1` | Public API base. |
| qr-web | `VITE_APP_TITLE` | Optional | No | `ROI QR Menu` | UI title only. |

### Alignment rule

- In pre-production, **all frontend apps must point to the same API host**.
- `VITE_REALTIME_BASE_URL` must target that same API host (without `/api/v1`).

---

## 3) Deployment steps

### 3.1 Build pipeline (single host, simple model)

```bash
pnpm install --frozen-lockfile
pnpm run build
```

### 3.2 Database migration

```bash
pnpm run prisma:deploy
```

### 3.3 Backend deployment

```bash
pnpm --filter @roi/api start:prod
```

### 3.4 Frontend artifacts

Build outputs:
- `apps/admin-web/dist`
- `apps/pos-web/dist`
- `apps/kitchen-display/dist`
- `apps/qr-web/dist`

Serve with any static web server (Nginx/Caddy/Apache).  
For controlled pilot fallback (single host), use Vite preview commands:

```bash
pnpm --filter @roi/admin-web preview
pnpm --filter @roi/pos-web preview
pnpm --filter @roi/kitchen-display preview
pnpm --filter @roi/qr-web preview
```

### 3.5 Port map (recommended)

- API: `3002`
- Admin: `4100`
- POS: `4200`
- KDS: `4300`
- QR: `4400`

---

## 4) Startup commands

### Local development (watch mode)

```bash
pnpm install
pnpm run dev:all
```

### Production-like startup (separate)

```bash
pnpm install --frozen-lockfile
pnpm run build
pnpm run prisma:deploy
pnpm --filter @roi/api start:prod
```

Then serve frontend `dist` outputs via static server (or temporary `preview`).

### Launch-safe runtime toggles

- In production/pilot, set:
  - `NODE_ENV=production`
  - `INTERNAL_NETWORK_ENFORCE=true`
- This ensures internal app access follows branch network allow-list policy while public QR routes remain reachable.

---

## 5) Smoke test checklist

Run in order. Record PASS/FAIL with timestamp and request IDs on failures.

### Launch-grade cross-module smoke (mandatory before pilot open)

Run the final integrated launch smoke:

```bash
pnpm run smoke:phase10
```

This command verifies the full operational launch chain:
- waiter allowed/blocked network behavior
- table order -> BAR/KITCHEN routing
- cashier mixed payment + session close
- public QR menu + waiter call boundary
- customer desk start/repeat takeaway order
- low-stock inventory signal
- owner dashboard data sources + branch-scope safety

If Phase 10 smoke fails, pilot launch is blocked.

Recommended smoke run order:
1. `bash scripts/smoke/phase3-closure-smoke.sh`
2. `bash scripts/smoke/waiter-phase-1-6.sh`
3. `bash scripts/smoke/phase10-launch-smoke.sh`

### A. AUTH

1. `GET /api/v1/health` returns 200.
2. `GET /api/v1/ready` returns 200.
3. Admin login works from admin-web UI.
4. In production mode, registration is blocked:
   ```bash
   curl -i -X POST http://<api-host>/api/v1/auth/register \
     -H 'Content-Type: application/json' \
     -d '{"name":"x","email":"x@x.com","password":"Pass123456","branchId":"cp00000000000000000000001"}'
   ```
   Expect `403`.

### B. POS DINE-IN

1. Open table session in POS.
2. Create dine-in order.
3. Add catalog item with variant/modifiers.
4. Update item quantity/notes.
5. Verify totals update.
6. Send order to station.

Expected: table becomes occupied, order status progresses, post-send item mutation blocked.

### C. KDS / PRODUCTION

1. KDS board receives ticket for station.
2. Move item `QUEUED -> IN_PROGRESS -> READY -> COMPLETED`.
3. Confirm no other-branch data appears.

Expected: status progression reflected in KDS + order workflow.

### D. PAYMENT / BILLING / REFUND

1. Open register shift.
2. Bill order.
3. Record partial payment.
4. Record second payment to full.
5. Verify paid state only when outstanding reaches zero.
6. Execute refund flow and verify history.
7. Close shift and verify expected/actual/variance fields.

### E. INVENTORY

1. Use product with active recipe.
2. Complete payment to PAID.
3. Verify stock movement consumed exactly once.
4. Retry/recompute path does not double consume.

### F. QR PUBLIC ORDERING

1. Open `/menu?branchId=<validBranchId>` -> menu loads.
2. Missing/invalid `branchId` -> clear public error.
3. Add configured item and submit -> order created.
4. Retry same request attempt -> replay same order (no duplicate).
5. New submit attempt (same cart, new click) -> new order created.

### G. INTEGRATIONS

1. Ensure active provider config + mapping exists.
2. Run `test-ingest-order`.
3. Replay same external order id -> duplicate-safe response (no crash, no duplicate internal order).

### H. REALTIME

1. Keep POS + KDS + Admin dashboard open.
2. Trigger order create/update/send-to-station/payment.
3. Confirm UI updates without manual refresh for branch-scoped clients.

### I. REPORTING

1. Compare today’s orders/payments/refunds against report snapshots.
2. Verify no obvious mismatch in payment mix and shift totals.

---

## 6) Operational checklist

Run at opening and every 4 hours during pilot:

1. API up:
   - `/api/v1/health` = up
   - `/api/v1/ready` = ready
2. DB reachable (readiness success + no connection error spikes).
3. Admin login success for on-duty admin.
4. POS can open session and create/send order.
5. KDS receives and updates ticket.
6. Payment transaction can be recorded.
7. QR menu reachable from customer network path.
8. Error logs reviewed for 4xx/5xx anomalies.

Launch blockers (do not open service if any fails):
- internal blocked-network login does **not** return 403
- public menu is inaccessible from customer path
- table payment flow cannot reach `PAID` + `table-session CLOSED`
- BAR/KITCHEN routing proof missing for send-to-station

---

## 7) Rollback strategy

### 7.1 Backend rollback

1. Keep previous release artifact (`dist`) and git SHA.
2. Stop current API process.
3. Start previous API artifact with previous env set.
4. Verify `/health` and `/ready`.

### 7.2 Frontend rollback

1. Keep previous static bundle per app (`dist` tarball + SHA).
2. Re-point static server to previous bundle.
3. Hard refresh and validate login + key flows.

### 7.3 Database rollback / restore

1. Take backup before any schema deployment.
2. If rollback requires data restore:
   - restore latest healthy backup to recovery DB
   - verify with API `/ready` + smoke login + order read checks
   - cut over after validation.

Note: schema down-migrations are not assumed; restore is the primary rollback path.

---

## 8) Pilot run plan

### Pilot shape (controlled)

- Branches: 1 pilot branch.
- Users: 1 admin, 2 POS operators, 1 kitchen operator.
- Duration: 3–5 consecutive business days.
- Traffic: real low-to-moderate operational load.

### Monitor continuously

- API health/readiness.
- 5xx count and auth/payment/public-ordering error rates.
- Realtime update lag complaints.
- Payment/refund correctness incidents.
- QR duplicate-order complaints.

### Success criteria

- No P0 incidents (data leak, payment corruption, duplicate irreversible operations).
- No unresolved blocker for >30 minutes.
- Core flows stable across full operating day.

### Stop criteria

- Any cross-branch leakage.
- Unrecoverable payment/order integrity issue.
- Realtime outage causing operational standstill >30 minutes.
- Repeated API crash loop.

---

## 9) Failure handling guide

### API crash

- Immediate action: restart API process with same release + env.
- Fallback: POS/KDS manual refresh + hold new QR submissions if unstable.
- Escalation: release engineer + backend owner.

### DB failure / not ready

- Immediate action: verify DB service, credentials, network; check `/ready`.
- Fallback: switch to degraded mode (pause writes; keep read-only visibility where possible).
- Escalation: DBA/infra owner; restore path if not recoverable quickly.

### Payment failure

- Immediate action: verify open shift + payment endpoint response + logs.
- Fallback: manual cash receipt tracking until API restored; no silent offline write.
- Escalation: finance owner + backend owner.

### Inventory mismatch

- Immediate action: review order events + stock movements for affected orders.
- Fallback: controlled manual stock adjustment with audit note.
- Escalation: inventory owner + backend owner.

### Realtime not working

- Immediate action: verify socket origin config + auth token + gateway logs.
- Fallback: force manual refresh workflow in POS/KDS/admin.
- Escalation: backend realtime owner.

### QR ordering issue

- Immediate action: verify `/public/menu` and `/public/orders` responses + throttling/idempotency behavior.
- Fallback: disable QR entry at branch and route to POS-assisted ordering.
- Escalation: product ops + backend owner.

---

## 10) Final readiness verdict

**READY FOR CONTROLLED PILOT**

Conditions:
- Execute full smoke checklist before pilot opening.
- Keep rollback artifacts prepared before each deploy.
- Assign on-call owners for API + DB + operations during pilot window.
