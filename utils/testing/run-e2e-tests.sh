#!/bin/sh
# Runs curl-based endpoint smoke tests against a running backend.
# Requires BACKEND_URL and ADMIN_USER env vars, or uses defaults.
# Called from: server/shared/utils/testing/run-e2e-tests.sh
# endpoints.env lives at:   server/helpers/endpoints.env  (../../../helpers/)
# runner lives alongside:   server/shared/utils/testing/test-all-endpoints-runner.sh
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

ENDPOINTS_ENV_FILE="${ENDPOINTS_ENV_FILE:-$SCRIPT_DIR/../../../helpers/endpoints.env}"

if [ ! -r "$ENDPOINTS_ENV_FILE" ]; then
    echo "Error: endpoints env file '$ENDPOINTS_ENV_FILE' does not exist or is not readable." >&2
    echo "Set ENDPOINTS_ENV_FILE to override the default path." >&2
    exit 1
fi

. "$ENDPOINTS_ENV_FILE"
exec "$SCRIPT_DIR/test-all-endpoints-runner.sh"
