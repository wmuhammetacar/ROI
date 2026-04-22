#!/usr/bin/env bash
set -euo pipefail

# ROI Phase 10 final launch smoke
# Covers: waiter -> station -> cashier -> close table -> QR waiter call -> customer package/repeat -> inventory low stock -> owner control surface

BASE_URL="${BASE_URL:-http://localhost:3002/api/v1}"
ADMIN_EMAIL="${ADMIN_EMAIL:-superadmin@roi.local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Roi!Admin2026}"
ALLOWED_IP="${ALLOWED_IP:-10.40.0.25}"
ALLOWED_CIDR="${ALLOWED_CIDR:-10.40.0.0/24}"
BLOCKED_IP="${BLOCKED_IP:-172.30.88.88}"
STAFF_PIN="${STAFF_PIN:-4321}"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required" >&2
  exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required" >&2
  exit 1
fi

ADMIN_AUTH_HEADER=""
WAITER_AUTH_HEADER=""
BRANCH_ID=""
ORIGINAL_CIDRS='[]'
RESTORE_REQUIRED=0

restore_network() {
  if [[ "$RESTORE_REQUIRED" != "1" || -z "$BRANCH_ID" || -z "$ADMIN_AUTH_HEADER" ]]; then
    return
  fi

  echo "[restore] restoring allowedNetworkCidrs"
  curl -sS -X PATCH "$BASE_URL/branches/$BRANCH_ID/network-settings" \
    -H "$ADMIN_AUTH_HEADER" \
    -H "x-forwarded-for: $ALLOWED_IP" \
    -H 'content-type: application/json' \
    -d "{\"allowedNetworkCidrs\":$ORIGINAL_CIDRS}" >/dev/null || true
}
trap restore_network EXIT

json_field() {
  local json="$1"
  local expr="$2"
  echo "$json" | jq -r "$expr"
}

echo "[1/20] Admin login"
ADMIN_LOGIN_JSON="$(curl -sS -X POST "$BASE_URL/auth/login" \
  -H "x-forwarded-for: $ALLOWED_IP" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")"
ADMIN_TOKEN="$(json_field "$ADMIN_LOGIN_JSON" '.accessToken')"
if [[ -z "$ADMIN_TOKEN" || "$ADMIN_TOKEN" == "null" ]]; then
  echo "Admin login failed" >&2
  echo "$ADMIN_LOGIN_JSON" >&2
  exit 1
fi
ADMIN_AUTH_HEADER="authorization: Bearer $ADMIN_TOKEN"

ME_JSON="$(curl -sS -X GET "$BASE_URL/users/me" -H "$ADMIN_AUTH_HEADER")"
BRANCH_ID="$(json_field "$ME_JSON" '.branchId')"
if [[ -z "$BRANCH_ID" || "$BRANCH_ID" == "null" ]]; then
  echo "Could not resolve branch from /users/me" >&2
  exit 1
fi

echo "[2/20] Capture and enforce branch network policy"
BRANCH_JSON="$(curl -sS -X GET "$BASE_URL/branches/$BRANCH_ID" -H "$ADMIN_AUTH_HEADER")"
ORIGINAL_CIDRS="$(echo "$BRANCH_JSON" | jq -c '.allowedNetworkCidrs // []')"
curl -sS -X PATCH "$BASE_URL/branches/$BRANCH_ID/network-settings" \
  -H "$ADMIN_AUTH_HEADER" \
  -H 'content-type: application/json' \
  -d "{\"allowedNetworkCidrs\":[\"$ALLOWED_CIDR\"]}" >/dev/null
RESTORE_REQUIRED=1

SUFFIX="$(date +%s)"
STAFF_USERNAME="phase10_waiter_${SUFFIX}"
STAFF_EMAIL="${STAFF_USERNAME}@roi.local"

