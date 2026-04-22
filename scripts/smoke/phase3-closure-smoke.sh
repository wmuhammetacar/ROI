#!/usr/bin/env bash
set -euo pipefail

# ROI Phase 3 closure smoke
# Requires: curl, jq

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

ADMIN_AUTH_HEADER=""
BRANCH_ID=""
ORIGINAL_CIDRS='[]'
RESTORE_REQUIRED=0

restore_network() {
  if [[ "$RESTORE_REQUIRED" != "1" ]]; then
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

echo "[1/11] Admin login"
ADMIN_LOGIN_JSON="$(curl -sS -X POST "$BASE_URL/auth/login" \
  -H "x-forwarded-for: $ALLOWED_IP" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")"
ADMIN_TOKEN="$(echo "$ADMIN_LOGIN_JSON" | jq -r '.accessToken')"
if [[ -z "$ADMIN_TOKEN" || "$ADMIN_TOKEN" == "null" ]]; then
  echo "Admin login failed" >&2
  echo "$ADMIN_LOGIN_JSON" >&2
  exit 1
fi
ADMIN_AUTH_HEADER="authorization: Bearer $ADMIN_TOKEN"

echo "[2/11] Resolve branch + station context"
ME_JSON="$(curl -sS -X GET "$BASE_URL/users/me" -H "$ADMIN_AUTH_HEADER")"
BRANCH_ID="$(echo "$ME_JSON" | jq -r '.branchId')"
if [[ -z "$BRANCH_ID" || "$BRANCH_ID" == "null" ]]; then
  echo "Could not resolve branchId from /users/me" >&2
  exit 1
fi

STATIONS_JSON="$(curl -sS -X GET "$BASE_URL/stations" -H "$ADMIN_AUTH_HEADER")"
BAR_STATION_ID="$(echo "$STATIONS_JSON" | jq -r '.[] | select(.code=="BAR") | .id' | head -n1)"
KITCHEN_STATION_ID="$(echo "$STATIONS_JSON" | jq -r '.[] | select(.code=="KITCHEN") | .id' | head -n1)"
if [[ -z "$BAR_STATION_ID" || -z "$KITCHEN_STATION_ID" || "$BAR_STATION_ID" == "null" || "$KITCHEN_STATION_ID" == "null" ]]; then
  echo "BAR/KITCHEN stations are required" >&2
  exit 1
fi

echo "[3/11] Create waiter/staff account"
SUFFIX="$(date +%s)"
STAFF_USERNAME="waiter_phase3_${SUFFIX}"
STAFF_EMAIL="${STAFF_USERNAME}@roi.local"
CREATE_STAFF_JSON="$(curl -sS -X POST "$BASE_URL/users/staff" \
  -H "$ADMIN_AUTH_HEADER" \
  -H 'content-type: application/json' \
  -d "{\"name\":\"Phase3 Waiter\",\"username\":\"$STAFF_USERNAME\",\"email\":\"$STAFF_EMAIL\",\"branchId\":\"$BRANCH_ID\",\"roleNames\":[\"waiter\"],\"pin\":\"$STAFF_PIN\",\"isActive\":true}")"
STAFF_ID="$(echo "$CREATE_STAFF_JSON" | jq -r '.id')"
if [[ -z "$STAFF_ID" || "$STAFF_ID" == "null" ]]; then
  echo "Staff creation failed" >&2
  echo "$CREATE_STAFF_JSON" >&2
  exit 1
fi

echo "[4/11] Create BAR and KITCHEN printers with explicit priority policy"
BAR_PRINTER_NAME="BAR-PRIMARY-${SUFFIX}"
KITCHEN_PRINTER_NAME="KITCHEN-PRIMARY-${SUFFIX}"
BAR_PRINTER_JSON="$(curl -sS -X POST "$BASE_URL/printers" \
  -H "$ADMIN_AUTH_HEADER" \
  -H 'content-type: application/json' \
  -d "{\"name\":\"$BAR_PRINTER_NAME\",\"printerRole\":\"BAR\",\"type\":\"NETWORK\",\"stationId\":\"$BAR_STATION_ID\",\"priority\":10,\"copyCount\":1,\"isActive\":true}")"
KITCHEN_PRINTER_JSON="$(curl -sS -X POST "$BASE_URL/printers" \
  -H "$ADMIN_AUTH_HEADER" \
  -H 'content-type: application/json' \
  -d "{\"name\":\"$KITCHEN_PRINTER_NAME\",\"printerRole\":\"KITCHEN\",\"type\":\"NETWORK\",\"stationId\":\"$KITCHEN_STATION_ID\",\"priority\":10,\"copyCount\":1,\"isActive\":true}")"
BAR_PRINTER_ID="$(echo "$BAR_PRINTER_JSON" | jq -r '.id')"
KITCHEN_PRINTER_ID="$(echo "$KITCHEN_PRINTER_JSON" | jq -r '.id')"
if [[ -z "$BAR_PRINTER_ID" || "$BAR_PRINTER_ID" == "null" || -z "$KITCHEN_PRINTER_ID" || "$KITCHEN_PRINTER_ID" == "null" ]]; then
  echo "Printer creation failed" >&2
  exit 1
fi

