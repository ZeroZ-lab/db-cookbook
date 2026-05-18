#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PROJECT="$ROOT/project-workbench/projects/03-cdc-realtime-warehouse"

require_file() {
  local file="$1"
  if [[ ! -f "$PROJECT/$file" ]]; then
    echo "missing required file: $file" >&2
    exit 1
  fi
}

require_text() {
  local file="$1"
  local text="$2"
  if ! grep -Fq "$text" "$PROJECT/$file"; then
    echo "missing required text in $file: $text" >&2
    exit 1
  fi
}

require_file "events/order-status-changed.json"
require_file "kafka/topics.md"
require_file "flink/realtime-gmv.sql"
require_file "sinks/clickhouse-realtime.sql"
require_file "docs/exactly-once-boundary.md"
require_file "reports/run-record-template.md"

node -e "const fs=require('fs'); const e=JSON.parse(fs.readFileSync('$PROJECT/events/order-status-changed.json','utf8')); if (e.before.order_status !== 'created' || e.after.order_status !== 'paid') throw new Error('unexpected order status transition');"

require_text "kafka/topics.md" "db.public.orders"
require_text "kafka/topics.md" "flink-realtime-gmv"
require_text "flink/realtime-gmv.sql" "WATERMARK FOR event_time"
require_text "flink/realtime-gmv.sql" "TUMBLE(TABLE orders_cdc"
require_text "flink/realtime-gmv.sql" "COUNT(DISTINCT order_id)"
require_text "sinks/clickhouse-realtime.sql" "ReplacingMergeTree"
require_text "docs/exactly-once-boundary.md" "Source"
require_text "docs/exactly-once-boundary.md" "Checkpoint"
require_text "docs/exactly-once-boundary.md" "Sink"

echo "Project 3 static checks passed."

missing_runtime=0
for tool in kafka-topics flink-sql-client clickhouse; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "$tool not found."
    missing_runtime=1
  fi
done

if [[ "$missing_runtime" -eq 0 ]]; then
  echo "Kafka, Flink SQL Client, and ClickHouse client detected. Use reports/run-record-template.md to record a real run."
else
  echo "Static checks passed, but Kafka/Flink/ClickHouse engine execution is not verified."
fi