echo "[3/20] Create waiter staff account"
CREATE_STAFF_JSON="$(curl -sS -X POST "$BASE_URL/users/staff" \
  -H "$ADMIN_AUTH_HEADER" \
  -H 'content-type: application/json' \
  -d "{\"name\":\"Phase10 Waiter\",\"username\":\"$STAFF_USERNAME\",\"email\":\"$STAFF_EMAIL\",\"branchId\":\"$BRANCH_ID\",\"roleNames\":[\"waiter\"],\"pin\":\"$STAFF_PIN\",\"isActive\":true}")"
STAFF_ID="$(json_field "$CREATE_STAFF_JSON" '.id')"
if [[ -z "$STAFF_ID" || "$STAFF_ID" == "null" ]]; then
  echo "Staff creation failed" >&2
  echo "$CREATE_STAFF_JSON" >&2
  exit 1
fi

echo "[4/20] Waiter login allowed + blocked network checks"
WAIT_LOGIN_STATUS="$(curl -sS -o /tmp/phase10_waiter_allowed.json -w "%{http_code}" -X POST "$BASE_URL/auth/staff-login" \
  -H 'content-type: application/json' \
  -H "x-forwarded-for: $ALLOWED_IP" \
  -d "{\"username\":\"$STAFF_USERNAME\",\"pin\":\"$STAFF_PIN\"}")"
if [[ "$WAIT_LOGIN_STATUS" != "200" && "$WAIT_LOGIN_STATUS" != "201" ]]; then
  echo "Allowed waiter login failed" >&2
  cat /tmp/phase10_waiter_allowed.json >&2
  exit 1
fi
WAIT_TOKEN="$(jq -r '.accessToken' /tmp/phase10_waiter_allowed.json)"
WAITER_AUTH_HEADER="authorization: Bearer $WAIT_TOKEN"

BLOCKED_STATUS="$(curl -sS -o /tmp/phase10_waiter_blocked.json -w "%{http_code}" -X POST "$BASE_URL/auth/staff-login" \
  -H 'content-type: application/json' \
  -H "x-forwarded-for: $BLOCKED_IP" \
  -d "{\"username\":\"$STAFF_USERNAME\",\"pin\":\"$STAFF_PIN\"}")"
if [[ "$BLOCKED_STATUS" != "403" ]]; then
  echo "Blocked network login did not return 403." >&2
  echo "Hint: INTERNAL_NETWORK_ENFORCE must be true (typically with NODE_ENV=production)." >&2
  cat /tmp/phase10_waiter_blocked.json >&2
  exit 1
fi

echo "[5/20] Waiter table + order + station send chain"
TABLES_JSON="$(curl -sS -X GET "$BASE_URL/tables" -H "$WAITER_AUTH_HEADER")"
TABLE_ID="$(echo "$TABLES_JSON" | jq -r '.[] | select(.status=="AVAILABLE") | .id' | head -n1)"
if [[ -z "$TABLE_ID" || "$TABLE_ID" == "null" ]]; then
  TABLE_ID="$(echo "$TABLES_JSON" | jq -r '.[0].id')"
fi
if [[ -z "$TABLE_ID" || "$TABLE_ID" == "null" ]]; then
  echo "No table found" >&2
  exit 1
fi

OPEN_SESSION_JSON="$(curl -sS -X POST "$BASE_URL/table-sessions/open" -H "$WAITER_AUTH_HEADER" -H 'content-type: application/json' -d "{\"tableId\":\"$TABLE_ID\",\"guestCount\":2}")"
SESSION_ID="$(json_field "$OPEN_SESSION_JSON" '.id // empty')"
if [[ -z "$SESSION_ID" ]]; then
  SESSION_ID="$(curl -sS -X GET "$BASE_URL/table-sessions/open/by-table/$TABLE_ID" -H "$WAITER_AUTH_HEADER" | jq -r '.id')"
fi
if [[ -z "$SESSION_ID" || "$SESSION_ID" == "null" ]]; then
  echo "Could not resolve open session" >&2
  exit 1
fi

