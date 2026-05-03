#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "${ROOT_DIR}"

pnpm sql:verify

if command -v createdb >/dev/null 2>&1 && command -v psql >/dev/null 2>&1; then
  pnpm sql:run
  exit 0
fi

cat >&2 <<'EOF'
PostgreSQL client tools were not found in PATH.

Install PostgreSQL locally, or start the Docker Compose environment:

  docker compose -f project-workbench/projects/01-postgresql-analytics/docker-compose.yml up -d

Then run with:

  PGHOST=127.0.0.1 PGPORT=5432 PGUSER=db_cookbook PGPASSWORD=db_cookbook DB_NAME=db_cookbook_lab \
    bash project-workbench/projects/01-postgresql-analytics/run.sh
EOF

exit 127
