# ROI Phase 3 Closure Smoke Proof

This smoke proves the unresolved Phase 3 chain with executable runtime steps.

## Run command

```bash
BASE_URL=http://localhost:3002/api/v1 \
ADMIN_EMAIL=superadmin@roi.local \
ADMIN_PASSWORD='Roi!Admin2026' \
ALLOWED_IP=10.40.0.25 \
ALLOWED_CIDR=10.40.0.0/24 \
BLOCKED_IP=172.30.88.88 \
bash scripts/smoke/phase3-closure-smoke.sh
```

## Exact endpoint sequence

1. `POST /auth/login` (admin bootstrap token)
2. `GET /users/me` (resolve branch context)
3. `GET /stations` (BAR + KITCHEN station IDs)
4. `POST /users/staff` (create waiter/staff account)
5. `POST /printers` (create BAR primary printer, explicit priority)
6. `POST /printers` (create KITCHEN primary printer, explicit priority)
7. `GET /catalog/pos-products?routeSafe=true` (resolve Mojito/Cheesecake IDs)
8. `GET /printers/routing/preview?productId=:mojitoId`
9. `GET /printers/routing/preview?productId=:cheesecakeId`
10. `GET /branches/:branchId` (capture current CIDR config)
11. `PATCH /branches/:branchId/network-settings` (set allowed CIDR)
12. `POST /auth/staff-login` with allowed `x-forwarded-for` IP
13. `POST /auth/staff-login` with blocked `x-forwarded-for` IP
14. `GET /public-ordering/menu?branchId=:branchId` with blocked IP
15. `PATCH /branches/:branchId/network-settings` (restore original CIDRs)

## Expected proof outcomes

- Staff create succeeds (active waiter account created).
- Route preview returns:
  - Mojito station code = `BAR`, selected printer = BAR primary printer
  - Cheesecake station code = `KITCHEN`, selected printer = KITCHEN primary printer
- Staff login with allowed IP returns `200/201`.
- Staff login with blocked IP returns `403`.
- Public QR menu endpoint remains reachable (`200`) even from blocked IP.
- Network CIDR settings are restored at script exit.

## Selection policy proof target

`/printers/routing/preview` now returns `selectionPolicy: "priority_asc_then_createdAt"` and includes candidate priorities.

This matches backend routing behavior used by production printer dispatch.
