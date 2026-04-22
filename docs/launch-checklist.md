# ROI Final Launch Checklist (Phase 10)

Use this checklist before opening a controlled pilot venue.

## 1) Environment and startup

- [ ] `.env` configured with production-safe values
- [ ] `NODE_ENV=production`
- [ ] `INTERNAL_NETWORK_ENFORCE=true`
- [ ] `CORS_ORIGINS` and `REALTIME_ALLOWED_ORIGINS` set correctly
- [ ] `DATABASE_URL` reachable from API runtime

## 2) Build and migrate

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm run build`
- [ ] `pnpm run prisma:deploy`
- [ ] API process starts and serves `/api/v1/health` and `/api/v1/ready`

## 3) Launch smoke (mandatory)

- [ ] `bash scripts/smoke/phase10-launch-smoke.sh` succeeds

Must include success for:
- waiter allowed network login
- waiter blocked network login
- table -> order -> BAR/KITCHEN station routing
- cashier mixed payment and session close
- public QR menu access and waiter-call create
- customer desk start/repeat takeaway chain
- inventory low-stock visibility
- owner dashboard data chain visibility

## 4) Operator readiness

- [ ] on-duty users prepared: admin, manager/cashier, waiter
- [ ] printer routing preview validated for BAR and KITCHEN
- [ ] branch network CIDR allow-list verified
- [ ] shift opening and payment workflow rehearsed
- [ ] fallback actions reviewed from `docs/operations-runbook.md`

## 5) Stop conditions (pilot must not open)

- [ ] any smoke step fails
- [ ] network boundary not enforced for internal routes
- [ ] payment close chain broken (order unpaid/session not closable)
- [ ] public QR path unavailable
- [ ] owner control surface metrics unavailable or branch scope mismatched
