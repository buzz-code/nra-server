#!/bin/sh
# test-all-endpoints-runner.sh
#
# Shared backend API smoke test runner.
# Reads configuration from environment variables, with defaults for optional
# values when they are unset.
#
# Required env vars:
#   ENDPOINTS   — space-separated list of endpoint names to test
#                 e.g. "user student att_report"
#
# Optional env vars:
#   BACKEND_URL — base URL of the backend (default: http://localhost:3001)
#   ADMIN_USER  — credentials as "username:password"
#                 (default: admin_user:admin_password)

BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"
ADMIN_USER="${ADMIN_USER:-admin_user:admin_password}"

USERNAME="${ADMIN_USER%%:*}"
PASSWORD="${ADMIN_USER#*:}"

if [ -z "$ENDPOINTS" ]; then
  echo "ERROR: ENDPOINTS environment variable is not set."
  echo "Set it to a space-separated list of endpoint names before calling this script."
  echo "Example: ENDPOINTS=\"user student att_report\" ./test-all-endpoints-runner.sh"
  exit 1
fi

echo "============================================"
echo "API Endpoints Smoke Test - $(date)"
echo "Backend: $BACKEND_URL"
echo "User: $USERNAME"
echo "============================================"
echo ""

# Login and get cookie
COOKIE_FILE="$(mktemp /tmp/e2e-cookies-XXXXXX.txt)"
trap 'rm -f "$COOKIE_FILE"' EXIT

echo "Step 1: Login..."
LOGIN_BODY="$(python3 -c "import json,sys; print(json.dumps({'username':sys.argv[1],'password':sys.argv[2]}))" "$USERNAME" "$PASSWORD")"
LOGIN_RESPONSE="$(curl -X POST \
  -H "Content-Type: application/json" \
  -d "$LOGIN_BODY" \
  -c "$COOKIE_FILE" -s \
  "$BACKEND_URL/auth/login")"

if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
  echo "  ✓ Login successful"
else
  echo "  ✗ Login failed"
  echo "  Response: $LOGIN_RESPONSE"
  exit 1
fi

echo ""
echo "Step 2: Testing entity endpoints..."
echo ""

PASSED=0
FAILED=0
FAILED_DETAILS=""

for ENDPOINT in $ENDPOINTS; do
  printf "  %-45s ... " "$ENDPOINT"

  RESP_FILE="$(mktemp /tmp/e2e-resp-XXXXXX.json)"
  HTTP_CODE="$(curl \
    -b "$COOKIE_FILE" \
    -s \
    -o "$RESP_FILE" \
    -w "%{http_code}" \
    "$BACKEND_URL/$ENDPOINT")"

  if [ "$HTTP_CODE" = "200" ]; then
    printf "✓ OK\n"
    PASSED=$((PASSED + 1))
  else
    printf "✗ FAILED (HTTP %s)\n" "$HTTP_CODE"
    FAILED=$((FAILED + 1))
    FAILED_DETAILS="${FAILED_DETAILS}
--- $ENDPOINT (HTTP $HTTP_CODE) ---
$(cat "$RESP_FILE")
"
  fi
  rm -f "$RESP_FILE"
done

echo ""
echo "============================================"
echo "  PASSED: $PASSED"
echo "  FAILED: $FAILED"
echo "============================================"

if [ "$FAILED" -gt 0 ]; then
  echo ""
  echo "Failed endpoint details:"
  echo "$FAILED_DETAILS"
fi

exit "$FAILED"
