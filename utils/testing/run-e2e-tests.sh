#!/bin/sh
# Runs curl-based endpoint smoke tests against a running backend.
# Requires BACKEND_URL and ADMIN_USER env vars, or uses defaults.
# Called from: server/shared/utils/testing/run-e2e-tests.sh
# endpoints.env lives at:   server/helpers/endpoints.env  (../../../helpers/)
# runner lives alongside:   server/shared/utils/testing/test-all-endpoints-runner.sh
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
. "$SCRIPT_DIR/../../../helpers/endpoints.env"
exec "$SCRIPT_DIR/test-all-endpoints-runner.sh"