echo "[5/11] Resolve Mojito/Cheesecake products"
CATALOG_JSON="$(curl -sS -X GET "$BASE_URL/catalog/pos-products?routeSafe=true" -H "$ADMIN_AUTH_HEADER")"
MOJITO_PRODUCT_ID="$(echo "$CATALOG_JSON" | jq -r '.categories[].products[] | select(.name=="Mojito") | .id' | head -n1)"
CHEESECAKE_PRODUCT_ID="$(echo "$CATALOG_JSON" | jq -r '.categories[].products[] | select(.name=="Cheesecake") | .id' | head -n1)"
if [[ -z "$MOJITO_PRODUCT_ID" || "$MOJITO_PRODUCT_ID" == "null" || -z "$CHEESECAKE_PRODUCT_ID" || "$CHEESECAKE_PRODUCT_ID" == "null" ]]; then
  echo "Mojito and Cheesecake are required for this smoke" >&2
  exit 1
fi

echo "[6/11] Routing preview checks"
MOJITO_PREVIEW="$(curl -sS -X GET "$BASE_URL/printers/routing/preview?productId=$MOJITO_PRODUCT_ID" -H "$ADMIN_AUTH_HEADER")"
CHEESECAKE_PREVIEW="$(curl -sS -X GET "$BASE_URL/printers/routing/preview?productId=$CHEESECAKE_PRODUCT_ID" -H "$ADMIN_AUTH_HEADER")"
MOJITO_STATION="$(echo "$MOJITO_PREVIEW" | jq -r '.station.code')"
CHEESECAKE_STATION="$(echo "$CHEESECAKE_PREVIEW" | jq -r '.station.code')"
MOJITO_PRINTER="$(echo "$MOJITO_PREVIEW" | jq -r '.selectedPrinter.name')"
CHEESECAKE_PRINTER="$(echo "$CHEESECAKE_PREVIEW" | jq -r '.selectedPrinter.name')"
if [[ "$MOJITO_STATION" != "BAR" || "$CHEESECAKE_STATION" != "KITCHEN" ]]; then
  echo "Routing preview station mismatch" >&2
  echo "Mojito station: $MOJITO_STATION" >&2
  echo "Cheesecake station: $CHEESECAKE_STATION" >&2
  exit 1
fi

echo "[7/11] Capture current network policy"
BRANCH_JSON="$(curl -sS -X GET "$BASE_URL/branches/$BRANCH_ID" -H "$ADMIN_AUTH_HEADER")"
ORIGINAL_CIDRS="$(echo "$BRANCH_JSON" | jq -c '.allowedNetworkCidrs // []')"

echo "[8/11] Restrict branch to allowed CIDR"
curl -sS -X PATCH "$BASE_URL/branches/$BRANCH_ID/network-settings" \
  -H "$ADMIN_AUTH_HEADER" \
  -H 'content-type: application/json' \
  -d "{\"allowedNetworkCidrs\":[\"$ALLOWED_CIDR\"]}" >/dev/null
RESTORE_REQUIRED=1

echo "[9/11] Staff login from allowed network succeeds"
ALLOWED_STATUS="$(curl -sS -o /tmp/roi_phase3_allowed.json -w "%{http_code}" -X POST "$BASE_URL/auth/staff-login" \
  -H 'content-type: application/json' \
  -H "x-forwarded-for: $ALLOWED_IP" \
  -d "{\"username\":\"$STAFF_USERNAME\",\"pin\":\"$STAFF_PIN\"}")"
if [[ "$ALLOWED_STATUS" != "200" && "$ALLOWED_STATUS" != "201" ]]; then
  echo "Allowed network login failed (status=$ALLOWED_STATUS)" >&2
  cat /tmp/roi_phase3_allowed.json >&2
  exit 1
fi

echo "[10/11] Staff login from disallowed network blocked"
BLOCKED_STATUS="$(curl -sS -o /tmp/roi_phase3_blocked.json -w "%{http_code}" -X POST "$BASE_URL/auth/staff-login" \
  -H 'content-type: application/json' \
  -H "x-forwarded-for: $BLOCKED_IP" \
  -d "{\"username\":\"$STAFF_USERNAME\",\"pin\":\"$STAFF_PIN\"}")"
if [[ "$BLOCKED_STATUS" != "403" ]]; then
  echo "Disallowed network was not blocked (status=$BLOCKED_STATUS)" >&2
  cat /tmp/roi_phase3_blocked.json >&2
  exit 1
fi

echo "[11/11] Public QR endpoint remains accessible from disallowed network"
PUBLIC_STATUS="$(curl -sS -o /tmp/roi_phase3_public.json -w "%{http_code}" -X GET "$BASE_URL/public/menu?branchId=$BRANCH_ID" \
  -H "x-forwarded-for: $BLOCKED_IP")"
if [[ "$PUBLIC_STATUS" != "200" ]]; then
  echo "Public endpoint check failed (status=$PUBLIC_STATUS)" >&2
  cat /tmp/roi_phase3_public.json >&2
  exit 1
fi

echo
echo "Phase 3 smoke OK"
echo "- Staff user: $STAFF_USERNAME ($STAFF_ID)"
echo "- Mojito: BAR -> $MOJITO_PRINTER"
echo "- Cheesecake: KITCHEN -> $CHEESECAKE_PRINTER"
echo "- Allowed login status: $ALLOWED_STATUS"
echo "- Blocked login status: $BLOCKED_STATUS"
echo "- Public menu status: $PUBLIC_STATUS"
