#!/bin/bash
set -euo pipefail

CONFIG_FILE="${INFRA_CONFIG:-config/infra-outputs.json}"

for dep in aws jq python; do
  command -v "$dep" >/dev/null 2>&1 || {
    echo "Missing dependency: $dep" >&2
    exit 1
  }
done

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Infrastructure config not found: $CONFIG_FILE" >&2
  exit 1
fi

PRIMARY_REGION="$(jq -r '.app_config.value.primary_region' "$CONFIG_FILE")"
EVENT_BUS_NAME="$(jq -r '.app_config.value.event_pipeline.event_bus_name' "$CONFIG_FILE")"
TABLE_NAME="$(jq -r '.app_config.value.dynamodb.table_name' "$CONFIG_FILE")"

if [ -z "$PRIMARY_REGION" ] || [ "$PRIMARY_REGION" = "null" ] || [ -z "$EVENT_BUS_NAME" ] || [ "$EVENT_BUS_NAME" = "null" ] || [ -z "$TABLE_NAME" ] || [ "$TABLE_NAME" = "null" ]; then
  echo "Missing required values in infra config" >&2
  exit 1
fi

SMOKE_ID="smoke-${GITHUB_RUN_ID:-local}-$(date +%s)"
TX_ID="tx-$SMOKE_ID"

echo "Publishing smoke event to $EVENT_BUS_NAME (tx: $TX_ID)"
aws events put-events \
  --region "$PRIMARY_REGION" \
  --entries "[{\"Source\":\"txwatch.transactions\",\"DetailType\":\"TxWatchSmoke\",\"Detail\":\"{\\\"transactionId\\\":\\\"$TX_ID\\\",\\\"source\\\":\\\"ci-smoke\\\",\\\"category\\\":\\\"online\\\",\\\"merchant\\\":\\\"TxWatch Smoke\\\",\\\"amount\\\":1.23}\",\"EventBusName\":\"$EVENT_BUS_NAME\"}]" \
  >/tmp/txwatch-smoke-put-events.json

FAILED_COUNT="$(jq -r '.FailedEntryCount' /tmp/txwatch-smoke-put-events.json)"
if [ "$FAILED_COUNT" != "0" ]; then
  echo "EventBridge put-events failed" >&2
  cat /tmp/txwatch-smoke-put-events.json >&2
  exit 1
fi

echo "Waiting for enriched record in DynamoDB..."
python - "$PRIMARY_REGION" "$TABLE_NAME" "$TX_ID" <<'PY'
import json
import subprocess
import sys
import time

region, table, tx_id = sys.argv[1], sys.argv[2], sys.argv[3]
pk = f"TX#{tx_id}"

for _ in range(35):
    out = subprocess.check_output(
        [
            "aws",
            "dynamodb",
            "query",
            "--region",
            region,
            "--table-name",
            table,
            "--key-condition-expression",
            "PK = :pk",
            "--expression-attribute-values",
            json.dumps({":pk": {"S": pk}}),
            "--limit",
            "1",
            "--output",
            "json",
        ],
        text=True,
    )
    data = json.loads(out)
    items = data.get("Items", [])
    if items:
        print("event_ingest_ok")
        print("tx_id", tx_id)
        print("source", items[0].get("source", {}).get("S", ""))
        print("status", items[0].get("status", {}).get("S", ""))
        sys.exit(0)
    time.sleep(4)

print("event_not_observed", file=sys.stderr)
sys.exit(1)
PY