CATALOG_JSON="$(curl -sS -X GET "$BASE_URL/catalog/pos-products?routeSafe=true" -H "$WAITER_AUTH_HEADER")"
MOJITO_ID="$(echo "$CATALOG_JSON" | jq -r '.categories[].products[] | select(.name=="Mojito") | .id' | head -n1)"
CHEESECAKE_ID="$(echo "$CATALOG_JSON" | jq -r '.categories[].products[] | select(.name=="Cheesecake") | .id' | head -n1)"
if [[ -z "$MOJITO_ID" || -z "$CHEESECAKE_ID" || "$MOJITO_ID" == "null" || "$CHEESECAKE_ID" == "null" ]]; then
  echo "Mojito and Cheesecake are required for phase10 smoke" >&2
  exit 1
fi

ORDER_JSON="$(curl -sS -X POST "$BASE_URL/orders" -H "$WAITER_AUTH_HEADER" -H 'content-type: application/json' -d "{\"serviceType\":\"DINE_IN\",\"tableSessionId\":\"$SESSION_ID\"}")"
ORDER_ID="$(json_field "$ORDER_JSON" '.id')"
if [[ -z "$ORDER_ID" || "$ORDER_ID" == "null" ]]; then
  echo "Order create failed" >&2
  echo "$ORDER_JSON" >&2
  exit 1
fi

curl -sS -X POST "$BASE_URL/orders/$ORDER_ID/items/catalog" -H "$WAITER_AUTH_HEADER" -H 'content-type: application/json' -d "{\"productId\":\"$MOJITO_ID\",\"quantity\":1}" >/dev/null
curl -sS -X POST "$BASE_URL/orders/$ORDER_ID/items/catalog" -H "$WAITER_AUTH_HEADER" -H 'content-type: application/json' -d "{\"productId\":\"$CHEESECAKE_ID\",\"quantity\":1}" >/dev/null

SEND_JSON="$(curl -sS -X POST "$BASE_URL/orders/$ORDER_ID/send" -H "$WAITER_AUTH_HEADER")"
SEND_STATUS="$(json_field "$SEND_JSON" '.status')"
if [[ "$SEND_STATUS" != "SENT_TO_STATION" ]]; then
  echo "Order not sent to station" >&2
  echo "$SEND_JSON" >&2
  exit 1
fi

TICKETS_JSON="$(curl -sS -X GET "$BASE_URL/production-tickets?orderId=$ORDER_ID" -H "$WAITER_AUTH_HEADER")"
STATION_CODES="$(echo "$TICKETS_JSON" | jq -r '.[].station.code' | sort -u | xargs)"
if [[ "$STATION_CODES" != *"BAR"* || "$STATION_CODES" != *"KITCHEN"* ]]; then
  echo "BAR/KITCHEN routing proof failed" >&2
  echo "$TICKETS_JSON" >&2
  exit 1
fi

echo "[6/20] Cashier payment chain (bill -> mixed payment -> close session)"
# Payments are allowed only after production reaches READY/SERVED/BILLED path.
# Move queued production items through IN_PROGRESS -> READY to keep this smoke aligned
# with launch-grade cashier flow guards.
TICKET_ITEM_IDS="$(echo "$TICKETS_JSON" | jq -r '.[].items[].id')"
if [[ -z "$TICKET_ITEM_IDS" ]]; then
  echo "No production ticket items found for payment readiness transition" >&2
  exit 1
fi

while IFS= read -r ticket_item_id; do
  [[ -z "$ticket_item_id" ]] && continue
  curl -sS -X PATCH "$BASE_URL/production-ticket-items/$ticket_item_id/status" \
    -H "$WAITER_AUTH_HEADER" \
    -H 'content-type: application/json' \
    -d '{"status":"IN_PROGRESS"}' >/dev/null
  curl -sS -X PATCH "$BASE_URL/production-ticket-items/$ticket_item_id/status" \
    -H "$WAITER_AUTH_HEADER" \
    -H 'content-type: application/json' \
    -d '{"status":"READY"}' >/dev/null
done <<< "$TICKET_ITEM_IDS"

