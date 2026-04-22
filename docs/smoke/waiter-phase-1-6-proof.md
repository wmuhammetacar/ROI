# ROI Phase 1.6 Waiter Smoke Proof

This proof targets the rejected gaps from Phase 1.5:
- Route-safe waiter catalog
- Canonical catalog item update path
- Concrete waiter operational smoke

## Run command

```bash
BASE_URL=http://localhost:3002/api/v1 \
WAITER_EMAIL=waiter@roi.local \
WAITER_PASSWORD='Roi!Waiter2026' \
bash scripts/smoke/waiter-phase-1-6.sh
```

## Exact endpoint sequence used

1. `POST /auth/login`
2. `GET /tables`
3. `POST /table-sessions/open` (fallback: `GET /table-sessions/open/by-table/:tableId`)
4. `GET /catalog/pos-products?routeSafe=true`
5. `POST /orders`
6. `POST /orders/:orderId/items/catalog` (Mojito)
7. `POST /orders/:orderId/items/catalog` (Cheesecake + variant/modifiers if required)
8. `PATCH /orders/:orderId/items/:itemId/catalog` (quantity increase)
9. `POST /orders/:orderId/send`
10. `GET /orders/:orderId`
11. `GET /production-tickets?orderId=:orderId`

## Expected state and UI behavior proof points

- Route-safe catalog request (`routeSafe=true`) returns only active+available+station-routed products.
- Waiter can add products from category rail/grid without discovering route failures at send time.
- Quantity increment uses canonical catalog endpoint (`PATCH .../catalog`).
- Config update uses canonical catalog endpoint (`PATCH .../catalog`).
- Order transitions to `SENT_TO_STATION` after send.
- Waiter UI reflects non-editable state once sent (`DRAFT/PLACED` editable, sent status locked).
- Production tickets include station codes proving routing:
  - Mojito resolves to `BAR`
  - Cheesecake resolves to `KITCHEN`

## Backend routing proof expectation

After send, `GET /production-tickets?orderId=:orderId` must return tickets with station codes containing `BAR` and `KITCHEN` for the scenario items.

If either station code is missing, route mapping is not correctly configured for branch products.
