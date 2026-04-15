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

