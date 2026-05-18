#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PROJECT="$ROOT/project-workbench/projects/07-governance-mini-platform"

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

require_file "schema/governance.sql"
require_file "catalog/metric-dictionary.md"
require_file "lineage/lineage-sample.json"
require_file "quality/rules.sql"
require_file "policies/access-policies.md"
require_file "reports/governance-audit-template.md"
require_file "reports/run-record-template.md"

node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('$PROJECT/lineage/lineage-sample.json','utf8')); if (!Array.isArray(data.edges) || data.edges.length < 3) throw new Error('expected at least 3 lineage edges'); for (const edge of data.edges) { if (!edge.source_type || !edge.source_id || !edge.target_type || !edge.target_id || !edge.relation_type) throw new Error('invalid lineage edge'); }"

for table in governance.tables governance.columns governance.metrics governance.lineage_edges governance.quality_rules governance.policies governance.ai_evaluations; do
  require_text "schema/governance.sql" "$table"
done

require_text "catalog/metric-dictionary.md" "GMV"
require_text "catalog/metric-dictionary.md" "口径冲突案例"
require_text "quality/rules.sql" "governance.quality_rules"
require_text "quality/rules.sql" "source_hit"
require_text "policies/access-policies.md" "SQL"
require_text "policies/access-policies.md" "向量"
require_text "policies/access-policies.md" "图"
require_text "policies/access-policies.md" "执行位置"
require_text "policies/access-policies.md" "漏检风险"

echo "Project 7 static checks passed."

if command -v psql >/dev/null 2>&1; then
  echo "psql detected. Use reports/run-record-template.md to record governance schema, quality rule, and policy test execution."
else
  echo "psql not found. Static checks passed, but governance database, quality rule, and policy execution are not verified."
fi
