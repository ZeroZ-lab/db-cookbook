#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PROJECT="$ROOT/project-workbench/projects/04-mini-lakehouse"

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

require_file "storage/object-layout.md"
require_file "iceberg/orders.sql"
require_file "trino/orders-analysis.sql"
require_file "spark/build-order-items-wide.sql"
require_file "docs/evolution-record.md"
require_file "reports/run-record-template.md"

require_text "storage/object-layout.md" "*.parquet"
require_text "storage/object-layout.md" "warehouse/iceberg"
require_text "iceberg/orders.sql" "USING iceberg"
require_text "iceberg/orders.sql" "'format-version' = '2'"
require_text "iceberg/orders.sql" "PARTITIONED BY"
require_text "trino/orders-analysis.sql" "FROM lakehouse.orders"
require_text "trino/orders-analysis.sql" "FROM lakehouse.order_items_wide"
require_text "spark/build-order-items-wide.sql" "INSERT OVERWRITE lakehouse.order_items_wide"
require_text "spark/build-order-items-wide.sql" "JOIN lakehouse.raw_order_items"
require_text "docs/evolution-record.md" "Schema 演化"
require_text "docs/evolution-record.md" "分区演化"

echo "Project 4 static checks passed."

missing_runtime=0
for tool in spark-sql trino; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "$tool not found."
    missing_runtime=1
  fi
done

if [[ "$missing_runtime" -eq 0 ]]; then
  echo "Spark SQL and Trino clients detected. Use reports/run-record-template.md to record a real lakehouse run."
else
  echo "Static checks passed, but Spark/Trino/Iceberg engine execution is not verified."
fi