ORDER_READY_JSON="$(curl -sS -X GET "$BASE_URL/orders/$ORDER_ID" -H "$WAITER_AUTH_HEADER")"
ORDER_READY_STATUS="$(json_field "$ORDER_READY_JSON" '.status')"
if [[ "$ORDER_READY_STATUS" != "READY" && "$ORDER_READY_STATUS" != "SERVED" && "$ORDER_READY_STATUS" != "BILLED" && "$ORDER_READY_STATUS" != "PAID" ]]; then
  echo "Order did not reach cashier-payable status after production progression" >&2
  echo "$ORDER_READY_JSON" >&2
  exit 1
fi

OPEN_SHIFT_JSON="$(curl -sS -X GET "$BASE_URL/register-shifts/open/current" -H "$ADMIN_AUTH_HEADER")"
SHIFT_ID="$(json_field "$OPEN_SHIFT_JSON" '.id // empty')"
if [[ -z "$SHIFT_ID" || "$SHIFT_ID" == "null" ]]; then
  OPEN_SHIFT_JSON="$(curl -sS -X POST "$BASE_URL/register-shifts/open" -H "$ADMIN_AUTH_HEADER" -H 'content-type: application/json' -d '{"openingCashAmount":500}')"
  SHIFT_ID="$(json_field "$OPEN_SHIFT_JSON" '.id')"
fi
if [[ -z "$SHIFT_ID" || "$SHIFT_ID" == "null" ]]; then
  echo "Could not resolve open register shift" >&2
  echo "$OPEN_SHIFT_JSON" >&2
  exit 1
fi

BILL_JSON="$(curl -sS -X POST "$BASE_URL/orders/$ORDER_ID/bill" -H "$ADMIN_AUTH_HEADER")"
ORDER_TOTAL="$(echo "$BILL_JSON" | jq -r '.financial.grandTotal // "0"')"
if [[ -z "$ORDER_TOTAL" || "$ORDER_TOTAL" == "null" || "$ORDER_TOTAL" == "0" ]]; then
  echo "Bill response did not return a valid financial.grandTotal" >&2
  echo "$BILL_JSON" >&2
  exit 1
fi

PAY_SPLIT_JSON="$(python3 - <<'PY' "$ORDER_TOTAL"
import sys
from decimal import Decimal, ROUND_HALF_UP
total = Decimal(sys.argv[1])
if total <= Decimal('0'):
    print('{"first":"0.01","second":"0.01"}')
    raise SystemExit
first = (total / 2).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
if first <= Decimal('0'):
    first = Decimal('0.01')
second = (total - first).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
if second <= Decimal('0'):
    second = Decimal('0.01')
print('{"first":"%s","second":"%s"}' % (first, second))
PY
)"
PAY1="$(echo "$PAY_SPLIT_JSON" | jq -r '.first')"
PAY2="$(echo "$PAY_SPLIT_JSON" | jq -r '.second')"

PAY1_JSON="$(curl -sS -X POST "$BASE_URL/orders/$ORDER_ID/payments" -H "$ADMIN_AUTH_HEADER" -H 'content-type: application/json' -d "{\"registerShiftId\":\"$SHIFT_ID\",\"paymentMethod\":\"CASH\",\"amount\":$PAY1,\"notes\":\"phase10 cash split\"}")"
PAY2_JSON="$(curl -sS -X POST "$BASE_URL/orders/$ORDER_ID/payments" -H "$ADMIN_AUTH_HEADER" -H 'content-type: application/json' -d "{\"registerShiftId\":\"$SHIFT_ID\",\"paymentMethod\":\"CARD\",\"amount\":$PAY2,\"notes\":\"phase10 card split\"}")"
PAY1_ID="$(echo "$PAY1_JSON" | jq -r '.payment.id // empty')"
PAY2_ID="$(echo "$PAY2_JSON" | jq -r '.payment.id // empty')"
if [[ -z "$PAY1_ID" || -z "$PAY2_ID" ]]; then
  echo "Payment create failed in mixed settlement chain" >&2
  echo "$PAY1_JSON" >&2
  echo "$PAY2_JSON" >&2
  exit 1
