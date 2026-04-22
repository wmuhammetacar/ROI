# ROI Operations Runbook (Foundation)

## Scope

This document defines minimum production operations discipline for ROI:

- API/runtime health checks
- backup/restore expectations
- critical data protection priorities
- first-response troubleshooting steps

## Critical Data to Protect

1. Authentication/authorization data (users, roles, permissions)
2. Branch configuration and routing metadata
3. Catalog/pricing/modifier definitions
4. Orders, production tickets, payment transactions, refunds, shifts
5. Inventory stock movements, waste records, recipe mappings
6. Integration configs, menu mappings, external order records, sync attempts
7. Audit logs

## Health and Readiness

- Liveness: `GET /api/v1/health`
- Readiness: `GET /api/v1/ready` (includes DB readiness check)

If readiness fails:

1. Check DB connectivity and credentials (`DATABASE_URL`)
2. Check API logs for startup/runtime exceptions
3. Verify DB schema sync (`prisma migrate deploy` or controlled `db push`)

## Backup Expectations

Minimum expectation: daily PostgreSQL backups + retention policy.

- Full logical backup (`pg_dump`) at least daily
- WAL/point-in-time strategy recommended for production-critical environments
- Off-host/off-site backup storage required
- Encryption at rest and restricted backup access

Suggested metadata to track per backup:

- timestamp
- DB host/cluster identifier
- schema version / git commit
- size
- checksum

## Restore Expectations

Restore procedures must be tested regularly in non-production.

Minimum restore drill:

1. Restore latest backup into isolated DB
2. Run API against restored DB
3. Verify:
   - admin login
   - core read flows (catalog/orders/payments/reporting)
   - readiness endpoint
4. Record RTO/RPO outcomes and issues

## Incident Triage (Quick)

1. Confirm service status:
   - `/api/v1/health`
   - `/api/v1/ready`
2. Check recent error logs by `requestId`
3. Validate DB availability and connection pool saturation
4. Validate CORS/realtime origin config drift
5. If auth/public endpoints fail, inspect throttling and validation errors
6. Communicate blast radius (admin/pos/kds/qr impact)

## Launch-Critical Failure Playbooks

### 1) Printer issue / route missing

- Symptom: send-to-station fails or production output not visible on expected station printer.
- Immediate checks:
  1. `GET /api/v1/printers/routing/preview?productId=:id`
  2. verify selected printer is active and station-mapped
  3. verify station code resolves as expected (`BAR` / `KITCHEN`)
- Recovery:
  - activate/assign a primary printer for the affected station
  - if no station printer exists, assign fallback printer and re-run preview

### 2) Network denial (internal apps)

- Symptom: staff/admin login blocked with `403` from internal endpoints.
- Immediate checks:
  1. validate source IP and `x-forwarded-for` handling in edge/proxy
  2. inspect branch `allowedNetworkCidrs`
- Recovery:
  - correct branch network settings (`PATCH /branches/:id/network-settings`)
  - confirm blocked internal endpoints remain blocked for disallowed IPs
  - confirm public routes (QR/menu) remain reachable

### 3) Payment blocked / shift missing

- Symptom: payment create fails due to register shift constraints.
- Immediate checks:
  1. `GET /api/v1/register-shifts/open/current`
  2. ensure order is billed before payment
- Recovery:
  - open shift (`POST /register-shifts/open`)
  - retry payment
  - verify mixed payment path and final `PAID` order status

### 4) Inventory mismatch / low stock

- Symptom: unexpected stock risk or waste/adjust mismatch.
- Immediate checks:
  1. ingredient detail (`GET /ingredients/:id/detail`)
  2. stock movements (`GET /ingredients/:id/stock-movements`)
  3. waste records (`GET /ingredients/:id/waste-records`)
- Recovery:
  - apply manual stock adjustment with reason
  - record waste/fire explicitly
  - verify low-stock threshold and `isLowStock` state in summary

### 5) QR menu / public waiter call issue

- Symptom: customer cannot load menu or waiter call not visible operationally.
- Immediate checks:
  1. `GET /api/v1/public/menu?branchId=:id`
  2. `POST /api/v1/public/waiter-calls`
  3. `GET /api/v1/waiter-calls` (internal visibility)
- Recovery:
  - validate branch/table IDs used by QR context
  - confirm public throttling and CORS are not misconfigured
  - ensure waiter-call panel consumption is active in operations UI

## Audit Log Retention (Minimum)

- Keep audit logs for a defined retention window (for example 90 days hot storage + archive).
- Periodically archive/purge old rows with a scheduled DB job to prevent unbounded table growth.
- Protect archived logs with the same access controls as primary production data.
