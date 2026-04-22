#!/usr/bin/env bash
set -euo pipefail

# ROI Phase 1.6 waiter smoke flow
# Requires: curl, jq

BASE_URL="${BASE_URL:-http://localhost:3002/api/v1}"
WAITER_EMAIL="${WAITER_EMAIL:-waiter@roi.local}"
WAITER_PASSWORD="${WAITER_PASSWORD:-Roi!Waiter2026}"
TABLE_NAME="${TABLE_NAME:-Masa 1}"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required" >&2
  exit 1
fi

echo "[1/10] Login"
TOKEN="$(curl -sS -X POST "$BASE_URL/auth/login" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$WAITER_EMAIL\",\"password\":\"$WAITER_PASSWORD\"}" | jq -r '.accessToken')"

if [[ -z "$TOKEN" || "$TOKEN" == "null" ]]; then
  echo "Login failed" >&2
  exit 1
fi
AUTH_HEADER="authorization: Bearer $TOKEN"

echo "[2/10] Select table"
TABLES_JSON="$(curl -sS -X GET "$BASE_URL/tables" -H "$AUTH_HEADER")"
TABLE_ID="$(echo "$TABLES_JSON" | jq -r --arg name "$TABLE_NAME" '.[] | select(.name==$name) | .id' | head -n1)"
if [[ -z "$TABLE_ID" ]]; then
  TABLE_ID="$(echo "$TABLES_JSON" | jq -r '.[0].id')"
fi
if [[ -z "$TABLE_ID" || "$TABLE_ID" == "null" ]]; then
  echo "No table found" >&2
  exit 1
fi

echo "[3/10] Open/select table session"
OPEN_SESSION_RESP="$(curl -sS -X POST "$BASE_URL/table-sessions/open" -H "$AUTH_HEADER" -H 'content-type: application/json' -d "{\"tableId\":\"$TABLE_ID\",\"guestCount\":2}")"
SESSION_ID="$(echo "$OPEN_SESSION_RESP" | jq -r '.id // empty')"
if [[ -z "$SESSION_ID" ]]; then
  SESSION_ID="$(curl -sS -X GET "$BASE_URL/table-sessions/open/by-table/$TABLE_ID" -H "$AUTH_HEADER" | jq -r '.id')"
fi
if [[ -z "$SESSION_ID" || "$SESSION_ID" == "null" ]]; then
  echo "Could not resolve open session" >&2
  exit 1
fi

echo "[4/10] Load route-safe catalog and pick category/products"
CATALOG_JSON="$(curl -sS -X GET "$BASE_URL/catalog/pos-products?routeSafe=true" -H "$AUTH_HEADER")"
CATEGORY_ID="$(echo "$CATALOG_JSON" | jq -r '.categories[0].id')"
if [[ -z "$CATEGORY_ID" || "$CATEGORY_ID" == "null" ]]; then
  echo "No route-safe category found" >&2
  exit 1
fi
MOJITO_PRODUCT_ID="$(echo "$CATALOG_JSON" | jq -r '.categories[].products[] | select(.name=="Mojito") | .id' | head -n1)"
CHEESECAKE_PRODUCT_ID="$(echo "$CATALOG_JSON" | jq -r '.categories[].products[] | select(.name=="Cheesecake") | .id' | head -n1)"
if [[ -z "$MOJITO_PRODUCT_ID" || "$MOJITO_PRODUCT_ID" == "null" ]]; then
  MOJITO_PRODUCT_ID="$(echo "$CATALOG_JSON" | jq -r '.categories[].products[0].id' | head -n1)"
fi
if [[ -z "$CHEESECAKE_PRODUCT_ID" || "$CHEESECAKE_PRODUCT_ID" == "null" ]]; then
  CHEESECAKE_PRODUCT_ID="$(echo "$CATALOG_JSON" | jq -r '.categories[].products[1].id' | head -n1)"
fi

if [[ -z "$MOJITO_PRODUCT_ID" || "$MOJITO_PRODUCT_ID" == "null" || -z "$CHEESECAKE_PRODUCT_ID" || "$CHEESECAKE_PRODUCT_ID" == "null" ]]; then
  echo "Could not resolve two products from route-safe catalog" >&2
  exit 1
fi

echo "[5/10] Create order"
ORDER_JSON="$(curl -sS -X POST "$BASE_URL/orders" -H "$AUTH_HEADER" -H 'content-type: application/json' -d "{\"serviceType\":\"DINE_IN\",\"tableSessionId\":\"$SESSION_ID\"}")"
ORDER_ID="$(echo "$ORDER_JSON" | jq -r '.id')"
if [[ -z "$ORDER_ID" || "$ORDER_ID" == "null" ]]; then
  echo "Order creation failed" >&2
  exit 1