fi

ORDER_AFTER_PAYMENT="$(curl -sS -X GET "$BASE_URL/orders/$ORDER_ID" -H "$ADMIN_AUTH_HEADER")"
ORDER_STATUS_AFTER_PAYMENT="$(json_field "$ORDER_AFTER_PAYMENT" '.status')"
if [[ "$ORDER_STATUS_AFTER_PAYMENT" != "PAID" ]]; then
  echo "Order did not reach PAID after mixed payment" >&2
  echo "$ORDER_AFTER_PAYMENT" >&2
  exit 1
fi

CLOSE_SESSION_JSON="$(curl -sS -X POST "$BASE_URL/table-sessions/$SESSION_ID/close" -H "$ADMIN_AUTH_HEADER")"
SESSION_STATUS="$(json_field "$CLOSE_SESSION_JSON" '.status')"
if [[ "$SESSION_STATUS" != "CLOSED" ]]; then
  echo "Session close failed" >&2
  echo "$CLOSE_SESSION_JSON" >&2
  exit 1
fi

echo "[7/20] Public QR menu + waiter call + boundary check"
PUBLIC_MENU_STATUS="$(curl -sS -o /tmp/phase10_public_menu.json -w "%{http_code}" -X GET "$BASE_URL/public/menu?branchId=$BRANCH_ID" -H "x-forwarded-for: $BLOCKED_IP")"
if [[ "$PUBLIC_MENU_STATUS" != "200" ]]; then
  echo "Public menu not accessible" >&2
  cat /tmp/phase10_public_menu.json >&2
  exit 1
fi

PUBLIC_CALL_JSON="$(curl -sS -X POST "$BASE_URL/public/waiter-calls" -H 'content-type: application/json' -H "x-forwarded-for: $BLOCKED_IP" -d "{\"branchId\":\"$BRANCH_ID\",\"tableId\":\"$TABLE_ID\",\"callType\":\"WAITER\",\"note\":\"phase10 qr waiter call\"}")"
PUBLIC_CALL_ID="$(json_field "$PUBLIC_CALL_JSON" '.id')"
if [[ -z "$PUBLIC_CALL_ID" || "$PUBLIC_CALL_ID" == "null" ]]; then
  echo "Public waiter call create failed" >&2
  echo "$PUBLIC_CALL_JSON" >&2
  exit 1
fi

CALLS_JSON="$(curl -sS -X GET "$BASE_URL/waiter-calls" -H "$ADMIN_AUTH_HEADER")"
CALL_FOUND="$(echo "$CALLS_JSON" | jq --arg id "$PUBLIC_CALL_ID" 'any(.[]; .id==$id)')"
if [[ "$CALL_FOUND" != "true" ]]; then
  echo "Operational waiter call record not found" >&2
  exit 1
fi

echo "[8/20] Customer package desk chain (search/create/start/repeat)"
PHONE="+90555${SUFFIX: -7}"
SEARCH_JSON="$(curl -sS -G "$BASE_URL/customers" -H "$ADMIN_AUTH_HEADER" --data-urlencode "q=$PHONE")"
SEARCH_COUNT="$(echo "$SEARCH_JSON" | jq -r 'length')"
if [[ "$SEARCH_COUNT" != "0" ]]; then
  echo "Expected empty initial customer search" >&2
  exit 1
fi

CUSTOMER_JSON="$(curl -sS -X POST "$BASE_URL/customers" -H "$ADMIN_AUTH_HEADER" -H 'content-type: application/json' -d "{\"fullName\":\"Phase10 Customer $SUFFIX\",\"phonePrimary\":\"$PHONE\"}")"
CUSTOMER_ID="$(json_field "$CUSTOMER_JSON" '.id')"
if [[ -z "$CUSTOMER_ID" || "$CUSTOMER_ID" == "null" ]]; then
  echo "Customer create failed" >&2
  echo "$CUSTOMER_JSON" >&2
  exit 1
