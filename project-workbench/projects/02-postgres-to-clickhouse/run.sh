#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PROJECT="$ROOT/project-workbench/projects/02-postgres-to-clickhouse"

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

require_file "mappings/orders-wide-mapping.md"
require_file "clickhouse/schema.sql"
require_file "queries/daily-gmv.sql"
require_file "docs/table-design-notes.md"
require_file "docs/sync-strategy.md"
require_file "reports/reconciliation-template.md"
require_file "reports/run-record-template.md"

require_text "clickhouse/schema.sql" "ENGINE = MergeTree"
require_text "clickhouse/schema.sql" "ENGINE = ReplacingMergeTree"
require_text "clickhouse/schema.sql" "PARTITION BY toYYYYMM(created_at)"
require_text "clickhouse/schema.sql" "ORDER BY (created_at, category, user_id, order_id)"
require_text "queries/daily-gmv.sql" "sumIf(item_amount"
require_text "queries/daily-gmv.sql" "uniqExactIf(order_id"
require_text "docs/table-design-notes.md" "排序键"
require_text "docs/sync-strategy.md" "初始同步"
require_text "docs/sync-strategy.md" "增量同步"

echo "Project 2 static checks passed."

if command -v clickhouse >/dev/null 2>&1; then
  echo "ClickHouse client detected. You can run:"
  echo "  clickhouse client --queries-file $PROJECT/clickhouse/schema.sql"
  echo "  clickhouse client --queries-file $PROJECT/queries/daily-gmv.sql"
else
  echo "ClickHouse client not found. Static checks passed, but engine execution is not verified."
fi
