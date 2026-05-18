#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PROJECT="$ROOT/project-workbench/projects/05-rag-vector-kb"

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

require_file "schema/pgvector.sql"
require_file "queries/retrieve-with-permission.sql"
require_file "evals/rag-eval-sample.json"
require_file "docs/chunking-and-versioning.md"
require_file "docs/permission-boundary.md"
require_file "reports/retrieval-log-template.md"
require_file "reports/run-record-template.md"

node -e "const fs=require('fs'); const cases=JSON.parse(fs.readFileSync('$PROJECT/evals/rag-eval-sample.json','utf8')); if (!Array.isArray(cases) || cases.length < 3) throw new Error('RAG eval set must contain at least 3 cases'); for (const item of cases) { if (!item.question || !item.expected_source_uri || !item.expected_answer) throw new Error('RAG eval case missing required fields'); }"

require_text "schema/pgvector.sql" "rag.documents"
require_text "schema/pgvector.sql" "rag.chunks"
require_text "schema/pgvector.sql" "rag.embeddings"
require_text "schema/pgvector.sql" "rag.retrieval_logs"
require_text "schema/pgvector.sql" "rag.evaluations"
require_text "schema/pgvector.sql" "vector(1536)"
require_text "schema/pgvector.sql" "USING hnsw"
require_text "queries/retrieve-with-permission.sql" "visible_documents"
require_text "queries/retrieve-with-permission.sql" "owner_id = :user_id"
require_text "queries/retrieve-with-permission.sql" "e.embedding <=> :query_embedding"
require_text "queries/retrieve-with-permission.sql" "rag.retrieval_logs"
require_text "docs/permission-boundary.md" "检索前过滤"
require_text "docs/permission-boundary.md" "检索后校验"
require_text "docs/chunking-and-versioning.md" "Embedding"

echo "Project 5 static checks passed."

if command -v psql >/dev/null 2>&1; then
  echo "psql detected. If PostgreSQL has pgvector installed, record schema/query execution in reports/run-record-template.md."
else
  echo "psql not found. Static checks passed, but pgvector and RAG evaluation execution are not verified."
fi