fi

START_ORDER_JSON="$(curl -sS -X POST "$BASE_URL/customers/$CUSTOMER_ID/start-order" -H "$ADMIN_AUTH_HEADER" -H 'content-type: application/json' -d '{"serviceType":"TAKEAWAY","notes":"phase10 package start"}')"
PKG_ORDER_ID="$(json_field "$START_ORDER_JSON" '.id')"
if [[ -z "$PKG_ORDER_ID" || "$PKG_ORDER_ID" == "null" ]]; then
  echo "Customer start-order failed" >&2
  echo "$START_ORDER_JSON" >&2
  exit 1
fi

curl -sS -X POST "$BASE_URL/orders/$PKG_ORDER_ID/items/catalog" -H "$ADMIN_AUTH_HEADER" -H 'content-type: application/json' -d "{\"productId\":\"$MOJITO_ID\",\"quantity\":1}" >/dev/null
HISTORY_JSON="$(curl -sS -X GET "$BASE_URL/customers/$CUSTOMER_ID/orders" -H "$ADMIN_AUTH_HEADER")"
SOURCE_ORDER_ID="$(echo "$HISTORY_JSON" | jq -r '.[0].id')"
REPEAT_JSON="$(curl -sS -X POST "$BASE_URL/customers/$CUSTOMER_ID/repeat-order/$SOURCE_ORDER_ID" -H "$ADMIN_AUTH_HEADER" -H 'content-type: application/json' -d '{"notes":"phase10 repeat"}')"
REPEAT_ORDER_ID="$(json_field "$REPEAT_JSON" '.order.id')"
COPIED_COUNT="$(json_field "$REPEAT_JSON" '.copiedCount')"
if [[ -z "$REPEAT_ORDER_ID" || "$REPEAT_ORDER_ID" == "null" || "$COPIED_COUNT" == "0" ]]; then
  echo "Repeat order failed" >&2
  echo "$REPEAT_JSON" >&2
  exit 1
fi

ORDER_LIST_JSON="$(curl -sS -G "$BASE_URL/orders" -H "$ADMIN_AUTH_HEADER" --data-urlencode "serviceType=TAKEAWAY" --data-urlencode "limit=30")"
HAS_REPEAT="$(echo "$ORDER_LIST_JSON" | jq --arg id "$REPEAT_ORDER_ID" 'any(.[]; .id==$id)')"
if [[ "$HAS_REPEAT" != "true" ]]; then
  echo "Repeated takeaway order not visible in orders flow" >&2
  exit 1
fi

echo "[9/20] Inventory low-stock visibility"
UNIT_JSON="$(curl -sS -X POST "$BASE_URL/units" -H "$ADMIN_AUTH_HEADER" -H 'content-type: application/json' -d "{\"name\":\"Phase10 Unit $SUFFIX\",\"code\":\"P10U$SUFFIX\",\"kind\":\"WEIGHT\"}")"
UNIT_ID="$(json_field "$UNIT_JSON" '.id')"
ING_JSON="$(curl -sS -X POST "$BASE_URL/ingredients" -H "$ADMIN_AUTH_HEADER" -H 'content-type: application/json' -d "{\"name\":\"Phase10 Ingredient $SUFFIX\",\"sku\":\"P10I$SUFFIX\",\"unitId\":\"$UNIT_ID\",\"currentStock\":2,\"lowStockThreshold\":5}")"
ING_ID="$(json_field "$ING_JSON" '.id')"
INV_SUMMARY_JSON="$(curl -sS -X GET "$BASE_URL/inventory/summary?activeOnly=true&limit=500" -H "$ADMIN_AUTH_HEADER")"
LOW_STOCK_FOUND="$(echo "$INV_SUMMARY_JSON" | jq --arg id "$ING_ID" 'any(.items[]; .id==$id and .isLowStock==true)')"
if [[ "$LOW_STOCK_FOUND" != "true" ]]; then
  echo "Low stock ingredient not visible in inventory summary" >&2
  exit 1
