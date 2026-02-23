#!/usr/bin/env bash
set -euo pipefail

require() {
  local key="$1"
  if [[ -z "${!key:-}" ]]; then
    echo "Missing required env var: $key" >&2
    exit 1
  fi
}

require PRIMARY_APPSYNC_URL
require PRIMARY_APPSYNC_API_KEY
require DR_APPSYNC_URL
require DR_APPSYNC_API_KEY

query='{"query":"query Health { __typename }"}'

run_query() {
  local name="$1"
  local url="$2"
  local key="$3"

  local status
  status=$(curl -sS -o "/tmp/txwatch-smoke-${name}.json" -w "%{http_code}" \
    -X POST "$url" \
    -H "content-type: application/json" \
    -H "x-api-key: $key" \
    --data "$query")

  if [[ "$status" != "200" ]]; then
    echo "${name}: HTTP $status" >&2
    cat "/tmp/txwatch-smoke-${name}.json" >&2
    return 1
  fi

  if grep -q '"errors"' "/tmp/txwatch-smoke-${name}.json"; then
    echo "${name}: GraphQL errors returned" >&2
    cat "/tmp/txwatch-smoke-${name}.json" >&2
    return 1
  fi

  echo "${name}: OK"
}

echo "Running txwatch AppSync failover smoke..."
run_query "primary" "$PRIMARY_APPSYNC_URL" "$PRIMARY_APPSYNC_API_KEY"
run_query "dr" "$DR_APPSYNC_URL" "$DR_APPSYNC_API_KEY"
echo "Smoke passed for primary + DR AppSync endpoints."