fi

echo "[6/10] Add Mojito (BAR-mapped on backend)"
ADD_MOJITO_RESP="$(curl -sS -X POST "$BASE_URL/orders/$ORDER_ID/items/catalog" -H "$AUTH_HEADER" -H 'content-type: application/json' -d "{\"productId\":\"$MOJITO_PRODUCT_ID\",\"quantity\":1}")"
MOJITO_ITEM_ID="$(echo "$ADD_MOJITO_RESP" | jq -r '.items[] | select(.productId=="'$MOJITO_PRODUCT_ID'") | .id' | head -n1)"

echo "[7/10] Add Cheesecake (KITCHEN-mapped on backend) with optional config"
CHEESECAKE_NODE="$(echo "$CATALOG_JSON" | jq -c '.categories[].products[] | select(.id=="'$CHEESECAKE_PRODUCT_ID'")' | head -n1)"
CHEESECAKE_VARIANT_ID="$(echo "$CHEESECAKE_NODE" | jq -r '(.variants // []) | map(select(.isActive==true)) | .[0].id // empty')"
CHEESECAKE_MODIFIERS="$(echo "$CHEESECAKE_NODE" | jq -c '[.modifierGroupLinks[]? | . as $link | (if $link.isRequired then (($link.modifierGroup.minSelect // 0) | if . < 1 then 1 else . end) else 0 end) as $need | {modifierGroupId: $link.modifierGroup.id, optionIds: (($link.modifierGroup.options // []) | map(select(.isActive==true)) | .[:$need] | map(.id))} | select((.optionIds | length) > 0)]')"

ADD_CHEESECAKE_PAYLOAD="$(jq -n --arg productId "$CHEESECAKE_PRODUCT_ID" --arg variantId "$CHEESECAKE_VARIANT_ID" --argjson modifiers "$CHEESECAKE_MODIFIERS" '{productId:$productId, quantity:1} + (if $variantId=="" then {} else {variantId:$variantId} end) + (if ($modifiers|length)==0 then {} else {modifierSelections:$modifiers} end)')"
ADD_CHEESECAKE_RESP="$(curl -sS -X POST "$BASE_URL/orders/$ORDER_ID/items/catalog" -H "$AUTH_HEADER" -H 'content-type: application/json' -d "$ADD_CHEESECAKE_PAYLOAD")"
CHEESECAKE_ITEM_ID="$(echo "$ADD_CHEESECAKE_RESP" | jq -r '.items[] | select(.productId=="'$CHEESECAKE_PRODUCT_ID'") | .id' | head -n1)"

if [[ -z "$CHEESECAKE_ITEM_ID" || "$CHEESECAKE_ITEM_ID" == "null" ]]; then
  echo "Cheesecake add failed" >&2
  exit 1
fi

echo "[8/10] Increase quantity on catalog line"
curl -sS -X PATCH "$BASE_URL/orders/$ORDER_ID/items/$CHEESECAKE_ITEM_ID/catalog" -H "$AUTH_HEADER" -H 'content-type: application/json' -d '{"quantity":2}' >/dev/null

echo "[9/10] Send order"
SEND_RESP="$(curl -sS -X POST "$BASE_URL/orders/$ORDER_ID/send" -H "$AUTH_HEADER")"
STATUS_AFTER_SEND="$(echo "$SEND_RESP" | jq -r '.status')"
if [[ "$STATUS_AFTER_SEND" != "SENT_TO_STATION" ]]; then
  echo "Order did not reach SENT_TO_STATION" >&2
  echo "$SEND_RESP" >&2
  exit 1
fi

echo "[10/10] Confirm locked/sent state and BAR/KITCHEN routing"
ORDER_AFTER="$(curl -sS -X GET "$BASE_URL/orders/$ORDER_ID" -H "$AUTH_HEADER")"
FINAL_STATUS="$(echo "$ORDER_AFTER" | jq -r '.status')"
if [[ "$FINAL_STATUS" != "SENT_TO_STATION" ]]; then
  echo "Order status mismatch after send" >&2
  exit 1
fi

TICKETS="$(curl -sS -X GET "$BASE_URL/production-tickets?orderId=$ORDER_ID" -H "$AUTH_HEADER")"
STATION_CODES="$(echo "$TICKETS" | jq -r '.[].station.code' | sort -u | xargs)"

echo "\nSmoke OK"
echo "Order: $ORDER_ID"
echo "Session: $SESSION_ID"
echo "Route-safe category used: $CATEGORY_ID"
echo "Station codes in production tickets: $STATION_CODES"
