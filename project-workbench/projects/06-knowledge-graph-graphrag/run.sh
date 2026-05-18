#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PROJECT="$ROOT/project-workbench/projects/06-knowledge-graph-graphrag"

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

require_file "ontology/entity-relation-types.md"
require_file "data/triples-sample.jsonl"
require_file "queries/neo4j-paths.cypher"
require_file "queries/nebulagraph-paths.ngql"
require_file "graphrag/context-template.md"
require_file "reports/graph-query-log-template.md"
require_file "reports/run-record-template.md"

node -e "const fs=require('fs'); const lines=fs.readFileSync('$PROJECT/data/triples-sample.jsonl','utf8').trim().split('\\n'); if (lines.length < 5) throw new Error('expected at least 5 triples'); for (const line of lines) { const t=JSON.parse(line); if (!t.subject || !t.predicate || !t.object || !t.source || typeof t.confidence !== 'number' || !t.graph_version) throw new Error('invalid triple shape'); }"

require_text "ontology/entity-relation-types.md" "User"
require_text "ontology/entity-relation-types.md" "Product"
require_text "ontology/entity-relation-types.md" "Metric"
require_text "ontology/entity-relation-types.md" "PLACED"
require_text "ontology/entity-relation-types.md" "DEFINED_IN"
require_text "queries/neo4j-paths.cypher" "MATCH path"
require_text "queries/neo4j-paths.cypher" "length(path)"
require_text "queries/nebulagraph-paths.ngql" "FIND ALL PATH"
require_text "queries/nebulagraph-paths.ngql" "UPTO 3 STEPS"
require_text "graphrag/context-template.md" "向量召回片段"
require_text "graphrag/context-template.md" "图路径证据"

echo "Project 6 static checks passed."

missing_runtime=0
for tool in cypher-shell nebula-console; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "$tool not found."
    missing_runtime=1
  fi
done

if [[ "$missing_runtime" -eq 0 ]]; then
  echo "Neo4j and NebulaGraph clients detected. Use reports/run-record-template.md to record a real graph run."
else
  echo "Static checks passed, but Neo4j/NebulaGraph and GraphRAG execution are not verified."
fi