fi

echo "[10/20] Owner control surface data chain + branch safety"
REPORTS_DASH_JSON="$(curl -sS -X GET "$BASE_URL/reports/dashboard-summary?branchId=$BRANCH_ID" -H "$ADMIN_AUTH_HEADER")"
OPS_JSON="$(curl -sS -X GET "$BASE_URL/operations/overview?branchId=$BRANCH_ID&orderLimit=150" -H "$ADMIN_AUTH_HEADER")"
INV_JSON="$(curl -sS -X GET "$BASE_URL/inventory/summary?branchId=$BRANCH_ID&activeOnly=true&limit=500" -H "$ADMIN_AUTH_HEADER")"

TODAY_REVENUE="$(json_field "$OPS_JSON" '.salesSnapshot.todayRevenue')"
UNPAID_AMOUNT="$(json_field "$OPS_JSON" '.salesSnapshot.activeUnpaidAmount')"
PAYMENT_MIX_COUNT="$(echo "$REPORTS_DASH_JSON" | jq -r '.paymentMixSnapshot.totalsByPaymentMethod | length')"
LIVE_ORDER_COUNT="$(json_field "$OPS_JSON" '.salesSnapshot.openOrderCount')"
ACTIVE_TABLE_COUNT="$(echo "$OPS_JSON" | jq -r '[.tables[] | select(.openSessionId != null)] | length')"
BAR_QUEUED="$(json_field "$OPS_JSON" '.kitchenBarStatus.BAR.queued')"
KITCHEN_QUEUED="$(json_field "$OPS_JSON" '.kitchenBarStatus.KITCHEN.queued')"
LOW_STOCK_COUNT="$(json_field "$INV_JSON" '.lowStockCount')"

for must_have in TODAY_REVENUE UNPAID_AMOUNT PAYMENT_MIX_COUNT LIVE_ORDER_COUNT ACTIVE_TABLE_COUNT BAR_QUEUED KITCHEN_QUEUED LOW_STOCK_COUNT; do
  val="${!must_have}"
  if [[ -z "$val" || "$val" == "null" ]]; then
    echo "Missing owner metric: $must_have" >&2
    exit 1
  fi
done

# Branch-safe override rejection proof
BAD_SCOPE_STATUS="$(curl -sS -o /tmp/phase10_bad_scope.json -w "%{http_code}" -X GET "$BASE_URL/reports/dashboard-summary?branchId=c_invalid_scope_phase10" -H "$ADMIN_AUTH_HEADER")"
if [[ "$BAD_SCOPE_STATUS" != "400" ]]; then
  echo "Expected invalid branch override to be rejected" >&2
  cat /tmp/phase10_bad_scope.json >&2
  exit 1
fi

echo
echo "Phase 10 launch smoke OK"
echo "- Branch: $BRANCH_ID"
echo "- Waiter user: $STAFF_USERNAME ($STAFF_ID)"
echo "- Waiter login allowed: $WAIT_LOGIN_STATUS"
echo "- Waiter login blocked: $BLOCKED_STATUS"
echo "- Public menu status: $PUBLIC_MENU_STATUS"
echo "- Table session: $SESSION_ID (closed)"
echo "- Dine-in order: $ORDER_ID (status $ORDER_STATUS_AFTER_PAYMENT)"
echo "- Routing stations: $STATION_CODES"
echo "- Mixed payments: CASH $PAY1 + CARD $PAY2"
echo "- Public waiter call id: $PUBLIC_CALL_ID"
echo "- Package order id: $PKG_ORDER_ID"
echo "- Repeated order id: $REPEAT_ORDER_ID (copied $COPIED_COUNT items)"
echo "- Low stock ingredient id: $ING_ID"
echo "- Owner metrics: revenue=$TODAY_REVENUE unpaid=$UNPAID_AMOUNT openOrders=$LIVE_ORDER_COUNT activeTables=$ACTIVE_TABLE_COUNT lowStock=$LOW_STOCK_COUNT"
