# ROI Phase 10 Final Launch Smoke Proof

This smoke is the launch-grade cross-module chain before controlled pilot rollout.

## Run command

```bash
BASE_URL=http://localhost:3002/api/v1 \
ADMIN_EMAIL=superadmin@roi.local \
ADMIN_PASSWORD='Roi!Admin2026' \
ALLOWED_IP=10.40.0.25 \
ALLOWED_CIDR=10.40.0.0/24 \
BLOCKED_IP=172.30.88.88 \
STAFF_PIN=4321 \
bash scripts/smoke/phase10-launch-smoke.sh
```

## Covered launch chains

1. Waiter login from allowed network and blocked network rejection
2. Waiter table open -> order create -> catalog item add -> send to station
3. BAR/KITCHEN routing proof via production tickets
4. Cashier chain: bill -> mixed payment (cash+card) -> order paid -> table session close
5. QR public menu accessibility (even from blocked internal IP)
6. QR public waiter call creation and operational waiter-call visibility
7. Customer desk chain: search/create -> start takeaway -> repeat order -> order visibility
8. Inventory chain: low-stock ingredient creation + summary visibility
9. Owner control surface chain: revenue/unpaid/payment mix/load/pressure/stock metrics present
10. Branch-scope safety: invalid branch override rejected

## Exact high-risk endpoints used

- Auth/network: `POST /auth/login`, `POST /auth/staff-login`, `PATCH /branches/:id/network-settings`
- Waiter/order: `POST /table-sessions/open`, `POST /orders`, `POST /orders/:id/items/catalog`, `POST /orders/:id/send`
- Routing: `GET /production-tickets?orderId=:id`
- Cashier/payment: `POST /orders/:id/bill`, `POST /orders/:id/payments`, `POST /table-sessions/:id/close`
- Public boundary: `GET /public/menu`, `POST /public/waiter-calls`, `GET /waiter-calls`
- Customer/package: `GET /customers`, `POST /customers`, `POST /customers/:id/start-order`, `POST /customers/:id/repeat-order/:orderId`
- Inventory: `POST /units`, `POST /ingredients`, `GET /inventory/summary`
- Owner surface data: `GET /reports/dashboard-summary`, `GET /operations/overview`, `GET /inventory/summary`

## Launch gate expectations

The smoke **must** produce:

- waiter allowed login success (`200/201`)
- waiter blocked login (`403`)
- public menu still reachable (`200`)
- dine-in order reaches `SENT_TO_STATION`, then `PAID`, then session `CLOSED`
- production ticket stations include both `BAR` and `KITCHEN`
- customer repeat order returns a fresh order with `copiedCount > 0`
- low-stock ingredient appears with `isLowStock=true`
- owner metrics are non-null and branch-scoped
- invalid branch override returns validation/forbidden error

If any of these fails, **launch is blocked** until resolved.
